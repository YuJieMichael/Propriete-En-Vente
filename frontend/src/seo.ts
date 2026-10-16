import categoryContent from './seo-content.json' with {type:'json'};
export type SeoLanguage = 'en' | 'fr' | 'zh';
export const categorySlugs = {'hotel-motel':'hotels-motels',daycare:'garderies',land:'terrains',business:'entreprises'} as const;
export type SeoCategory = keyof typeof categorySlugs;
export const categories = Object.keys(categorySlugs) as SeoCategory[];
export const categoryCopy = (lang: SeoLanguage, type: string) => categories.includes(type as SeoCategory) ? categoryContent[lang][type as SeoCategory] : undefined;
export const languages: SeoLanguage[] = ['en', 'fr', 'zh'];
export const origin = 'https://proprieteenvente.ca';
export const homePath = (lang: SeoLanguage) => `/${lang}/`;
export const cataloguePath = (lang: SeoLanguage) => `/${lang}/proprietes/`;
export const categoryPath = (lang: SeoLanguage, type: SeoCategory) => `${cataloguePath(lang)}${categorySlugs[type]}/`;
export function catalogueHref(lang: SeoLanguage, search = '') {
  const params = new URLSearchParams(search.replace(/^\?/,''));
  const type = params.get('type') as SeoCategory;
  const path = categories.includes(type) ? categoryPath(lang,type) : cataloguePath(lang);
  if(categories.includes(type))params.delete('type');
  return path + (params.size ? `?${params}` : '');
}
export const propertyPath = (lang: SeoLanguage, id: string) => `${cataloguePath(lang)}${encodeURIComponent(id)}/`;
export function pathLanguage(path: string): SeoLanguage {
  return /^\/(en|fr|zh)(?:\/|$)/.exec(path)?.[1] as SeoLanguage || 'fr';
}
export function routeHash(path: string, search = '', hash = '') {
  if (hash && hash !== '#top') return hash;
  const match = /^\/(en|fr|zh)\/proprietes(?:\/([^/]+))?\/?$/.exec(path);
  const type = categories.find(type => categorySlugs[type] === match?.[2]);
  if(type){const params=new URLSearchParams(search);params.set('type',type);return `#proprietes?${params}`;}
  return match ? (match[2] ? `#propriete/${match[2]}` : '#proprietes') + search : hash;
}
export function languageHref(lang: SeoLanguage, path: string, search = '', hash = '') {
  const route = routeHash(path, search, hash);
  if (route.startsWith('#propriete/')) return propertyPath(lang, route.slice(11).split('?')[0]) + (route.includes('?') ? `?${route.split('?')[1]}` : '');
  if (route.startsWith('#proprietes')) return catalogueHref(lang,route.split('?')[1]);
  return homePath(lang) + search + hash;
}
export function normalizePublicLocation() {
  const lang = pathLanguage(location.pathname);
  if (/^#propriet(?:e\/|es(?:\?|$))/.test(location.hash)) {
    history.replaceState(history.state, '', languageHref(lang, location.pathname, '', location.hash));
  } else if (location.hash === '#top') {
    history.replaceState(history.state, '', homePath(lang));
  }
  return routeHash(location.pathname, location.search, location.hash);
}
export const seoCopy = {
  en: {home: 'Property listings in Montréal and Québec', catalogue: 'Properties for sale and rent in Québec', description: 'Browse property listings in Montréal and across Québec. Owners and brokers can submit listings for review. Available in French, English and Chinese.', unavailable: 'Property unavailable'},
  fr: {home: 'Annonces immobilières à Montréal et au Québec', catalogue: 'Propriétés à vendre et à louer au Québec', description: 'Consultez les annonces à Montréal et au Québec. Propriétaires et courtiers peuvent proposer une annonce pour examen. En français, anglais et chinois.', unavailable: 'Propriété indisponible'},
  zh: {home: '蒙特利尔及魁北克房源发布平台', catalogue: '魁北克在售及出租房源', description: '浏览蒙特利尔及魁北克的出售和出租房源。房东与经纪人可提交房源，审核后发布。提供法语、英语和中文界面。', unavailable: '房源暂不可用'},
};
export type SeoListing = {id: string; title?: string; district?: string; city: string; description?: string; descriptionTranslations?: Partial<Record<SeoLanguage,string>>; reference?: string; real?: boolean};
export function pageSeo(lang: SeoLanguage, kind: 'home' | 'catalogue' | 'property', item?: SeoListing, type = '') {
  const copy = seoCopy[lang];
  const category = kind === 'catalogue' ? categoryCopy(lang,type) : undefined;
  if(category)return {title:`${category.title} | Propriété En Vente`,description:category.description};
  const label = {en:'Property',fr:'Propriété',zh:'房源'}[lang];
  const heading = kind === 'property' ? (item ? `${label} ${item.reference || item.id} · ${item.title || item.district} · ${item.city}` : copy.unavailable) : copy[kind];
  const description = kind === 'property' && item ? `${label} ${item.reference || item.id} : ${item.descriptionTranslations?.[lang] || item.description || `${item.title || item.district}, ${item.city}`}` : `${copy[kind === 'catalogue' ? 'catalogue' : 'home']}. ${copy.description}`;
  return {title: `${heading} | Propriété En Vente`, description: description.replace(/\s+/g,' ').slice(0,170)};
}
export function updateSeo(lang: SeoLanguage, hash: string, item?: SeoListing, unavailable = false) {
  const detail = hash.startsWith('#propriete/');
  const catalogue = hash.startsWith('#proprietes');
  const privateRoute = !!hash && !detail && !catalogue && !['#top','#approche','#processus','#parcours'].includes(hash);
  const id = detail ? item?.reference || hash.slice(11).split('?')[0] : '';
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const type = params.get('type') as SeoCategory;
  const filtered = catalogue && [...params.keys()].some(key => key !== 'type') || catalogue && !!type && !categories.includes(type);
  const kind = detail ? 'property' : catalogue ? 'catalogue' : 'home';
  const meta = pageSeo(lang, kind, item,type);
  const path = (l: SeoLanguage) => detail ? propertyPath(l,id) : catalogue ? categories.includes(type) ? categoryPath(l,type) : cataloguePath(l) : homePath(l);
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  document.title = meta.title;
  function setMeta(name: string, content: string) {
    let node = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!node) { node = document.createElement('meta'); node.name = name; document.head.append(node); }
    node.content = content;
  }
  setMeta('description',meta.description);
  setMeta('robots',privateRoute || filtered || unavailable || item?.real === false || id.startsWith('demo-') ? 'noindex,follow' : 'index,follow');
  document.querySelectorAll('link[rel="canonical"],link[hreflang]').forEach(node => node.remove());
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = origin + path(lang); document.head.append(canonical);
  if (!privateRoute && !unavailable) for (const l of [...languages,'x-default'] as const) {
    const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = l === 'zh' ? 'zh-Hans' : l; link.href = origin + path(l === 'x-default' ? 'fr' : l); document.head.append(link);
  }
}
