// Ray-casting point-in-polygon sobre geometría de relación OSM (multipolígono
// admin_level=8). Solo considera anillos "outer" (los municipios de Madrid no
// tienen enclaves/agujeros relevantes a este nivel; si alguno los tuviera, el
// resultado sería un falso positivo ocasional, aceptable para datos mock).
//
// `rings`: array de anillos, cada uno array de [lon, lat].

export function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInMultiPolygon(lon, lat, outerRings) {
  return outerRings.some((ring) => pointInRing(lon, lat, ring))
}

// Extrae anillos "outer" (lon,lat) de una relation de Overpass con `out geom`.
//
// OJO: en OSM el límite de un municipio suele venir PARTIDO en varios `way`
// miembro "outer", cada uno una polilínea (segmento), NO un anillo cerrado. Hay
// que COSERLOS por extremos coincidentes (los nodos son compartidos, así que las
// coordenadas de unión son idénticas) hasta cerrar cada anillo. Tratar cada
// segmento como su propio anillo produce slivers y rompe el point-in-polygon
// (municipios con boundary multi-way daban ~0 direcciones dentro).
export function extractOuterRings(relation) {
  const segments = []
  for (const member of relation.members ?? []) {
    if (member.role !== 'outer' || !member.geometry) continue
    const pts = member.geometry.map((p) => [p.lon, p.lat])
    if (pts.length >= 2) segments.push(pts)
  }

  const key = ([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`
  const used = new Array(segments.length).fill(false)
  const rings = []

  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue
    used[s] = true
    let ring = [...segments[s]]
    // Extiende el anillo mientras no esté cerrado y encuentre un segmento cuyo
    // extremo coincida con el final actual (invirtiéndolo si hace falta).
    let extended = true
    while (extended && key(ring[0]) !== key(ring[ring.length - 1])) {
      extended = false
      const end = ring[ring.length - 1]
      for (let t = 0; t < segments.length; t++) {
        if (used[t]) continue
        const seg = segments[t]
        if (key(seg[0]) === key(end)) {
          ring = ring.concat(seg.slice(1))
          used[t] = true
          extended = true
          break
        }
        if (key(seg[seg.length - 1]) === key(end)) {
          ring = ring.concat([...seg].reverse().slice(1))
          used[t] = true
          extended = true
          break
        }
      }
    }
    rings.push(ring)
  }
  return rings
}

export function boundsOfRings(rings) {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  return { minLon, maxLon, minLat, maxLat }
}
