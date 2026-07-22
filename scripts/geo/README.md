# Pipeline de geolocalización real (OSM)

Genera, **una sola vez y de forma reanudable**, datos geográficos reales para la app:

- **Direcciones reales de personas** por municipio (calle + nº + CP + lat/lon de OSM),
  consumidas por `apps/web/src/lib/referee-roster.ts#pickRealAddress`.
- **Coordenadas reales de pabellones** (venues), consumidas por `mock-data.ts` al ensamblar
  `mockVenues` vía lookup.

Todo el pipeline es offline (scripts Node `.mjs`, sin dependencias del bundle). Las salidas
consumibles se commitean; la caché cruda no (ver `.gitignore`).

## Fuentes

- **Overpass API** (límites administrativos + nodos de dirección). Mirrors con reintentos y
  backoff; los municipios grandes (Madrid) pueden dar 504 y reintentar por mirror.
- **Nominatim** (geocode de venues por dirección/nombre, máx. 1 req/seg, User-Agent identificativo).

## Orden de ejecución

Desde la raíz del repo:

```bash
# 0. (si cambian los venues/municipios en la app) regenerar inputs
node scripts/geo/extract-venues.mjs          # → venues-all.json (demoVenues + fbm-seed.venues)

# --- Track A: direcciones de personas ---
node scripts/geo/fetch-boundaries-bulk.mjs   # → cache/boundaries/<id>.json (límites admin, 1 query)
node scripts/geo/fetch-overpass.mjs addresses # → cache/raw/<id>.json (nodos addr por bbox)
node scripts/geo/build-address-dataset.mjs   # → apps/web/src/lib/data/addresses-cm.json

# --- Track B: coordenadas de venues ---
node scripts/geo/geocode-venues.mjs          # → cache/nominatim/<id>.json (lat/lon por venue)
node scripts/geo/merge-venue-coords.mjs      # → apps/web/src/lib/data/venue-coords.json
```

`build-address-dataset.mjs` filtra los nodos al polígono real del municipio
(`point-in-polygon.mjs`, mismo criterio que la verificación de coherencia) y recorta a
`MAX_PER_MUNI=600` por municipio (determinista, orden por id de nodo OSM). `merge-venue-coords.mjs`
cae al **centroide del municipio** (de `addresses-cm.json`) para los venues que Nominatim no
resuelve, de modo que ningún venue queda sin coordenada.

## Reanudable

Todos los pasos saltan lo ya cacheado (1 fichero por municipio/venue). Si un fetch se corta por
rate-limit, se vuelve a lanzar el mismo comando y continúa donde estaba. `fetch-overpass.mjs`
acepta fase: `boundaries` | `addresses` (sin argumento hace las dos).

## Salidas consumibles (commiteadas)

- `apps/web/src/lib/data/addresses-cm.json` — `{ muniId: { centroid, points: [{street,number,postalCode,lat,lon}] } }`
- `apps/web/src/lib/data/venue-coords.json` — `{ venueId: { lat, lon, approx? } }` (`approx` = centroide)

## Inputs pequeños (commiteados)

- `municipalities.json` — `{ id, name }[]` de los municipios con actividad FBM.
- `venues-all.json` — `{ id, name, address, municipalityId, municipalityName }[]` (394 venues).

## Caché cruda (NO commiteada, `.gitignore`)

- `cache/boundaries/`, `cache/raw/`, `cache/nominatim/` — dumps OSM intermedios (MB), regenerables.
- `*.log` — logs de las corridas de fetch.
