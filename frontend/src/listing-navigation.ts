export type RelatedListing = {
  id: string;
  reference?: string;
  type?: string;
  city: string;
  neighbourhood?: string;
  real?: boolean;
};

const normalized = (value: string | undefined) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cityName = (value: string) => normalized(value.replace(/\([^)]*\)/g, ''));
const isReal = (item: RelatedListing) => item.real === true && !item.id.startsWith('demo-');

// Only public listing fields are needed, so the build and browser can share this selection.
export function relatedListings<T extends RelatedListing>(item: T, items: readonly T[], limit = 3): T[] {
  const city = cityName(item.city);
  const neighbourhood = normalized(item.neighbourhood);
  const seen = new Set<string>();
  const score = (other: T) => {
    const sameCity = !!city && cityName(other.city) === city;
    return (item.type && other.type === item.type ? 8 : 0)
      + (sameCity ? 4 : 0)
      + (sameCity && neighbourhood && normalized(other.neighbourhood) === neighbourhood ? 2 : 0);
  };
  return items.filter(other => {
    const identity = other.reference || other.id;
    if (other.id === item.id || item.reference && other.reference === item.reference || isReal(other) !== isReal(item) || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)).slice(0, Math.max(0, Math.floor(limit)));
}
