# Lecciones — Sistema de Designaciones FBM

> Tope 30 líneas (§3 CLAUDE.md). Lo desplazado vive en `lessons-archive.md`.

## Normativa oficial antes de sintetizar datos de dominio

- **Regla:** si hay que inventar un dato de dominio (horarios, tarifas, nº de árbitros), buscar primero el documento normativo del cliente y preguntarle por él.
- **Why:** propuse sintetizar horarios "por categoría" a ojo; el usuario respondió que las Bases Generales FBM ya traen la franja horaria Y el nº de árbitros/mesa por categoría. Lo inventado habría sido plausible y falso. Las Bases resultaron traer además la equivalencia patrocinador→categoría (Liga Ginos = 1ª Autonómica), que si no se habría inferido a ojo.
- **How to apply:** ofrecer la síntesis como plan B, no como plan A. Preguntar "¿hay bases/reglamento/tarifario?" antes de generar. Ver [[cost-model]].

## Verificar el informe del subagente, no solo leerlo

- **Regla:** re-medir el criterio de aceptación de forma independiente antes de cerrar una tanda.
- **Why:** tres fallos reales sobrevivieron a informes en verde: 7 grupos con más partidos de los posibles (identidades de equipo fundidas), un cuadrático `partidos × designaciones` en una ruta, y un solver que tarda minutos con volumen real. Los tests pasaban con el seed pequeño. (2026-07-22: un pipeline de geo "en verde" generó direcciones de Madrid en Iowa; lo cazó un invariante propio de bbox, no el pipeline.)
- **How to apply:** los verdes con datos de juguete no dicen nada del caso real. Medir con volumen de producción y con un invariante propio, no con el del autor.

## Datos externos geográficos (OSM/geocoders): restringir la query y validar con bbox

- **Regla:** al generar datos desde una fuente externa por NOMBRE (Overpass, Nominatim), acotar la query a la región Y validar cada coordenada de salida contra un bbox de dominio como test permanente. El pipeline en verde NO garantiza datos correctos.
- **Why:** `rel["name"="Madrid"]` sin bbox trajo Madrid, IOWA (y Pinto→Argentina, Arroyomolinos→Cáceres): centroide y direcciones de la capital (45% del roster) en EE.UU., con los tests de consistencia en verde. Aparte: el límite OSM viene partido en varios `way` que hay que COSER en anillos (tratar cada segmento como anillo daba ~0 puntos dentro del polígono en municipios multi-way). Ver [[geo-pipeline]], [[import-temporada-completa]].
- **How to apply:** bbox de región en la query por nombre; test que exija el 100% de coords dentro del bbox de dominio (umbrales laxos ocultan homónimos); coser anillos multi-way; medir `inside≈raw` por municipio.

## Medir el problema ANTES de planificar su solución

- **Regla:** una cifra de rendimiento extrapolada no es una medición. Antes de planificar una optimización, medir el escenario real, con datos de producción, en proceso frío y mediana de 3.
- **Why:** dos veces, en direcciones opuestas. Al importar 75× el volumen, medir destapó problemas invisibles en verde (seed de 9,5 MB al bundle cliente, ruta de 21 MB). Y al revés: se planificó una tanda entera contra un solver "de 4,5-7 min por jornada" que nunca se midió; medido de verdad, 20,8 s de mediana, ya bajo el objetivo.
- **How to apply:** `verify:bundle` en CI tras el build; `performance.now()` sobre el seed real, nunca sobre el generador sintético. Si la premisa de un plan es un número, el primer paso del plan es re-medirlo. Ver [[import-temporada-completa]].
