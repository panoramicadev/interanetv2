/**
 * Planificador de viaje: geocodificación, ruteo y detección de peajes.
 *
 * Portado tal cual de primerosresultados/rendicion-gastos (client/src/lib/viajes.ts).
 *
 * Usa servicios libres sin API key:
 *  - Nominatim (OpenStreetMap) para buscar direcciones → coordenadas.
 *  - OSRM público para la ruta en auto (distancia, duración, geometría).
 *  - Overpass (OpenStreetMap) para ubicar las casetas de peaje reales
 *    cercanas a la ruta. Los precios no están en OSM: se calculan con una
 *    tarifa configurable por el usuario (editable por peaje).
 *
 * Todas las llamadas son del lado cliente y respetan de sobra las políticas de
 * uso de cada servicio para el volumen de un equipo comercial.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Polilínea de la ruta como pares [lat, lon]. */
  coordinates: [number, number][];
}

export interface TollPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Distancia entre dos coordenadas en km (Haversine). */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Busca direcciones en Chile y devuelve hasta 5 candidatos. */
export async function geocode(query: string): Promise<GeoPoint[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${NOMINATIM}?format=jsonv2&countrycodes=cl&limit=5&accept-language=es&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("No se pudo buscar la dirección.");
  const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  return rows.map((r) => ({ lat: Number(r.lat), lon: Number(r.lon), label: r.display_name }));
}

/** Calcula la ruta en auto entre dos puntos. */
export async function getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error("No se pudo calcular la ruta.");
  const data = (await res.json()) as {
    code: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error("No se encontró una ruta entre esos puntos.");
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    // GeoJSON entrega [lon, lat]; lo damos vuelta a [lat, lon].
    coordinates: route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
  };
}

/** Reduce la polilínea a como máximo `max` puntos, repartidos parejo. */
function downsample(coords: [number, number][], max: number): [number, number][] {
  if (coords.length <= max) return coords;
  const paso = coords.length / max;
  const salida: [number, number][] = [];
  for (let i = 0; i < max; i++) salida.push(coords[Math.floor(i * paso)]);
  salida.push(coords[coords.length - 1]);
  return salida;
}

/** Índice del punto de la ruta más cercano a una coordenada. */
function nearestIndex(coords: [number, number][], lat: number, lon: number): number {
  let mejor = 0;
  let mejorD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineKm(coords[i][0], coords[i][1], lat, lon);
    if (d < mejorD) {
      mejorD = d;
      mejor = i;
    }
  }
  return mejor;
}

/**
 * Detecta casetas de peaje (barrier=toll_booth en OpenStreetMap) cercanas a la
 * ruta. Agrupa booths contiguos en una sola plaza (~0,6 km) para no contar dos
 * veces el mismo peaje.
 */
export async function findTollBooths(coords: [number, number][]): Promise<TollPoint[]> {
  if (coords.length === 0) return [];
  const muestreo = downsample(coords, 200);
  const alrededor = muestreo.map(([lat, lon]) => `${lat},${lon}`).join(",");
  const query = `[out:json][timeout:25];(node(around:250,${alrededor})["barrier"="toll_booth"];);out;`;

  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error("No se pudieron buscar los peajes.");
  const data = (await res.json()) as {
    elements: Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }>;
  };

  const casetas = data.elements
    .filter((e) => typeof e.lat === "number" && typeof e.lon === "number")
    .map((e) => ({
      id: String(e.id),
      lat: e.lat,
      lon: e.lon,
      name: e.tags?.name ?? e.tags?.["toll:name"] ?? "Peaje",
    }));

  // Ordenar por avance sobre la ruta para presentarlos en orden de viaje.
  const ordenadas = casetas
    .map((c) => ({ c, idx: nearestIndex(coords, c.lat, c.lon) }))
    .sort((x, y) => x.idx - y.idx)
    .map((x) => x.c);

  // Agrupar plazas contiguas (varias casetas de una misma plaza).
  const agrupadas: TollPoint[] = [];
  for (const caseta of ordenadas) {
    const previa = agrupadas[agrupadas.length - 1];
    if (previa && haversineKm(previa.lat, previa.lon, caseta.lat, caseta.lon) < 0.6) {
      if (previa.name === "Peaje" && caseta.name !== "Peaje") previa.name = caseta.name;
      continue;
    }
    agrupadas.push({ ...caseta });
  }
  return agrupadas;
}
