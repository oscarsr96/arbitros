# -*- coding: utf-8 -*-
"""
Parser OFFLINE del calendario PDF oficial FBM -> CSV en el formato que consume
parseCalendarCsv (apps/web/src/lib/fbm-calendar/parse-calendar-csv.ts).

Uso (desde la raiz del repo):
    pip install pymupdf
    python scripts/fbm-pdf-to-csv.py

Procesa TODOS los PDF de partidos_calendarios/{primera_tanda,segunda_tanda}/,
deduplica por hash MD5 y escribe UN CSV combinado: calendario_temporada_fbm.csv.

No toca la app: el CSV generado se sube por el boton "Importar calendario FBM".

Generalizacion frente a la version anterior (calibrada a mano para 2 layouts):
en vez de coordenadas de pixel fijas, cada tabla deriva sus fronteras de
columna EN CADA PDF a partir de la fila de cabecera (posicion x de las
etiquetas EQUIPO/POBLACION/DIA/HORA/CAMPO, RE./JORNADA:, NOMBRE/TELEF.), con
punto medio entre etiquetas consecutivas como frontera. Se usa PyMuPDF
(`fitz`) en vez de pdfplumber; `page.get_text("words")` da la palabra ya
limpia (sin el problema de pdftotext partiendo "CATEGORIA:" en dos).

Estructura real de cada PDF (272 unicos de 303, verificado con ingenieria
inversa sobre el corpus completo):
  - Pagina 0: cabecera (CATEGORIA/FASE/GRUPO) + tabla de equipos. La tabla de
    equipos SIEMPRE cabe entera en la pagina 0 (verificado: la primera
    'JORNADA:' del documento aparece siempre en pagina 0), pero el bloque de
    jornadas puede empezar a continuacion en la MISMA pagina si sobra hueco:
    no hay una frontera pagina=seccion, se parsea fila a fila.
  - Bloques de jornada en dos columnas (ida a la izquierda, vuelta a la
    derecha) que continuan por las paginas intermedias.
  - Ultima pagina: directorio de clubs (marcador unico: token que termina en
    '.' y normaliza a 'TELEF'), que enriquece el nombre de club. Es
    best-effort (asume que cada club ocupa exactamente 2 filas); si el bloque
    de un club envuelve mas de 2 lineas, esa fila no enriquece y aguas abajo
    se repite el nombre de equipo como nombre de club.
"""
import glob
import hashlib
import re
import unicodedata
from collections import Counter
from datetime import date, timedelta

import fitz  # PyMuPDF

HORA_RE = re.compile(r'^\d{2}:\d{2}$')
DATE_RE = re.compile(r'^(\d{2})/(\d{2})/(\d{4})$')

CSV_HEADER = ('CATEGORÍA;FASE;GRUPO;JORNADA;CLUB L.;EQ. LOCAL;CLUB V.;'
              'EQ. VISITANTE;FECHA;HORA;CAMPO;DIRECCIÓN;POBLACIÓN;'
              'IDENTIFICADOR')


def letters(s):
    """Solo A-Z + N (de N-tilde), mayus, sin acentos ni puntuacion/digitos.
    Los digitos se descartan a proposito: en la tabla de emparejamientos hay
    que distinguir palabras-marcador (letras) de marcadores de partido
    (numeros puros), y esta es la funcion que se usa para eso."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in s.upper() if 'A' <= c <= 'Z')


def letters_and_digits(s):
    """Como letters(), pero conserva los digitos. Firma de EQUIPO (tabla de
    equipos) unicamente: dos equipos del mismo club a veces solo se
    distinguen por un sufijo numerico (p.ej. 'BALONCESTO COSLADA' vs
    'BALONCESTO COSLADA 2018'), y la tabla de emparejamientos imprime a
    ambos SIN el sufijo (igual que pasa con el cualificador entre comillas
    "A"/"B"): con letters() a secas colisionan y uno de los dos equipos se
    pierde al construir la tabla de equipos. match_team ya sabe desambiguar
    un texto impreso corto entre varios equipos que lo tienen de prefijo
    (el mas largo con el sufijo incluido entre ellos), asi que basta con que
    la firma de equipo no colisione."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in s.upper() if 'A' <= c <= 'Z' or '0' <= c <= '9')


def slugify(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'x'


# --- lectura de palabras y filas (PyMuPDF, sin coordenadas hardcodeadas) ---

def get_words(page):
    return [{'x0': w[0], 'top': w[1], 'x1': w[2], 'bottom': w[3], 'text': w[4]}
            for w in page.get_text('words')]


def rows_by_y(words, tol=3):
    rows = {}
    for w in words:
        key = None
        for k in rows:
            if abs(k - w['top']) <= tol:
                key = k
                break
        rows.setdefault(w['top'] if key is None else key, []).append(w)
    return [sorted(rows[k], key=lambda w: w['x0']) for k in sorted(rows)]


def is_label(w, name, require_terminator=False):
    """True si w normaliza (letters()) a `name`. Si require_terminator, exige
    ademas que el texto crudo termine en ':' o '.' (distingue la ETIQUETA
    'GRUPO:' del propio VALOR 'GRUPO' en 'GRUPO: GRUPO 1')."""
    if letters(w['text']) != name:
        return False
    if require_terminator:
        return w['text'].endswith(':') or w['text'].endswith('.')
    return True


def find_anchors(row, labels):
    """Ancla x0 de cada etiqueta de `labels` presente en la fila (cabecera de
    tabla), en orden de aparicion izquierda->derecha. Si una etiqueta se
    repite (p.ej. COLOR/COLOR), la 2a instancia se numera _2, _3...
    Devuelve lista [(nombre, x0), ...] apta para column_ranges()."""
    anchors = []
    seen = {}
    for w in sorted(row, key=lambda w: w['x0']):
        lab = letters(w['text'])
        if lab in labels:
            seen[lab] = seen.get(lab, 0) + 1
            name = lab if seen[lab] == 1 else f'{lab}_{seen[lab]}'
            anchors.append((name, w['x0']))
    return anchors


def column_ranges(anchors):
    """Fronteras de columna = punto medio entre anclas consecutivas (por
    x0); primera columna abierta por la izquierda, ultima por la derecha."""
    ordered = sorted(anchors, key=lambda a: a[1])
    bounds = {}
    for i, (name, x0) in enumerate(ordered):
        lo = -1e9 if i == 0 else (ordered[i - 1][1] + x0) / 2
        hi = 1e9 if i == len(ordered) - 1 else (x0 + ordered[i + 1][1]) / 2
        bounds[name] = (lo, hi)
    return bounds


# --- cabecera (CATEGORIA / FASE / GRUPO), pagina 0 ---

def parse_meta(rows):
    categoria = fase = grupo = ''
    for row in rows:
        cat_lab = next((w for w in row if is_label(w, 'CATEGORIA', True)), None)
        if cat_lab and not categoria:
            categoria = ' '.join(w['text'] for w in row if w['x0'] > cat_lab['x1'])
        fase_lab = next((w for w in row if is_label(w, 'FASE', True)), None)
        grupo_lab = next((w for w in row if is_label(w, 'GRUPO', True)), None)
        if fase_lab and not fase:
            limit = grupo_lab['x0'] if grupo_lab else 1e9
            fase = ' '.join(w['text'] for w in row if fase_lab['x1'] < w['x0'] < limit)
        if grupo_lab and not grupo:
            grupo = ' '.join(w['text'] for w in row if w['x0'] > grupo_lab['x1'])
    return {
        'categoria': categoria.strip(),
        'fase': (fase or 'PRIMERA FASE').strip(),
        'grupo': grupo.strip(),
    }


# --- tabla de equipos (pagina 0): EQUIPO/POBLACION/PROV/DIA/HORA/COLOR/CAMPO ---

ROSTER_LABELS = {'EQUIPO', 'POBLACION', 'PROV', 'DIA', 'HORA', 'COLOR', 'CAMPO'}


def find_roster_header(rows):
    for i, row in enumerate(rows):
        labs = {letters(w['text']) for w in row}
        if 'EQUIPO' in labs and 'POBLACION' in labs:
            return i, row
    return None, None


def find_jornada_row_idx(rows, start):
    for i in range(start, len(rows)):
        if any(is_label(w, 'JORNADA', True) for w in rows[i]):
            return i
    return len(rows)


def row_name_boundary(row, pob_hi, fallback):
    """Frontera NOMBRE/POBLACION de ESTA fila. El punto medio EQUIPO/POBLACION
    de la cabecera (`fallback`) es una frontera fija que un nombre de equipo
    largo con cualificador entre comillas (p.ej. 'GSD BALONCESTO ALCALA "B"')
    puede rebasar, colando la comilla en la columna de POBLACION y colisionando
    su signature con la del equipo hermano ("A"). El hueco real hasta el valor
    de POBLACION es sistematicamente mucho mayor que el espaciado normal entre
    palabras de un mismo nombre (~2pt vs ~30pt), asi que se usa el hueco mas
    grande entre palabras consecutivas (acotado a x0 < pob_hi para no colarse
    en el hueco POBLACION/PROV, que puede ser igual de grande) como frontera
    real de esta fila."""
    cand = sorted((w for w in row if w['x0'] < pob_hi), key=lambda w: w['x0'])
    if len(cand) < 2:
        return fallback
    gaps = [(cand[i + 1]['x0'] - cand[i]['x1'], i) for i in range(len(cand) - 1)]
    _, i = max(gaps)
    return (cand[i]['x1'] + cand[i + 1]['x0']) / 2


def parse_roster(rows):
    """Tabla de equipos de la pagina 0. Devuelve (teams, end_idx, warnings)
    donde end_idx es el indice de fila donde empieza el primer bloque de
    jornada (frontera dinamica: la tabla de equipos SIEMPRE cabe en pagina 0,
    pero el bloque de jornadas puede arrancar justo debajo, en la misma
    pagina)."""
    hdr_idx, hdr_row = find_roster_header(rows)
    if hdr_idx is None:
        return {}, 0, []
    bounds = column_ranges(find_anchors(hdr_row, ROSTER_LABELS))
    name_hi = bounds['EQUIPO'][1]
    pob_lo, pob_hi = bounds['POBLACION']
    dia_lo, dia_hi = bounds['DIA']
    hora_lo, hora_hi = bounds['HORA']
    campo_lo = bounds['CAMPO'][0]

    end_idx = find_jornada_row_idx(rows, hdr_idx + 1)

    teams = []
    cur = None
    for row in rows[hdr_idx + 1:end_idx]:
        has_hora = any(hora_lo <= w['x0'] < hora_hi and HORA_RE.match(w['text']) for w in row)
        if has_hora:
            cur = {'name': [], 'pob': [], 'dia': '', 'hora': '', 'campo': [], 'addr': [], 'first': True}
            teams.append(cur)
        if cur is None:
            continue
        row_name_hi = row_name_boundary(row, pob_hi, name_hi) if cur['first'] else name_hi
        for w in row:
            x, t = w['x0'], w['text']
            if x < row_name_hi:
                cur['name'].append(t)
            elif pob_lo <= x < pob_hi:
                cur['pob'].append(t)
            elif dia_lo <= x < dia_hi and t in ('S', 'D'):
                cur['dia'] = t
            elif hora_lo <= x < hora_hi and HORA_RE.match(t):
                cur['hora'] = t
            elif x >= campo_lo:
                (cur['campo'] if cur['first'] else cur['addr']).append(t)
        cur['first'] = False

    # Firma por defecto: letters() SIN digitos, igual que en la tabla de
    # emparejamientos (los marcadores de partido son digitos puros y hay que
    # poder filtrarlos alli; letters_and_digits() en todos los equipos
    # rompe con nombres que llevan un digito EN MEDIO del nombre sin animo
    # de desambiguar nada (p.ej. 'MEJORADA 2012 C.B.'): la fila de
    # emparejamientos imprime ese mismo digito, tambien como token aparte, y
    # al filtrarse como marcador dejaria de casar por prefijo contra una
    # firma de equipo que SI lo conserva en medio. Solo se sube a
    # letters_and_digits(), y como ultimo recurso a un sufijo posicional,
    # para los equipos que de verdad colisionan (2+ filas de equipo
    # DISTINTAS con la misma firma sin digitos).
    groups = {}
    for t in teams:
        name = ' '.join(t['name']).strip()
        if not name:
            continue
        groups.setdefault(letters(name), []).append((name, t))

    out = {}
    warnings = []
    name_seen = {}  # cuenta apariciones del mismo texto de nombre IMPRESO
    for base_sig, entries in groups.items():
        for name, t in entries:
            sig = base_sig if len(entries) == 1 else letters_and_digits(name)
            if sig in out:
                # Ni siquiera el digito distingue a las dos filas: un club
                # con equipo A y B sin ninguna marca que los diferencie, ni
                # en la propia tabla de equipos (a diferencia de 'EQUIPO
                # "B"', que al menos ahi se ve la letra, o de un sufijo
                # numerico). Se numera para no perder al segundo equipo;
                # match_team ya sabe repartir partidos entre "hermanos" de
                # firma emparentada preferiendo el que no ha jugado esta
                # jornada, que es lo mejor que se puede hacer sin mas
                # informacion en el PDF de origen.
                warnings.append(f'equipo duplicado en la tabla ("{name}"): desambiguado por posicion')
                n = 2
                while f'{sig}__{n}' in out:
                    n += 1
                sig = f'{sig}__{n}'
            # El sufijo de arriba desambigua la firma INTERNA de casado, pero
            # el nombre que sale al CSV (EQ. LOCAL/EQ. VISITANTE) es el mismo
            # texto para las dos filas duplicadas si no se toca tambien:
            # dos equipos distintos se veian identicos en la salida (y su
            # propio enfrentamiento salia como "X contra X"). Solo la 2a+
            # aparicion del mismo texto exacto se marca; la 1a sale tal cual.
            name_seen[name] = name_seen.get(name, 0) + 1
            display_name = name if name_seen[name] == 1 else f'{name} ({name_seen[name]})'
            out[sig] = {
                'name': display_name,
                'poblacion': ' '.join(t['pob']).strip(),
                'dia': t['dia'] or 'D',
                'hora': t['hora'] or '00:00',
                'campo': ' '.join(t['campo']).strip(),
                'direccion': ' '.join(t['addr']).strip(),
            }
    return out, end_idx, warnings


# --- emparejamientos (dos columnas ida/vuelta); logica de match_team/split
# reutilizada tal cual: no depende de coordenadas, solo de casar contra los
# nombres de equipo ya conocidos por la tabla de equipos ---

def common_prefix_len(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def match_team(side, teams, used):
    """side puede ser ambiguo entre un equipo exacto y un hermano de club mas
    largo que lo tiene de prefijo (p.ej. 'VALCUDE ALCOBENDAS' es un match
    exacto, pero 'VALCUDE ALCOBENDAS "B"' TAMBIEN empieza igual y el propio
    PDF imprime a ambos equipos como 'VALCUDE ALCOBENDAS' en la tabla de
    emparejamientos, sin la letra de equipo B). Un match exacto NO puede
    ganar por defecto sobre un hermano mas largo: se juntan en el mismo nivel
    ("startswith" ya incluye la igualdad) y se desambigua igual que el resto,
    prefiriendo el no usado todavia esta jornada y, si empatan, el mas largo."""
    if not side:
        return None

    def pick(cands):
        pool = [c for c in cands if c not in used] or cands
        return max(pool, key=len) if pool else None

    pref = [s for s in teams if s.startswith(side) or side.startswith(s)]
    if pref:
        return pick(pref)
    sub = [s for s in teams if side in s or s in side]
    if sub:
        return pick(sub)
    pool = [s for s in teams if s not in used] or list(teams)
    return max(pool, key=lambda s: common_prefix_len(s, side))


def resolve_pair(local_acc, away_acc, teams, used):
    """Resuelve (local, away) contra match_team resolviendo primero el lado
    con el acumulado MAS LARGO (mas especifico, con menos riesgo de que
    varios equipos compartan ese prefijo) y dejando que el lado corto -mas
    propenso a ser ambiguo entre "hermanos" del mismo club- herede lo que
    quede via el conjunto `used`. Si se resolviera siempre local primero,
    un local abreviado a un fragmento ambiguo (p.ej. solo 'BALONCESTO', que
    vale de prefijo tanto para 'BALONCESTO FUENLABRADA B' como para
    'BALONCESTO RIVAS SURESTE B') puede robarle a un visitante NADA
    ambiguo ('BALONCESTO RIVAS...') el unico equipo que de verdad le
    corresponde, dejando al visitante sin nada valido y tirando la fila."""
    if len(local_acc) >= len(away_acc):
        local = match_team(local_acc, teams, used)
        away = match_team(away_acc, teams, used | {local})
    else:
        away = match_team(away_acc, teams, used)
        local = match_team(local_acc, teams, used | {away})
    return local, away


def split_main_row(row, teams, used):
    """Reparte una fila principal en (local, visitante). Acumula letras de
    izquierda a derecha mientras sigan siendo prefijo de algun equipo (igual
    que antes); la primera palabra del visitante rompe el prefijo y marca el
    corte normal."""
    aw = sorted((w for w in row if letters(w['text'])), key=lambda w: w['x0'])
    acc, k = '', 0
    for idx, w in enumerate(aw):
        nxt = acc + letters(w['text'])
        if any(s.startswith(nxt) for s in teams):
            acc, k = nxt, idx + 1
        else:
            break
    if k == 0:
        return None
    if k >= len(aw):
        # El acumulado se comio TODAS las palabras y no deja nada para el
        # visitante: pasa cuando el nombre COMPLETO de un equipo coincide,
        # por casualidad, con el acumulado del local seguido de la primera
        # palabra del visitante (p.ej. el local 'CESUR DISTRITO' se imprime
        # abreviado en esta fila, pero 'CESUR DISTRITO OLIMPICO' es TAMBIEN
        # un equipo real de la tabla, y el visitante 'OLIMPICO 64' empieza
        # justo por esa palabra). Se retrocede palabra a palabra -de mas a
        # menos para el local- buscando el primer corte donde el resto
        # resuelva a un equipo real distinto del local; a diferencia del
        # acumulado normal, aqui SI hace falta comprobar el candidato del
        # visitante porque ya no hay ninguna palabra de refuerzo detras que
        # lo confirme.
        for k2 in range(len(aw) - 1, 0, -1):
            local_acc = ''.join(letters(w['text']) for w in aw[:k2])
            away_acc = ''.join(letters(w['text']) for w in aw[k2:])
            if not any(s.startswith(away_acc) for s in teams):
                continue
            local, away = resolve_pair(local_acc, away_acc, teams, used)
            if local and away and local != away:
                used.add(local)
                used.add(away)
                return (local, away)
        return None
    away_acc = ''.join(letters(w['text']) for w in aw[k:])
    local, away = resolve_pair(acc, away_acc, teams, used)
    if local and away and local != away:
        used.add(local)
        used.add(away)
        return (local, away)
    return None


def derive_lr_boundary(pages_words, page_width):
    """Frontera columna izq/dcha de los bloques de jornada. OJO: la
    etiqueta 'JORNADA:' NO sirve de ancla para el punto medio -- esta
    colocada bien a la izquierda dentro de su propia columna (a ~51pt de su
    inicio real), muy lejos del borde real con la columna vecina, así que
    el punto medio entre las dos 'JORNADA:' cae DENTRO de la columna
    izquierda (corta la sub-columna de marcador visitante). El layout es de
    dos columnas de igual ancho repartiendo la pagina, asi que el punto
    medio de la pagina SI cae en el hueco real entre columnas (verificado:
    las 303 fuentes comparten el mismo ancho de pagina). Solo se usa la
    presencia de 'JORNADA:' para decidir si el documento es a dos columnas;
    si no se detectan 2 grupos claros (hueco > 20pt), se asume una columna."""
    xs = sorted({round(w['x0']) for words in pages_words for w in words
                 if is_label(w, 'JORNADA', True)})
    if len(xs) < 2:
        return None
    gaps = [(xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)]
    gap, _ = max(gaps)
    if gap <= 20:
        return None
    return page_width / 2


def is_directory_header_row(row):
    return any(is_label(w, 'TELEF', True) for w in row)


def parse_pairing(pages_words, teams, lr_boundary):
    """Recorre las PALABRAS crudas de cada pagina (no filas ya fusionadas):
    izquierda y derecha se agrupan en filas de forma INDEPENDIENTE (cada
    lado con su propio rows_by_y), porque el PDF desalinea en y una columna
    respecto a la otra unos pocos px y una unica pasada de agrupado
    mezclaria filas de jornadas distintas entre lados. Arrastra el estado
    (jornada/fecha por lado) entre paginas, hasta encontrar el directorio de
    clubs. Devuelve (matches, (pagina, fila-fusionada) de inicio del
    directorio o None, warnings).

    La cobertura por jornada NO se valida aqui: una jornada con 1 (o mas)
    'DESCANSA' es normal y variable segun el calendario real (no siempre es
    exactamente T-1), asi que cualquier umbral fijo da falsos positivos. La
    validacion real de esta funcion es el invariante n*(n-1) del total de
    filas por grupo (round-robin ida+vuelta), que se comprueba en main()
    sobre el resultado ya completo."""
    matches = []
    warnings = []
    side_state = {'L': None, 'R': None}  # {'jornada':n,'date':ds,'used':set()}

    for pi, words in enumerate(pages_words):
        merged = rows_by_y(words)
        dir_ri = next((ri for ri, row in enumerate(merged) if is_directory_header_row(row)), None)
        cutoff_y = merged[dir_ri][0]['top'] if dir_ri is not None else None
        page_words = words if cutoff_y is None else [w for w in words if w['top'] < cutoff_y - 0.5]

        for side in ('L', 'R'):
            if lr_boundary is None:
                side_words = page_words if side == 'L' else []
            else:
                side_words = [w for w in page_words if (w['x0'] < lr_boundary) == (side == 'L')]
            for row in rows_by_y(side_words):
                jor = next((w for w in row if is_label(w, 'JORNADA', True)), None)
                if jor is not None:
                    rest = sorted((w for w in row if w['x0'] > jor['x1']), key=lambda w: w['x0'])
                    num = next((w for w in rest if w['text'].isdigit()), None)
                    ds = next((w for w in rest if DATE_RE.match(w['text'])), None)
                    if num and ds:
                        side_state[side] = {'jornada': int(num['text']), 'date': ds['text'], 'used': set()}
                    else:
                        warnings.append(f'pagina {pi + 1} lado {side}: cabecera JORNADA sin numero/fecha')
                    continue
                st = side_state[side]
                if st is None:
                    continue
                if not row[0]['text'].isdigit() or not any(letters(w['text']) for w in row):
                    continue
                res = split_main_row(row, teams, st['used'])
                if res is None:
                    continue
                matches.append((st['jornada'], st['date'], res[0], res[1]))

        if dir_ri is not None:
            return matches, (pi, dir_ri), warnings

    return matches, None, warnings


# --- directorio de clubs (ultima pagina; best-effort, enriquece CLUB) ---

DIRECTORY_LABELS = {'NOMBRE', 'POBLACION', 'DIA', 'COLOR', 'DIRECCION', 'TELEF'}


def parse_directory(pages_words, start):
    """Heuristica simple: cada club ocupa 2 filas (superior con NOMBRE CLUB,
    inferior con NOMBRE EQUIPO, marcada por un valor HH:MM de HORA). Un club
    cuyo nombre/direccion envuelve a mas de 2 lineas no se resuelve aqui (se
    pierde en silencio); aguas abajo se repite el nombre de equipo."""
    club_by_sig = {}
    start_page, start_row = start
    name_hi = None
    header_seen = 0
    prev_row = None
    for pi in range(start_page, len(pages_words)):
        rows = rows_by_y(pages_words[pi])
        row_iter = rows[start_row:] if pi == start_page else rows
        for row in row_iter:
            if name_hi is None:
                if is_directory_header_row(row):
                    anchors = find_anchors(row, DIRECTORY_LABELS)
                    bounds = column_ranges(anchors)
                    if 'NOMBRE' in bounds:
                        name_hi = bounds['NOMBRE'][1]
                    header_seen += 1
                continue
            if header_seen < 2 and is_directory_header_row(row):
                header_seen += 1
                continue
            has_hora = any(HORA_RE.match(w['text']) for w in row)
            if has_hora and prev_row is not None:
                club = ' '.join(w['text'] for w in prev_row if w['x0'] < name_hi).strip()
                equipo = ' '.join(w['text'] for w in row if w['x0'] < name_hi).strip()
                sig = letters(equipo)
                if sig and club:
                    club_by_sig[sig] = club
                prev_row = None
            else:
                prev_row = row
    return club_by_sig


# --- ensamblado por PDF ---

def match_date(jornada_date_str, dia):
    m = DATE_RE.match(jornada_date_str)
    if not m:
        return ''
    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    if dia == 'S':
        d = d - timedelta(days=1)
    return d.strftime('%d/%m/%Y')


def process(path):
    doc = fitz.open(path)
    pages_words = [get_words(p) for p in doc]
    page_width = doc[0].rect.width
    doc.close()

    page0_rows = rows_by_y(pages_words[0])
    meta = parse_meta(page0_rows)
    teams, roster_end_idx, roster_warns = parse_roster(page0_rows)
    lr_boundary = derive_lr_boundary(pages_words, page_width)

    # arranca el parseo de emparejamientos justo tras la tabla de equipos
    # (por y, no por fila fusionada: cada lado se reagrupa de forma
    # independiente dentro de parse_pairing); dir_start (si hay) queda
    # indexado sobre esta misma lista recortada, asi que parse_directory
    # puede reutilizarla directamente.
    roster_end_y = page0_rows[roster_end_idx][0]['top'] if roster_end_idx < len(page0_rows) else 1e9
    pairing_words = [[w for w in pages_words[0] if w['top'] >= roster_end_y]] + pages_words[1:]
    matches, dir_start, warns = parse_pairing(pairing_words, teams, lr_boundary)
    warns = roster_warns + warns

    club_by_sig = {}
    if dir_start is not None:
        club_by_sig = parse_directory(pairing_words, dir_start)

    rows = []
    seen_ids = set()
    empty_team_rows = 0
    empty_campo_rows = 0
    bad_date_rows = 0
    same_name_rows = 0
    for jn, ds, ls, aw in matches:
        loc, vis = teams.get(ls), teams.get(aw)
        if not loc or not vis:
            empty_team_rows += 1
            continue
        fecha = match_date(ds, loc['dia'])
        if not fecha:
            bad_date_rows += 1
        if not loc['campo']:
            empty_campo_rows += 1
        if loc['name'] == vis['name']:
            same_name_rows += 1
        club_loc = club_by_sig.get(ls, loc['name'])
        club_vis = club_by_sig.get(aw, vis['name'])
        ident = '-'.join([
            slugify(meta['categoria']), slugify(meta['grupo']), f'j{jn:02d}',
            ds.replace('/', ''), slugify(loc['name']), slugify(vis['name']),
        ])
        if ident in seen_ids:
            warns.append(f'IDENTIFICADOR duplicado dentro del PDF: {ident}')
            continue
        seen_ids.add(ident)
        rows.append({
            'CATEGORIA': meta['categoria'], 'FASE': meta['fase'], 'GRUPO': meta['grupo'],
            'JORNADA': str(jn), 'CLUB_L': club_loc, 'EQ_LOCAL': loc['name'],
            'CLUB_V': club_vis, 'EQ_VISITANTE': vis['name'], 'FECHA': fecha,
            'HORA': loc['hora'], 'CAMPO': loc['campo'], 'DIRECCION': loc['direccion'],
            'POBLACION': loc['poblacion'], 'IDENTIFICADOR': ident,
        })

    stats = {
        'equipos': len(teams), 'partidos': len(rows), 'clubs_resueltos': len(club_by_sig),
        'empty_team_rows': empty_team_rows, 'empty_campo_rows': empty_campo_rows,
        'bad_date_rows': bad_date_rows, 'same_name_rows': same_name_rows,
    }
    return meta, rows, warns, stats


def md5_of(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()


def to_cp1252(text):
    """cp1252 cubre practicamente todo el espanol (incl. n con tilde, acentos,
    u con dieresis); solo translitera si aparece algo realmente fuera de ese
    rango, para no reventar nunca la escritura del CSV."""
    try:
        text.encode('cp1252')
        return text
    except UnicodeEncodeError:
        norm = unicodedata.normalize('NFKD', text)
        norm = ''.join(c for c in norm if not unicodedata.combining(c))
        return norm.encode('cp1252', errors='replace').decode('cp1252')


def read_written_csv(path):
    """Relee de disco el CSV que este mismo script acaba de escribir (no la
    lista en memoria): sin comillas que entrecomillen campos (mismo formato
    que consume parseCalendarCsv.ts), asi que separar por ';' es exacto."""
    with open(path, 'r', encoding='cp1252', newline='') as f:
        lines = [l.rstrip('\r\n') for l in f]
    header = lines[0].split(';')
    return [dict(zip(header, line.split(';'))) for line in lines[1:] if line]


def main():
    paths = (sorted(glob.glob('partidos_calendarios/primera_tanda/*.pdf')) +
             sorted(glob.glob('partidos_calendarios/segunda_tanda/*.pdf')))
    seen_hash = {}
    unique_paths = []
    for p in paths:
        h = md5_of(p)
        if h in seen_hash:
            continue
        seen_hash[h] = p
        unique_paths.append(p)

    print(f'PDF totales: {len(paths)}  unicos (md5): {len(unique_paths)}')

    all_rows = []
    categories = {}
    exceptions = []
    total_stats = {'empty_team_rows': 0, 'empty_campo_rows': 0, 'bad_date_rows': 0,
                   'clubs_resueltos': 0, 'same_name_rows': 0}
    all_warnings = []
    group_stats = []  # (path, categoria, fase, grupo, equipos, partidos)
    for path in unique_paths:
        try:
            meta, rows, warns, stats = process(path)
        except Exception as e:
            exceptions.append((path, repr(e)))
            continue
        categories[meta['categoria']] = categories.get(meta['categoria'], 0) + 1
        all_rows.extend(rows)
        all_warnings.extend(f'{path}: {w}' for w in warns)
        for k in total_stats:
            if k in stats:
                total_stats[k] += stats[k]
        group_stats.append((path, meta['categoria'], meta['fase'], meta['grupo'],
                             stats['equipos'], stats['partidos']))

    # orden estable e independiente del orden de iteracion del filesystem
    all_rows.sort(key=lambda r: r['IDENTIFICADOR'])

    # colisiones de IDENTIFICADOR
    ids = [r['IDENTIFICADOR'] for r in all_rows]
    id_counts = {}
    for i in ids:
        id_counts[i] = id_counts.get(i, 0) + 1
    dups = {i: c for i, c in id_counts.items() if c > 1}

    out_path = 'calendario_temporada_fbm.csv'
    cols = ['CATEGORIA', 'FASE', 'GRUPO', 'JORNADA', 'CLUB_L', 'EQ_LOCAL', 'CLUB_V',
            'EQ_VISITANTE', 'FECHA', 'HORA', 'CAMPO', 'DIRECCION', 'POBLACION', 'IDENTIFICADOR']
    with open(out_path, 'w', encoding='cp1252', errors='replace', newline='') as f:
        f.write(to_cp1252(CSV_HEADER) + '\r\n')
        for r in all_rows:
            line = ';'.join(r[c] for c in cols)
            f.write(to_cp1252(line) + '\r\n')

    # --- informe ---
    print(f'\nCSV escrito: {out_path}')
    print(f'Excepciones no capturadas: {len(exceptions)}')
    for p, e in exceptions:
        print(f'  ! {p}: {e}')
    print(f'\nFilas totales: {len(all_rows)}')
    print(f'IDENTIFICADOR duplicados: {len(dups)}')
    for i, c in list(dups.items())[:20]:
        print(f'  ! {i}  x{c}')
    print(f'Categorias distintas: {len(categories)}')
    for cat, n in sorted(categories.items(), key=lambda x: (-x[1], str(x[0]))):
        print(f'  {n:3d}  {cat!r}')
    print(f'\nFilas con equipo local/visitante vacio (descartadas): {total_stats["empty_team_rows"]}')
    print(f'Filas con campo/pabellon vacio: {total_stats["empty_campo_rows"]}')
    print(f'Filas con fecha invalida: {total_stats["bad_date_rows"]}')
    print(f'Filas con EQ. LOCAL == EQ. VISITANTE: {total_stats["same_name_rows"]}')
    print(f'Clubs resueltos via directorio (ultima pagina): {total_stats["clubs_resueltos"]}')

    by_date = Counter(r['FECHA'] for r in all_rows)
    print(f'\nFechas distintas: {len(by_date)}')
    for d, n in sorted(by_date.items(), key=lambda x: (-x[1], x[0]))[:10]:
        print(f'  {n:4d}  {d}')

    # invariante n*(n-1): una liga a doble vuelta con n equipos SIEMPRE
    # produce exactamente n*(n-1) partidos (cada pareja juega ida y vuelta).
    # A diferencia de una tolerancia de cobertura por jornada, este invariante
    # no depende de cuantos 'DESCANSA' haya por jornada (variable y normal) y
    # detecta tanto deficit como EXCESO (exceso = identidades de equipo
    # colapsadas: el grupo parece tener menos equipos de los que tiene de
    # verdad).
    exact_n = under_n = over_n = 0
    for path, cat, fase, grupo, n, got in group_stats:
        expected = n * (n - 1)
        if got == expected:
            exact_n += 1
        elif got < expected:
            under_n += 1
            print(f'  ! DEFICIT  {n} equipos, {got} filas (max {expected})  '
                  f'{cat} | {fase} | {grupo}  [{path}]')
        else:
            over_n += 1
            print(f'  ! EXCESO   {n} equipos, {got} filas (max {expected})  '
                  f'{cat} | {fase} | {grupo}  [{path}]')
    print(f'\nInvariante n*(n-1) por identidad interna: {exact_n} exactos / {under_n} por debajo / '
          f'{over_n} por encima (total {len(group_stats)})')

    # El invariante de arriba cuenta identidades internas (la firma que usa
    # match_team), que no es necesariamente lo que ve la app: dos equipos
    # cuyo PDF de origen los imprime con el mismo texto exacto (sin letra, sin
    # ano, sin ninguna marca -- ver desambiguacion por posicion en
    # parse_roster) son identidades distintas puertas adentro, pero si
    # salieran con el mismo nombre en el CSV la app los veria como un unico
    # equipo igualmente. Por eso este invariante releE EL PROPIO CSV ya
    # escrito en disco -no la lista en memoria- y cuenta NOMBRES EMITIDOS:
    # es la comprobacion que de verdad valida lo que consume el importador.
    written_rows = read_written_csv(out_path)
    emitted_groups = {}
    for r in written_rows:
        key = (r['CATEGORÍA'], r['FASE'], r['GRUPO'])
        g = emitted_groups.setdefault(key, {'names': set(), 'rows': 0})
        g['names'].add(r['EQ. LOCAL'])
        g['names'].add(r['EQ. VISITANTE'])
        g['rows'] += 1

    exact_e = under_e = over_e = 0
    for (cat, fase, grupo), g in emitted_groups.items():
        n = len(g['names'])
        expected = n * (n - 1)
        if g['rows'] == expected:
            exact_e += 1
        elif g['rows'] < expected:
            under_e += 1
            print(f'  ! DEFICIT (nombres emitidos)  {n} nombres, {g["rows"]} filas '
                  f'(max {expected})  {cat} | {fase} | {grupo}')
        else:
            over_e += 1
            print(f'  ! EXCESO  (nombres emitidos)  {n} nombres, {g["rows"]} filas '
                  f'(max {expected})  {cat} | {fase} | {grupo}')
    print(f'\nInvariante n*(n-1) sobre nombres emitidos (relee {out_path} de disco): '
          f'{exact_e} exactos / {under_e} por debajo / {over_e} por encima '
          f'(total {len(emitted_groups)})')

    print(f'\nWarnings de parseo: {len(all_warnings)} (mostrando 20)')
    for w in all_warnings[:20]:
        print(f'  ! {w}')


if __name__ == '__main__':
    main()
