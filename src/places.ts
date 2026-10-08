export type Place = {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lon: number;
  km: number;
};

const CACHE_KEY = "moodtrail:places";
const FRESH_MS = 6 * 60 * 60 * 1000;

type Cached = { where: string; at: number; places: Place[] };

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function readCache(): Cached | null {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
}

// Nominatim is OpenStreetMap's search service. We ask for parks, then nature reserves, one second apart
// to respect its usage policy. (The public Overpass server was too often overloaded to depend on.)
async function search(term: string, lat: number, lon: number, radiusKm: number): Promise<Place[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const box = `${lon - dLon},${lat + dLat},${lon + dLon},${lat - dLat}`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=30&bounded=1` +
    `&q=${encodeURIComponent(term)}&viewbox=${box}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Place search returned ${res.status}`);
  const rows = await res.json();
  return rows.flatMap((r: any) => {
    if (!r.name) return [];
    const km = Math.round(distanceKm(lat, lon, Number(r.lat), Number(r.lon)) * 10) / 10;
    return [{ id: `${r.osm_type}/${r.osm_id}`, name: r.name, kind: r.type, lat: Number(r.lat), lon: Number(r.lon), km }];
  });
}

export async function findPlaces(lat: number, lon: number, radiusKm = 15): Promise<Place[]> {
  const where = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = readCache();
  if (cached?.where === where && Date.now() - cached.at < FRESH_MS) return cached.places;

  try {
    const parks = await search("park", lat, lon, radiusKm);
    await new Promise((r) => setTimeout(r, 1000));
    const reserves = await search("nature reserve", lat, lon, radiusKm);
    const all = [...reserves, ...parks].sort((a, b) => a.km - b.km);
    const places = all.filter((p, i) => all.findIndex((q) => q.name === p.name) === i).slice(0, 30);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ where, at: Date.now(), places } satisfies Cached));
    return places;
  } catch (err) {
    // Offline: an older list for this same spot is still useful.
    if (cached?.where === where) return cached.places;
    throw err;
  }
}

export function mapsUrl(p: Place) {
  const query = encodeURIComponent(`${p.name} ${p.lat},${p.lon}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
