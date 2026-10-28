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
// Public facts only. Keep this structural type independent of the browser data loader
// so the static build and the hydrated page use exactly the same wording.
export type SeoListing = {
  id: string;
  reference?: string;
  title?: string;
  district?: string;
  city?: string;
  neighbourhood?: string;
  type?: string;
  transaction?: string;
  beds?: number | null;
  baths?: number | null;
  area?: number | null;
  lotArea?: number | null;
  description?: string;
  descriptionTranslations?: Partial<Record<SeoLanguage,string>>;
  real?: boolean;
};
const propertyCopy = {
  en: {
    types: {house:'House',condo:'Condo',plex:'Plex',commercial:'Commercial property',land:'Land','hotel-motel':'Hotel / Motel',daycare:'Daycare',business:'Business'},
    fallback:'Property', sale:'for sale', rent:'for rent', 'sale-rent':'for sale or rent', reference:'Ref.',
    bedroom:(count:number)=>`${count} ${count===1?'bedroom':'bedrooms'}`,
    bathroom:(count:number)=>`${count} ${count===1?'bathroom':'bathrooms'}`,
    area:(value:string)=>`${value} sq ft`, lot:(value:string)=>`${value} sq ft lot`,
  },
  fr: {
    types: {house:'Maison',condo:'Condo',plex:'Plex',commercial:'Propriété commerciale',land:'Terrain','hotel-motel':'Hôtel / Motel',daycare:'Garderie',business:'Entreprise'},
    fallback:'Propriété', sale:'à vendre', rent:'à louer', 'sale-rent':'à vendre ou à louer', reference:'Réf.',
    bedroom:(count:number)=>`${count} ${count===1?'chambre':'chambres'}`,
    bathroom:(count:number)=>`${count} ${count===1?'salle de bain':'salles de bain'}`,
    area:(value:string)=>`${value} pi²`, lot:(value:string)=>`Terrain de ${value} pi²`,
  },
  zh: {
    types: {house:'独立屋',condo:'公寓',plex:'多户住宅',commercial:'商业物业',land:'土地','hotel-motel':'酒店 / 汽车旅馆',daycare:'托儿机构',business:'企业'},
    fallback:'物业', sale:'出售', rent:'出租', 'sale-rent':'出售或出租', reference:'编号',
    bedroom:(count:number)=>`${count}间卧室`, bathroom:(count:number)=>`${count}间浴室`,
    area:(value:string)=>`${value}平方英尺`, lot:(value:string)=>`土地${value}平方英尺`,
  },
};
const cleanText = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g,' ').trim() : '';
const referenceText = (lang:SeoLanguage,item:SeoListing) => `${propertyCopy[lang].reference} ${cleanText(item.reference)||cleanText(item.id)}`.trim();
const knownCount = (value:unknown):value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value);
const knownArea = (value:unknown):value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
function propertyFacts(lang:SeoLanguage,item:SeoListing) {
  const copy=propertyCopy[lang];
  const number=(value:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{maximumFractionDigits:2}).format(value);
  const residential=['house','condo','plex'].includes(item.type||'');
  return [
    residential&&knownCount(item.beds)?copy.bedroom(item.beds):'',
    residential&&knownCount(item.baths)?copy.bathroom(item.baths):'',
    knownArea(item.area)?copy.area(number(item.area)):'',
    knownArea(item.lotArea)?copy.lot(number(item.lotArea)):'',
  ].filter(Boolean);
}
/** Meaningful public heading, retaining the supplied address and city. */
export function propertyHeading(lang:SeoLanguage,item:SeoListing) {
  const copy=propertyCopy[lang];
  const type=Object.hasOwn(copy.types,item.type||'')?copy.types[item.type as keyof typeof copy.types]:copy.fallback;
  // Owner submissions omit transaction and are sales in the publication contract.
  // An unrecognized explicit value stays neutral instead of inventing a transaction.
  const transaction=item.transaction===undefined?'sale':item.transaction;
  const action=transaction==='sale'||transaction==='rent'||transaction==='sale-rent'?copy[transaction]:'';
  const label=[type,action].filter(Boolean).join(lang==='zh'?'':' ');
  const places=[cleanText(item.title)||cleanText(item.district),cleanText(item.city)].filter(Boolean);
  const uniquePlaces=places.filter((value,index)=>places.findIndex(other=>other.toLocaleLowerCase()===value.toLocaleLowerCase())===index);
  return uniquePlaces.length?`${label} — ${uniquePlaces.join(', ')}`:label;
}
/** A short visible introduction made from supplied facts; no guessed features. */
export function propertySummary(lang:SeoLanguage,item:SeoListing) {
  const facts=propertyFacts(lang,item);
  return facts.length?facts.join(' · '):propertyHeading(lang,item);
}
function shortenText(value:string,limit:number) {
  const chars=Array.from(value);
  if(chars.length<=limit)return value;
  if(limit<=1)return '…'.slice(0,Math.max(0,limit));
  const fragment=chars.slice(0,limit-1).join('').trimEnd();
  // Avoid cutting Latin words while retaining useful Chinese text without spaces.
  const boundary=fragment.lastIndexOf(' ');
  return (boundary>fragment.length-20?fragment.slice(0,boundary):fragment).replace(/[\s,;:.·—]+$/,'')+'…';
}
/** Concise metadata reserves the reference even when a long introduction is cut. */
export function propertyDescription(lang:SeoLanguage,item:SeoListing) {
  const facts=propertyFacts(lang,item);
  const intro=cleanText(item.descriptionTranslations?.[lang])||cleanText(item.description);
  const content=[propertyHeading(lang,item),...facts,intro].filter(Boolean).join('. ');
  const suffix=` · ${referenceText(lang,item)}`;
  return shortenText(content,Math.max(0,170-Array.from(suffix).length))+suffix;
}
export function pageSeo(lang: SeoLanguage, kind: 'home' | 'catalogue' | 'property', item?: SeoListing, type = '') {
  const copy = seoCopy[lang];
  const category = kind === 'catalogue' ? categoryCopy(lang,type) : undefined;
  if(category)return {title:`${category.title} | Propriété En Vente`,description:category.description};
  const heading = kind === 'property' ? (item ? `${propertyHeading(lang,item)} · ${referenceText(lang,item)}` : copy.unavailable) : copy[kind];
  const description = kind === 'property' && item ? propertyDescription(lang,item) : `${copy[kind === 'catalogue' ? 'catalogue' : 'home']}. ${copy.description}`;
  return {title: `${heading} | Propriété En Vente`, description: kind==='property'&&item?description:shortenText(cleanText(description),170)};
}
export function pageSocialMetadata(lang: SeoLanguage, url: string, meta: {title: string; description: string}) {
  const image = `${origin}/social/og-${lang}.png`;
  const alt = {
    en: 'Propriété En Vente — Property listings in Montréal and Québec',
    fr: 'Propriété En Vente — Annonces immobilières à Montréal et au Québec',
    zh: 'Propriété En Vente — 蒙特利尔及魁北克房源发布平台',
  }[lang];
  return {
    property: {
      'og:type': 'website',
      'og:site_name': 'Propriété En Vente',
      'og:title': meta.title,
      'og:description': meta.description,
      'og:url': url,
      'og:locale': {en: 'en_CA', fr: 'fr_CA', zh: 'zh_CN'}[lang],
      'og:image': image,
      'og:image:type': 'image/png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': alt,
    },
    name: {
      'twitter:card': 'summary_large_image',
      'twitter:title': meta.title,
      'twitter:description': meta.description,
      'twitter:image': image,
      'twitter:image:alt': alt,
    },
  };
}
export function updateSeo(lang: SeoLanguage, hash: string, item?: SeoListing, unavailable = false) {
  const detail = hash.startsWith('#propriete/');
  const catalogue = hash.startsWith('#proprietes');
  const privateRoute = !!hash && !detail && !catalogue && !['#top','#approche','#processus','#parcours'].includes(hash);
  const id = detail ? item?.reference || hash.slice(11).split('?')[0] : '';
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const type = params.get('type') as SeoCategory;
  const filtered = catalogue && [...params.keys()].some(key => !['type','utm_source','utm_medium','utm_campaign'].includes(key)) || catalogue && !!type && !categories.includes(type);
  const kind = detail ? 'property' : catalogue ? 'catalogue' : 'home';
  const meta = pageSeo(lang, kind, item,type);
  const path = (l: SeoLanguage) => detail ? propertyPath(l,id) : catalogue ? categories.includes(type) ? categoryPath(l,type) : cataloguePath(l) : homePath(l);
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  document.title = meta.title;
  function setMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
    let node = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
    if (!node) { node = document.createElement('meta'); node.setAttribute(attribute,name); document.head.append(node); }
    node.content = content;
  }
  setMeta('description',meta.description);
  setMeta('robots',privateRoute || filtered || unavailable || item?.real === false || id.startsWith('demo-') ? 'noindex,follow' : 'index,follow');
  document.querySelectorAll('link[rel="canonical"],link[hreflang]').forEach(node => node.remove());
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = origin + path(lang); document.head.append(canonical);
  if (!privateRoute && !unavailable) for (const l of [...languages,'x-default'] as const) {
    const link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = l === 'zh' ? 'zh-Hans' : l; link.href = origin + path(l === 'x-default' ? 'fr' : l); document.head.append(link);
  }
  document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]').forEach(node => node.remove());
  if (!privateRoute && !unavailable && item?.real !== false && !id.startsWith('demo-')) {
    const social = pageSocialMetadata(lang,origin + path(lang),meta);
    for (const attribute of ['property','name'] as const) {
      for (const [name,content] of Object.entries(social[attribute])) setMeta(name,content,attribute);
    }
  }
}
