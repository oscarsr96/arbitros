# Fase 4 — Tarifas oficiales de arbitraje (resolución de U1)

**Fuente**: Bases Generales FBM 2026/2027 (V. 16-06-2026), p.25, tabla
"DESGLOSE DE LOS DERECHOS DE ARBITRAJE PARA COMPETICIONES ORGANIZADAS POR LA FBM".
Importes en euros. Extraído y verificado (suma de columnas = Total) el 2026-07-24.

## Interpretación confirmada por el usuario (2026-07-24)

- La **liquidación es A LAS PERSONAS**: cada oficial cobra el importe de **su columna de rol**
  en ese partido (Arb. Ppal / Arb. Aux / Anotador / Crono / 24").
- **`Der. Comité` NO se paga a las personas** (es del Comité). El **`Total`** es lo que paga el
  club, no un honorario individual. Ambos quedan fuera de la liquidación a personas.
- **Minibasket (Alevín/Benjamín)**: la subvención de 10 € (p.26) reduce lo que paga el **club**
  (total a pagar 28,60 €), NO lo que cobra el oficial: el principal cobra 21,15 y el anotador 16,00.
- Honorario individual = **tarifa por categoría del partido × rol del slot** (NO por nivel/categoría
  del árbitro). Es un módulo NUEVO, separado del coste de desplazamiento (que no se toca).

## Tabla (22 categorías)

| Categoría (partido)                | Arb. Ppal | Arb. Aux | Anotador | Crono |   24" | Der. Comité | Total (club) |
| ---------------------------------- | --------: | -------: | -------: | ----: | ----: | ----------: | -----------: |
| 1ª Div. Nac. Masculina             |    111,60 |   111,60 |    31,80 | 30,80 | 30,80 |       27,50 |       344,10 |
| 1ª Div. Nac. Femenina              |     94,15 |    94,15 |    29,65 | 28,65 | 28,65 |       24,35 |       299,60 |
| Liga Universitaria                 |     36,80 |    36,80 |    26,60 | 25,60 |  0,00 |       54,20 |       180,00 |
| 1ª Div. Aut. Masculina "ORO"       |     50,25 |    50,25 |    36,75 | 35,75 |  0,00 |       21,70 |       194,70 |
| 1ª Div. Aut. Masculina "PLATA"     |     43,60 |    43,60 |    34,40 | 33,40 |  0,00 |       16,55 |       171,55 |
| 1ª Div. Aut. Femenina              |     39,15 |    39,15 |    29,50 | 28,50 |  0,00 |       16,35 |       152,65 |
| 2ª Div. Autonómica Masculina       |     36,75 |    36,75 |    26,50 | 25,50 |  0,00 |       14,30 |       139,80 |
| 2ª Div. Autonómica Femenina        |     30,75 |    30,75 |    24,20 | 23,20 |  0,00 |       12,80 |       121,70 |
| Sub-22 Masc. y Fem. ORO            |     30,35 |    30,35 |    23,90 | 22,90 |  0,00 |       12,60 |       120,10 |
| Sub-22 PLATA y BRONCE              |     27,05 |    27,05 |    21,60 | 20,60 |  0,00 |       12,00 |       108,30 |
| Junior ORO                         |     41,65 |    41,65 |    24,70 | 23,70 | 23,70 |       10,85 |       166,25 |
| Junior PLATA y BRONCE              |     25,80 |    25,80 |    21,60 | 20,60 |  0,00 |       11,10 |       104,90 |
| Junior de 1er. año                 |     22,85 |    22,85 |    23,60 |  0,00 |  0,00 |        7,00 |        76,30 |
| Junior Preferente                  |     22,85 |    22,85 |    23,60 |  0,00 |  0,00 |        7,00 |        76,30 |
| Cadete ORO                         |     24,20 |    24,20 |    22,65 | 21,65 | 21,65 |        9,50 |       123,85 |
| Cadete PLATA y BRONCE              |     22,85 |    22,85 |    21,60 | 20,60 |  0,00 |        9,50 |        97,40 |
| Infantil ORO                       |     21,15 |    21,15 |    20,60 | 19,60 | 19,60 |        8,25 |       110,35 |
| Infantil PLATA y BRONCE            |     21,15 |    21,15 |    20,30 | 19,30 |  0,00 |        8,25 |        90,15 |
| Cadete de 1er. año                 |     21,15 |    21,15 |    16,00 |  0,00 |  0,00 |        1,45 |        59,75 |
| Cadete Preferente                  |     21,15 |     0,00 |    16,00 |  0,00 |  0,00 |        1,45 |        38,60 |
| Infantil Pref. e Infantil 1er. año |     21,15 |     0,00 |    16,00 |  0,00 |  0,00 |        1,45 |        38,60 |
| Competiciones Minibasket           |     21,15 |     0,00 |    16,00 |  0,00 |  0,00 |        1,45 |        38,60 |

### Notas de estructura (relevantes para el modelado en 4.1)

- **Arb. Aux = 0,00** en Cadete Preferente, Infantil Pref./1er año y Minibasket → arbitraje simple
  (1 árbitro). Coherente con "TIPO DE ARBITRAJE" de la tabla de compensaciones (p.25 superior).
- **Columna 24" = 0,00** salvo en: 1ª Nac (M/F), Junior ORO, Cadete ORO, Infantil ORO → operador de
  24" solo se paga donde aplica.
- **Crono = 0,00** en Junior 1er año/Preferente y en las categorías de arbitraje simple.
- El mapeo categoría-del-partido → fila de esta tabla es la tarea **4.1.3** (fable/high): cruzar con
  las `BasesCategory` de `apps/web/src/lib/bases-fbm.ts`. Regla dura: si una categoría no mapea, el
  honorario es **`null` visible** (nunca 0 € silencioso).

## Estado de las decisiones del plan (Fase 4)

- **U1 — RESUELTA**: tarifas de esta tabla, interpretación confirmada arriba.
- **U2 — mes natural** (aprobada): "mensual" = mes de calendario.
- **U3 — export client-side** (aprobada): seguir con SheetJS + jsPDF ya operativos.
- **U4 — retirar `mockHistoricalMatchdays` demo** (aprobada).
- **U5 — jornadas a designar en 4.0.1**: propuesta 2025-10-25 + siguiente; archivar el JSON actual como `.bak`.
- **U6 — portal muestra honorarios además de desplazamiento** (aprobada, tras 4.1).
- **U7 — T6** (`distanceKm` persistidos del mock): fuera de scope de Fase 4 (el script one-off ya existe).
