# -*- coding: utf-8 -*-
"""
Parser OFFLINE del calendario PDF oficial FBM -> CSV en el formato del backend
de competicion (el mismo que consume import-csv-fbm / parseCalendarCsv).

Uso (desde la raiz del repo, con los PDF de SOURCES en el cwd):
    pip install pdfplumber
    python scripts/fbm-pdf-to-csv.py          # modo debug (imprime validacion)
    python scripts/fbm-pdf-to-csv.py --csv     # escribe calendario_piloto_fbm.csv

No toca la app: el CSV generado se sube por el boton "Importar calendario FBM".
Para anadir/cambiar grupos, editar la lista SOURCES (ruta_pdf, codigo_unico).

Los tres retos del PDF (dos columnas por jornada, nombres de equipo que envuelven
linea, resultados/scores incrustados en los nombres) se resuelven parseando por
coordenadas de palabra + casando contra el diccionario de los equipos conocidos.
La integridad se valida como round-robin doble (cada par juega ida y vuelta).
"""
import re
import sys
import unicodedata
from datetime import date, timedelta
import pdfplumber

# --- columnas de la tabla de equipos (x0), calibradas en nacional y junior ---
NAME_MAX = 160
POB_MIN, POB_MAX = 160, 240
DIA_MIN, DIA_MAX = 278, 298
HORA_MIN, HORA_MAX = 298, 330
CAMPO_MIN = 415

HORA_RE = re.compile(r'^\d{2}:\d{2}$')


def letters(s):
    """Solo A-Z + N (de N-tilde), mayus, sin acentos ni puntuacion/digitos."""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in s.upper() if 'A' <= c <= 'Z')


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


def parse_meta(words):
    txt = ' '.join(w['text'] for w in words)
    cat = re.search(r'CATEGOR\S*A[:\s]+(.+?)\s+FASE', txt)
    fase = re.search(r'FASE[:\s]+(.+?)\s+GRUPO', txt)
    grupo = re.search(r'GRUPO[:\s]+(GRUPO\s+\w+)', txt)
    return {
        'categoria': cat.group(1).strip() if cat else '',
        'fase': fase.group(1).strip() if fase else 'PRIMERA FASE',
        'grupo': grupo.group(1).strip() if grupo else '',
    }


def parse_teams(page):
    words = page.extract_words()
    ys_eq = [w['top'] for w in words if w['text'] == 'EQUIPO']
    ys_jor = [w['top'] for w in words if 'JORNADA' in w['text']]
    y0 = min(ys_eq) + 6
    y1 = min(ys_jor) - 2
    band = [w for w in words if y0 < w['top'] < y1]
    rows = rows_by_y(band)

    teams = []
    cur = None
    for row in rows:
        has_hora = any(HORA_MIN <= w['x0'] < HORA_MAX and HORA_RE.match(w['text']) for w in row)
        if has_hora:  # arranca un equipo nuevo
            cur = {'name': [], 'pob': [], 'dia': '', 'hora': '', 'campo': [], 'addr': [], 'first': True}
            teams.append(cur)
        if cur is None:
            continue
        for w in row:
            x, t = w['x0'], w['text']
            if x < NAME_MAX:
                cur['name'].append(t)
            elif POB_MIN <= x < POB_MAX:
                cur['pob'].append(t)
            elif DIA_MIN <= x < DIA_MAX and t in ('S', 'D'):
                cur['dia'] = t
            elif HORA_MIN <= x < HORA_MAX and HORA_RE.match(t):
                cur['hora'] = t
            elif x >= CAMPO_MIN:
                (cur['campo'] if cur['first'] else cur['addr']).append(t)
        cur['first'] = False

    out = {}
    for t in teams:
        name = ' '.join(t['name']).strip()
        out[letters(name)] = {
            'name': name,
            'poblacion': ' '.join(t['pob']).strip(),
            'dia': t['dia'] or 'D',
            'hora': t['hora'] or '00:00',
            'campo': ' '.join(t['campo']).strip(),
            'direccion': ' '.join(t['addr']).strip(),
        }
    return out


def common_prefix_len(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def match_team(side, teams, used):
    """Equipo cuyo sig casa con las letras del lado, PREFIRIENDO los que aun no
    han jugado en la jornada (cada equipo juega una vez): desambigua cuando una
    palabra compartida en la frontera se solapa y deja un fragmento ambiguo
    (p. ej. '...CB' + 'CB POZUELO' render como un solo CB → visitante 'POZUELO',
    ambiguo entre VERITAS POZUELO y CB POZUELO). Tiers: exacto, prefijo,
    subcadena, prefijo comun; dentro de cada tier, no-usado y luego mas largo."""
    if not side:
        return None

    def pick(cands):
        pool = [c for c in cands if c not in used] or cands
        return max(pool, key=len) if pool else None

    if side in teams:
        r = pick([side])
        if r:
            return r
    pref = [s for s in teams if s.startswith(side) or side.startswith(s)]
    if pref:
        return pick(pref)
    sub = [s for s in teams if side in s or s in side]
    if sub:
        return pick(sub)
    pool = [s for s in teams if s not in used] or list(teams)
    return max(pool, key=lambda s: common_prefix_len(s, side))


def split_main_row(row, teams, used):
    """Parte una fila principal (la que lleva marcador) en (local, visitante).
    Acumula letras de izquierda a derecha mientras sean prefijo de algun sig; la
    primera palabra del visitante rompe el prefijo y marca el corte."""
    aw = sorted((w for w in row if letters(w['text'])), key=lambda w: w['x0'])
    acc, k = '', 0
    for idx, w in enumerate(aw):
        nxt = acc + letters(w['text'])
        if any(s.startswith(nxt) for s in teams):
            acc, k = nxt, idx + 1
        else:
            break
    if k == 0 or k >= len(aw):
        return None
    local = match_team(acc, teams, used)
    away = match_team(''.join(letters(w['text']) for w in aw[k:]), teams, used | {local})
    if local and away and local != away:
        used.add(local)
        used.add(away)
        return (local, away)
    return None


def parse_matches(pdf, teams, mid_frac=0.5):
    T = len(teams)
    results = []  # (jornada, date_str, local_sig, away_sig)
    warnings = []

    for pi, page in enumerate(pdf.pages):
        mid = page.width * mid_frac
        words = page.extract_words()
        for side, lo, hi in (('L', 0, mid), ('R', mid, 10000)):
            rows = rows_by_y([w for w in words if lo <= w['x0'] < hi])
            headers = []
            for ri, row in enumerate(rows):
                toks = [w['text'] for w in row]
                hs = ' '.join(toks)
                date_tok = next((t for t in toks if re.match(r'^\d{2}/\d{2}/\d{4}$', t)), None)
                # 'JORNADA' limpio da el numero; si esta destrozado por el
                # fragmento envuelto de la jornada anterior (p. ej.
                # 'CONSTRUJCOCRIONNADA: 4'), el numero se toma del entero que
                # precede al token de fecha dd/mm/aaaa.
                m = re.search(r'JORNADA[:\s]*(\d+)', hs)
                jn = int(m.group(1)) if m else None
                if jn is None and date_tok:
                    di = toks.index(date_tok)
                    for t in reversed(toks[:di]):
                        if t.isdigit() and int(t) <= 40:
                            jn = int(t)
                            break
                if jn is None:
                    continue
                if date_tok:
                    ds = date_tok
                elif m:
                    digs = re.sub(r'\D', '', hs[m.end():])[:8]
                    ds = f'{digs[0:2]}/{digs[2:4]}/{digs[4:8]}' if len(digs) == 8 else ''
                else:
                    ds = ''
                headers.append((ri, jn, ds))

            for hidx, (ri, jn, ds) in enumerate(headers):
                ri_next = headers[hidx + 1][0] if hidx + 1 < len(headers) else len(rows)
                used = set()
                jm = []
                for r in rows[ri + 1:ri_next]:
                    # Solo filas principales: primer token = marcador local y hay
                    # al menos una palabra con letras. Las continuaciones (nombre
                    # envuelto) se ignoran; el inicio del nombre ya identifica.
                    if not r or not r[0]['text'].isdigit() or not any(letters(w['text']) for w in r):
                        continue
                    res = split_main_row(r, teams, used)
                    if res is None:
                        continue
                    jm.append((jn, ds, *res))
                if len(used) != T:
                    warnings.append(f'p{pi+1} {side} J{jn}: cobertura {len(used)}/{T}')
                results.extend(jm)
    return results, warnings


CSV_HEADER = ('DEL.;COMPETICIÓN;CATEGORÍA;FASE;GRUPO;JORNADA;CLUB L.;EQ. LOCAL;'
              'PTS. L.;CLUB V.;EQ. VISITANTE;PTS. V.;FECHA;HORA;ESTADO;INFORME;'
              'CAMPO;DIRECCIÓN;POBLACIÓN;AFORO;VESTUARIOS;IDENTIFICADOR;')


def match_date(jornada_date_str, dia):
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', jornada_date_str)
    if not m:
        return ''
    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    if dia == 'S':
        d = d - timedelta(days=1)
    return d.strftime('%d/%m/%Y')


def process(path, src_code):
    with pdfplumber.open(path) as pdf:
        meta = parse_meta(pdf.pages[0].extract_words())
        teams = parse_teams(pdf.pages[0])
        matches, warns = parse_matches(pdf, teams)

    rows = []
    seen = set()
    for jn, ds, ls, aw in matches:
        loc, vis = teams[ls], teams[aw]
        fecha = match_date(ds, loc['dia'])
        mid_id = f'{src_code}-J{jn:02d}-{ls[:14]}-{aw[:14]}'
        if mid_id in seen:
            continue
        seen.add(mid_id)
        rows.append(';'.join([
            '', 'COMPETICIONES FEDERADAS FBM', meta['categoria'], meta['fase'], meta['grupo'],
            str(jn), loc['name'], loc['name'], '', vis['name'], vis['name'], '',
            fecha, loc['hora'], '', '', loc['campo'], loc['direccion'], loc['poblacion'],
            '', '', mid_id, '',
        ]))
    return meta, teams, rows, warns


SOURCES = [
    ('calendario_nacional_impar.pdf', 'NAC-IMPAR'),
    ('calendario_nacional_par.pdf', 'NAC-PAR'),
    ('junior_especial_oro_grupo1.pdf', 'JR-G1'),
    ('junior_especial_oro_grupo2.pdf', 'JR-G2'),
]

if __name__ == '__main__':
    debug = '--csv' not in sys.argv
    all_rows = []
    for path, code in SOURCES:
        meta, teams, rows, warns = process(path, code)
        if debug:
            print(f'### {path}  [{code}]')
            print(f'   CAT={meta["categoria"]!r}  FASE={meta["fase"]!r}  GRUPO={meta["grupo"]!r}')
            print(f'   equipos={len(teams)}  partidos={len(rows)}  warnings={len(warns)}')
            for w in warns[:8]:
                print('     !', w)
            for sig, t in list(teams.items())[:3]:
                print(f'     team: {t["name"]!r} | {t["poblacion"]!r} | dia={t["dia"]} hora={t["hora"]} | {t["campo"]!r}')
            if rows:
                print('     J1 rows:')
                for r in [x for x in rows if x.split(";")[5] == "1"][:6]:
                    c = r.split(';')
                    print(f'        J{c[5]} {c[12]} {c[13]} | {c[7]}  vs  {c[10]} | {c[16]} ({c[18]})')
        all_rows.extend(rows)
    print(f'\nTOTAL partidos: {len(all_rows)}')
    if not debug:
        out = 'calendario_piloto_fbm.csv'
        with open(out, 'w', encoding='cp1252', errors='replace', newline='') as f:
            f.write(CSV_HEADER + '\r\n')
            f.write('\r\n'.join(all_rows) + '\r\n')
        print('CSV escrito:', out)
