// No free routing service allows commercial use, so drive time is estimated from
// straight-line distance: roads run about 1.35× longer, at about 55 km/h door to
// door, plus 3 minutes to get going. The page labels it as an estimate.
const detour = 1.35, speed = 55, startMinutes = 3;
export const commuteChoices = [15, 30, 45, 60] as const;
export type Anchor = {latitude: number; longitude: number};
export const estimatedMinutes = (km: number) => Math.round(startMinutes + km * detour / speed * 60);
/** The straight-line radius whose estimated drive time is the given number of minutes. */
export const commuteRadiusKm = (minutes: number) => Math.max(0, (minutes - startMinutes) * speed / 60 / detour);

/** Great-circle distance in kilometres. */
export function distanceKm(a: Anchor, b: Anchor) {
  const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function withinCommute<T extends Anchor>(points: T[], anchor: Anchor, minutes: number) {
  const limit = commuteRadiusKm(minutes);
  return points
    .map(point => {
      const km = distanceKm(anchor, point);
      return {point, km, minutes: estimatedMinutes(km)};
    })
    .filter(entry => entry.km <= limit)
    .sort((a, b) => a.km - b.km);
}
