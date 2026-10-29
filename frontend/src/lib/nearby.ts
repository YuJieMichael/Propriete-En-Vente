// Nearby everyday places from OpenStreetMap. scripts/prepare-nearby.mjs queries the
// Overpass API and saves one file per listing; data © OpenStreetMap contributors, ODbL.
export const nearbyRadius = 1500;
export const busRadius = 500;
export const nearbyCategories = ['transit', 'grocery', 'school', 'pharmacy', 'park', 'health'] as const;
export type NearbyCategory = typeof nearbyCategories[number];
export type NearbyPlace = {name: string; distance: number};
export type NearbySummary = {places: Partial<Record<NearbyCategory, NearbyPlace>>; busStops: number};
type Element = {lat?: number; lon?: number; center?: {lat: number; lon: number}; tags?: Record<string, string>};

export function overpassQuery(lat: number, lon: number) {
  const around = (radius: number) => `(around:${radius},${lat},${lon})`;
  const r = around(nearbyRadius);
  return `[out:json][timeout:20];(` +
    `nwr${r}[railway=station];nwr${r}[public_transport=station][subway=yes];` +
    `node${around(busRadius)}[highway=bus_stop];` +
    `nwr${r}[shop~"^(supermarket|greengrocer)$"];nwr${r}[amenity=school];nwr${r}[amenity=pharmacy];` +
    `nwr${r}[leisure=park][name];nwr${r}[amenity~"^(hospital|clinic|doctors)$"];` +
    `);out center tags qt;`;
}

export function category(tags: Record<string, string> = {}): NearbyCategory | 'bus' | null {
  if (tags.highway === 'bus_stop') return 'bus';
  if (tags.railway === 'station' || tags.public_transport === 'station') return 'transit';
  if (tags.shop === 'supermarket' || tags.shop === 'greengrocer') return 'grocery';
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.leisure === 'park') return 'park';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors') return 'health';
  return null;
}

/** Great-circle distance in metres. */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** The closest named place in each category, and the number of bus stops close by. */
export function summarize(lat: number, lon: number, elements: Element[]): NearbySummary {
  const places: NearbySummary['places'] = {};
  let busStops = 0;
  for (const element of elements) {
    const kind = category(element.tags);
    const point = element.center ?? (element.lat !== undefined && element.lon !== undefined ? {lat: element.lat, lon: element.lon} : null);
    if (!kind || !point) continue;
    const metres = distance(lat, lon, point.lat, point.lon);
    if (kind === 'bus') { if (metres <= busRadius) busStops++; continue; }
    const name = element.tags?.name?.trim();
    if (!name || metres > nearbyRadius) continue;
    if (!places[kind] || metres < places[kind]!.distance) places[kind] = {name, distance: Math.round(metres)};
  }
  return {places, busStops};
}

// About 80 m a minute is a relaxed walking pace.
export const walkingMinutes = (metres: number) => Math.max(1, Math.round(metres / 80));

export type NearbyFile = NearbySummary & {checked: string};
const cache = new Map<string, Promise<NearbyFile | null>>();
/** Saved by scripts/prepare-nearby.mjs; null when the listing has no saved file yet. */
export function loadNearby(reference: string): Promise<NearbyFile | null> {
  if (!/^\d{1,36}$/.test(reference)) return Promise.resolve(null);
  if (!cache.has(reference)) cache.set(reference, fetch(`/nearby/${reference}.json`).then(async response => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`nearby ${response.status}`);
    return await response.json() as NearbyFile;
  }).catch(error => { cache.delete(reference); throw error; }));
  return cache.get(reference)!;
}
