export type PropertyType = "house" | "condo" | "plex" | "commercial";
export type Listing = {
  id: string;
  type: PropertyType;
  district: string;
  city: string;
  postal: string;
  aliases: string;
  price: number;
  beds: number | null;
  baths: number | null;
  area: number;
  date: string;
  mode: "owner" | "broker";
  parking: boolean;
  parkingSpaces?: number;
  streetParking?: boolean;
  outdoor: boolean;
  image: string;
  real?: boolean;
  photos?: string[];
  video?: string;
  description?: string;
  neighbourhood?: string;
};

// Fictional catalogue, isolated from private seller projects. Stock photos are illustrative.
const stock = (photo: string) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1100&q=85`;
export const listingFallback = `${import.meta.env.BASE_URL}propriete-en-vente-hero.png`;
const photos = {
  house: stock("photo-1600596542815-ffad4c1539a9"),
  garden: stock("photo-1600585154340-be6161a56a0c"),
  interior: stock("photo-1600607687920-4e2a09cf159d"),
  condo: stock("photo-1600566753086-00f18fb6b3ea"),
  family: stock("photo-1564013799919-ab600027ffc6"),
  plex: listingFallback,
};
export const listings: Listing[] = [
  { id: "demo-01", type: "condo", district: "Le Plateau-Mont-Royal", city: "Montréal", postal: "H2J", aliases: "montreal 蒙特利尔 蒙特婁 高原区", price: 549000, beds: 2, baths: 1, area: 1040, date: "2026-09-22", mode: "owner", parking: false, outdoor: true, image: photos.condo },
  { id: "demo-02", type: "house", district: "Sainte-Dorothée", city: "Laval", postal: "H7X", aliases: "拉瓦尔 拉瓦爾 laval", price: 849000, beds: 4, baths: 2, area: 2240, date: "2026-09-21", mode: "broker", parking: true, outdoor: true, image: photos.house },
  { id: "demo-03", type: "plex", district: "Rosemont–La Petite-Patrie", city: "Montréal", postal: "H1Y", aliases: "montreal 蒙特利尔 蒙特婁 罗斯蒙 罗兹蒙", price: 975000, beds: 3, baths: 1, area: 2860, date: "2026-09-20", mode: "owner", parking: true, outdoor: true, image: photos.plex },
  { id: "demo-04", type: "condo", district: "Griffintown", city: "Montréal", postal: "H3C", aliases: "montreal 蒙特利尔 蒙特婁 格里芬 市中心", price: 425000, beds: 1, baths: 1, area: 680, date: "2026-09-19", mode: "broker", parking: false, outdoor: false, image: photos.interior },
  { id: "demo-05", type: "house", district: "Secteur B", city: "Brossard", postal: "J4Z", aliases: "南岸 布罗萨尔 布rossard brossard", price: 729000, beds: 3, baths: 2, area: 1840, date: "2026-09-18", mode: "owner", parking: true, outdoor: true, image: photos.garden },
  { id: "demo-06", type: "commercial", district: "Vieux-Longueuil", city: "Longueuil", postal: "J4H", aliases: "longueuil 隆格伊 朗格伊 南岸", price: 645000, beds: null, baths: null, area: 1650, date: "2026-09-17", mode: "broker", parking: true, outdoor: false, image: photos.interior },
  { id: "demo-07", type: "condo", district: "Verdun", city: "Montréal", postal: "H4G", aliases: "montreal 蒙特利尔 蒙特婁 凡尔登 韦尔登", price: 619000, beds: 3, baths: 2, area: 1320, date: "2026-09-16", mode: "owner", parking: true, outdoor: true, image: photos.condo },
  { id: "demo-08", type: "house", district: "Pointe-Claire", city: "Montréal", postal: "H9R", aliases: "montreal 蒙特利尔 蒙特婁 西岛 西島 west island", price: 1150000, beds: 5, baths: 3, area: 3100, date: "2026-09-15", mode: "broker", parking: true, outdoor: true, image: photos.family },
  { id: "demo-09", type: "plex", district: "Villeray", city: "Montréal", postal: "H2R", aliases: "montreal 蒙特利尔 蒙特婁 维勒雷", price: 895000, beds: 2, baths: 1, area: 2400, date: "2026-09-14", mode: "broker", parking: false, outdoor: true, image: photos.plex },
  { id: "demo-10", type: "house", district: "Fabreville", city: "Laval", postal: "H7P", aliases: "laval 拉瓦尔 拉瓦爾", price: 589000, beds: 3, baths: 1, area: 1580, date: "2026-09-13", mode: "owner", parking: true, outdoor: true, image: photos.family },
  { id: "demo-11", type: "condo", district: "Saint-Hubert", city: "Longueuil", postal: "J3Y", aliases: "longueuil 隆格伊 朗格伊 南岸 圣于贝尔", price: 359000, beds: 2, baths: 1, area: 920, date: "2026-09-12", mode: "owner", parking: true, outdoor: false, image: photos.interior },
  { id: "demo-12", type: "commercial", district: "Chomedey", city: "Laval", postal: "H7T", aliases: "laval 拉瓦尔 拉瓦爾", price: 1290000, beds: null, baths: null, area: 4200, date: "2026-09-11", mode: "broker", parking: true, outdoor: false, image: photos.condo },
];

export type Filters = {
  q: string;
  type: "" | PropertyType;
  min: string;
  max: string;
  beds: string;
  baths: string;
  area: string;
  mode: "" | "owner" | "broker";
  parking: boolean;
  outdoor: boolean;
  sort: "newest" | "price-asc" | "price-desc" | "area-desc";
};
export const defaultFilters: Filters = { q: "", type: "", min: "", max: "", beds: "", baths: "", area: "", mode: "", parking: false, outdoor: false, sort: "newest" };
const numeric = (value: string | null) => value && /^\d{1,9}$/.test(value) ? value : "";
export const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function readFilters(hash: string): Filters {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash.replace(/^\?/, "");
  const params = new URLSearchParams(query);
  const type = params.get("type") ?? "";
  const mode = params.get("mode") ?? "";
  const sort = params.get("sort") ?? "";
  return {
    q: (params.get("q") ?? "").slice(0, 120),
    type: ["house", "condo", "plex", "commercial"].includes(type) ? type as Filters["type"] : "",
    mode: ["owner", "broker"].includes(mode) ? mode as Filters["mode"] : "",
    sort: ["price-asc", "price-desc", "area-desc"].includes(sort) ? sort as Filters["sort"] : "newest",
    min: numeric(params.get("min")), max: numeric(params.get("max")),
    beds: numeric(params.get("beds")), baths: numeric(params.get("baths")), area: numeric(params.get("area")),
    parking: params.get("parking") === "1", outdoor: params.get("outdoor") === "1",
  };
}
export function filterQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "sort" && value === "newest")) params.set(key, value === true ? "1" : String(value));
  }
  return params.size ? `?${params}` : "";
}
export function invalidPriceRange(filters: Filters) {
  return filters.min !== "" && filters.max !== "" && Number(filters.min) > Number(filters.max);
}
export function selectListings(items: Listing[], filters: Filters) {
  if (invalidPriceRange(filters)) return [];
  const query = normalizeSearch(filters.q);
  const tokens = query.split(/\s+/).filter(Boolean);
  const result = items.filter(item => {
    const searchable = normalizeSearch(`${item.city} ${item.district} ${item.postal} ${item.aliases}`);
    // A full Québec postal code can match the demo's three-character postal sector.
    const postalMatch = /^[a-z]\d[a-z](\s?\d[a-z]\d)?$/.test(query) && query.slice(0, 3) === item.postal.toLowerCase();
    return (!query || postalMatch || tokens.every(token => searchable.includes(token)))
      && (!filters.type || item.type === filters.type)
      && (!filters.min || item.price >= Number(filters.min))
      && (!filters.max || item.price <= Number(filters.max))
      && (!filters.beds || (item.beds !== null && item.beds >= Number(filters.beds)))
      && (!filters.baths || (item.baths !== null && item.baths >= Number(filters.baths)))
      && (!filters.area || item.area >= Number(filters.area))
      && (!filters.mode || item.mode === filters.mode)
      && (!filters.parking || item.parking || item.streetParking)
      && (!filters.outdoor || item.outdoor);
  });
  return result.sort((a, b) => {
    switch (filters.sort) {
      case "price-asc": return a.price - b.price || a.id.localeCompare(b.id);
      case "price-desc": return b.price - a.price || a.id.localeCompare(b.id);
      case "area-desc": return b.area - a.area || a.id.localeCompare(b.id);
      default: return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    }
  });
}
