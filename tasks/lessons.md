# Lecciones — Sistema de Designaciones FBM

> Tope 30 líneas (§3 CLAUDE.md). Lo desplazado vive en `lessons-archive.md`.

## Normativa oficial antes de sintetizar datos de dominio

- **Regla:** si hay que inventar un dato de dominio (horarios, tarifas, nº de árbitros), buscar primero el documento normativo del cliente y preguntarle por él.
- **Why:** propuse sintetizar horarios "por categoría" a ojo; las Bases Generales FBM ya traían franja horaria, nº de árbitros/mesa por categoría y la equivalencia patrocinador→categoría (Liga Ginos = 1ª Autonómica). Lo inventado habría sido plausible y falso.
- **How to apply:** ofrecer la síntesis como plan B, no como plan A. Preguntar "¿hay bases/reglamento/tarifario?" antes de generar. Ver [[cost-model]].

## Ni un informe en verde ni una cifra extrapolada son una medición

- **Regla:** re-medir el criterio de aceptación de forma independiente, con volumen de producción, proceso frío y un invariante propio. Si la premisa de un plan es un número, el primer paso del plan es re-medirlo.
- **Why:** tres fallos reales sobrevivieron a informes de subagente en verde (identidades de equipo fundidas, un cuadrático `partidos × designaciones`, un solver lento con datos reales): los tests pasaban con seed pequeño. Y al revés, se planificó una tanda entera contra un solver "de 4,5-7 min por jornada" que nunca se midió — medido de verdad, ~9-21 s.
- **How to apply:** `verify:bundle` en CI; `performance.now()` sobre el seed real, nunca sobre el generador sintético. Y mantén `MEMORY.md` en sync con el cuerpo del fichero: un índice desactualizado hizo perseguir el fantasma de los "4-7 min" tres veces. Ver [[import-temporada-completa]].

## Reglas de dominio dictadas en prosa: parsearlas CON el usuario

- **Regla:** al traducir una descripción en prosa a una matriz o restricción, presentar los deltas "lo que dices vs lo que hace el código" en tabla y hacer elegir en bloque. Si dice "está bien X aunque debería ser Y", modelar Y como preferencia soft, nunca como bloqueo.
- **Why:** "nacional pita especial 1ª aut fem, oro plata y bronce" admitía dos lecturas y la mía habría roto la exclusividad de 1ª autonómica; y tratar el "debería ser 1:45" como restricción dura habría tirado cobertura sin que él lo pidiera.
- **How to apply:** una AskUserQuestion multiSelect con los deltas rinde más que seis preguntas sueltas. Tras aplicar una regla parcial, buscar INVERSIONES: el 2ª bronce quedó menos restringido que oro/plata hasta preguntarlo. Ver [[referee-categories]].
