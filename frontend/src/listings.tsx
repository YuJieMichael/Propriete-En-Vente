import {PropertyGallery} from './property-gallery';
import {PropertyContact} from './property-contact';
import {SaveProperty,usePropertyLibrary,rememberProperty,clearRecent} from './property-library';
import {CategoryGuide} from "./category-guide";
import {hotelGuestRooms} from './seo';
import {cataloguePath, catalogueHref, propertyPath, updateSeo, categoryCopy, categoryPath, propertyHeading, propertySummary, homePath, type SeoCategory} from "./seo";
import {relatedListings} from './listing-navigation';
import {SmartSearch} from './smart-search-panel';
import {DecisionCard} from './decision-card';
import {HotelAcquisitionIntro} from './hotel-acquisition';
import {trackPropertyView} from './lib/traffic-metrics';
import {queuePropertyQuestions,takeSearchIntent} from './lib/discovery-handoff';
import {PropertyLocation,propertyMapLinks} from './property-location';
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bath, BedDouble, Blocks, Building, Building2, CarFront, ChevronRight, ExternalLink, Hotel, House, Info, LandPlot, LayoutGrid, List, MapPin, MessageSquareText, Search, SlidersHorizontal, Square, Trees, X } from "lucide-react";
import type { Language } from "./seller-copy";
import { listingsCopy } from "./listings-copy";
import { defaultFilters, filterQuery, invalidPriceRange, listingFallback, listingSearchPrice, listings, readFilters, selectListings, type Filters, type Listing, type PropertyType } from "./listings-data";
import "./listings.css";
import "./property-browsing.css";
import { publicationCopy } from "./publication-copy";
import { usePublicListings, publicListingsEnabled } from "./lib/public-listings";
import {PriceRange} from './price-range';
import { selectablePropertyTypes as propertyTypes, daycareLabels } from './property-categories';

const locale = (lang: Language) => lang === "zh" ? "zh-CN" : `${lang}-CA`;
const money = (price: number, lang: Language) => new Intl.NumberFormat(locale(lang), { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(price);
const number = (value: number, lang: Language) => new Intl.NumberFormat(locale(lang)).format(value);


function transactionLabel(item:Listing,lang:Language){
  return {fr:{sale:'À vendre',rent:'À louer','sale-rent':'À vendre / À louer'},en:{sale:'For sale',rent:'For rent','sale-rent':'For sale / For rent'},zh:{sale:'出售',rent:'出租','sale-rent':'出售／出租'}}[lang][item.transaction||'sale'];
}
function listingPrice(item:Listing,lang:Language,transaction?:Filters['transaction']){
  const month={fr:'/mois',en:'/month',zh:'/月'}[lang];
  const taxes=item.taxExtra?({fr:' + TPS/TVQ',en:' + GST/QST',zh:' + GST/QST'}[lang]):'';
  const price=listingSearchPrice(item,transaction);
  if(price===null)return {en:'Price to confirm',fr:'Prix à confirmer',zh:'价格待确认'}[lang];
  return money(price,lang)+(transaction==='rent'||item.transaction==='rent'?month:'')+taxes;
}
function ListingPhoto({ item, lang, eager = false }: { item: Listing; lang: Language; eager?: boolean }) {
  const c = listingsCopy[lang];
  return <img src={item.image} alt={`${item.real ? publicationCopy[lang].photos : c.photoNote} · ${c.types[item.type]}`} loading={eager ? "eager" : "lazy"} onError={event => {
    if (!event.currentTarget.src.endsWith("/propriete-en-vente-hero.png")) event.currentTarget.src = listingFallback;
  }} />;
}

function Facts({ item, lang }: { item: Listing; lang: Language }) {
  const c = listingsCopy[lang];
  const rooms = hotelGuestRooms(lang, item);
  return <div className="property-facts">
    {rooms && <span><Hotel aria-hidden="true" />{rooms.summary}</span>}
    {item.beds !== null && <span><BedDouble aria-hidden="true" />{item.beds}<span className="listing-sr-only"> {c.bedroomCount}</span></span>}
    {item.baths !== null && <span><Bath aria-hidden="true" />{item.baths}<span className="listing-sr-only"> {c.bathroomCount}</span></span>}
    {item.area!==null&&<span><Square aria-hidden="true" />{number(item.area, lang)} {c.sqft}</span>}{item.area===null&&item.lotArea!=null&&<span><Square aria-hidden="true" />{number(item.lotArea,lang)} {c.sqft} · {{fr:"terrain",en:"land",zh:"土地"}[lang]}</span>}
  </div>;
}

function PropertyMetrics({item,lang}:{item:Listing;lang:Language}){
  const c=listingsCopy[lang];
  const rooms=hotelGuestRooms(lang,item);
  const text={fr:{beds:'ch.',baths:'s. de bain',parking:'places',outdoor:'Extérieur'},en:{beds:'beds',baths:'baths',parking:'spaces',outdoor:'Outdoor'},zh:{beds:'卧室',baths:'浴室',parking:'车位',outdoor:'户外空间'}}[lang];
  const parkingCount=typeof item.parkingSpaces==='number'&&Number.isFinite(item.parkingSpaces)&&item.parkingSpaces>0?item.parkingSpaces:null;
  const parkingUnit=parkingCount===1?({fr:'place',en:'space',zh:'车位'}[lang]):text.parking;
  return <div className="property-metrics">
    {rooms&&<span><Hotel aria-hidden="true"/><small>{rooms.label}</small><strong>{rooms.value}</strong></span>}
    {item.beds!==null&&<span title={c.beds}><BedDouble aria-hidden="true"/><strong>{item.beds}</strong><small>{text.beds}</small></span>}
    {item.baths!==null&&<span title={c.baths}><Bath aria-hidden="true"/><strong>{item.baths}</strong><small>{text.baths}</small></span>}
    {item.area!==null&&<span title={c.livingArea}><Square aria-hidden="true"/><strong>{number(item.area,lang)}</strong><small>{c.sqft}</small></span>}
    {(parkingCount!==null||item.parking!=null)&&<span title={c.parking}><CarFront aria-hidden="true"/><strong>{parkingCount!==null?number(parkingCount,lang):item.parking?c.yes:c.no}</strong>{parkingCount!==null&&<small>{parkingUnit}</small>}</span>}
    {item.outdoor!==null&&<span title={c.outdoor}><Trees aria-hidden="true"/><small>{text.outdoor}</small><strong>{item.outdoor?c.yes:c.no}</strong></span>}
    {item.streetParking&&<span><CarFront aria-hidden="true"/><small>{publicationCopy[lang].streetParking}</small></span>}
  </div>;
}

function PropertyCard({ item, lang, query = "", eager = false }: { item: Listing; lang: Language; query?: string; eager?: boolean }) {
  const c = listingsCopy[lang];
  const title = propertyHeading(lang,item);
  const searchTransaction=new URLSearchParams(query).get('transaction')==='rent'?'rent':undefined;
  return <article className="property-card">
    <a className="property-card-link" href={`${propertyPath(lang,item.reference || item.id)}${query}`} aria-label={`${c.details} · ${title} · ${listingPrice(item, lang,searchTransaction)}`}>
      <div className="listing-photo"><ListingPhoto item={item} lang={lang} eager={eager} /><span className="listing-photo-type">{c.types[item.type]}</span><span className="property-demo">{item.source?.placeholder?({fr:"Illustration",en:"Illustration",zh:"示意图"}[lang]):item.real ? transactionLabel(item,lang) : c.demo}</span>{item.source?.placeholder&&<span className="property-transaction">{transactionLabel(item,lang)}</span>}</div>
      <div className="property-card-body">
        <p className="property-city"><MapPin aria-hidden="true" />{item.city}{item.postal?` · ${item.postal}`:""}</p>
        <h3>{title}</h3>
        <Facts item={item} lang={lang} />
        {item.type==="daycare"&&item.daycareSubsidy&&<p className="daycare-status">{daycareLabels[lang][item.daycareSubsidy]}</p>}
        <div className="property-price-row"><span>{searchTransaction==='rent'||item.transaction==='rent'?({fr:'Loyer mensuel',en:'Monthly rent',zh:'月租金'}[lang]):c.price}</span><strong>{listingPrice(item, lang,searchTransaction)}</strong></div>
        <div className="property-card-footer"><span className={item.mode === "owner" ? "owner-label" : "broker-label"}>{item.mode === "owner" ? (item.real ? publicationCopy[lang].hybrid : c.owner) : c.broker}</span><span>{c.details}<ArrowRight aria-hidden="true" /></span></div>
      </div>
    </a>
    <SaveProperty id={item.reference || item.id} lang={lang}/>
  </article>;
}

function DemoNotice({ lang }: { lang: Language }) {
  const c = listingsCopy[lang];
  return <p className="catalogue-notice"><Info aria-hidden="true" /><span>{({en:"Cards marked Example are fictional, with illustrative photos and prices. They are not offered for sale.",fr:"Les fiches portant la mention Exemple sont fictives : photos et prix illustratifs, sans offre de vente.",zh:"标有“示例”的房源为虚构展示，照片和价格仅供演示，并非真实在售。"})[lang]}</span></p>;
}

export function FeaturedProperties({ lang }: { lang: Language }) {
  const c = listingsCopy[lang];
  const live = usePublicListings();
  const items = publicListingsEnabled ? live.items : listings;
  const pub = publicationCopy[lang];
  return <section className="featured-properties section" id="proprietes">
    <div className="section-heading"><div><p className="eyebrow">{c.eyebrow}</p><h2>{c.browseTitle}</h2><p>{c.browseText}</p></div><a href={cataloguePath(lang)} className="listing-text-link">{c.viewAll}<ArrowRight aria-hidden="true" /></a></div>
    {!publicListingsEnabled && <DemoNotice lang={lang} />}
    {live.loading && <p role="status">{pub.loading}</p>}
    {live.error && <p role="alert">{pub.actionError}</p>}
    {publicListingsEnabled && !live.loading && !live.error && !items.length && <p>{pub.noPublic}</p>}
    <div className="property-grid">{items.slice(0, 6).map(item => <PropertyCard key={item.id} item={item} lang={lang} />)}</div>
  </section>;
}

const overviewCopy={
  fr:{label:'Le catalogue en chiffres',published:'propriétés publiées',business:'hôtels, garderies et entreprises',land:'terrains',cities:'villes',categories:'Explorer par catégorie',categoriesText:'Hôtels et motels, garderies, terrains et propriétés résidentielles, avec le nombre d’annonces publiées.',residential:'Maisons, condos et plex',count:(n:number)=>`${n} ${n===1?'annonce':'annonces'}`,citiesTitle:'Chercher par ville'},
  en:{label:'The catalogue in numbers',published:'published properties',business:'hotels, daycares and businesses',land:'land listings',cities:'cities',categories:'Browse by category',categoriesText:'Hotels and motels, daycares, land and residential properties, with the number of published listings.',residential:'Houses, condos and plexes',count:(n:number)=>`${n} ${n===1?'listing':'listings'}`,citiesTitle:'Search by city'},
  zh:{label:'房源概况',published:'套已发布房源',business:'家酒店、托儿所和企业',land:'块土地',cities:'个城市',categories:'按分类浏览',categoriesText:'酒店与汽车旅馆、托儿所、土地和住宅物业，附已发布房源数量。',residential:'独立屋、公寓和多户住宅',count:(n:number)=>`${n} 套房源`,citiesTitle:'按城市查找'},
};
const baseCity=(city:string)=>city.replace(/\s*\(.*\)\s*$/,'').trim();

/** Homepage overview built only from the published catalogue: counts, categories and cities. */
export function HomeOverview({ lang }: { lang: Language }) {
  const live = usePublicListings();
  const items = publicListingsEnabled ? live.items : listings;
  const c = listingsCopy[lang];
  const o = overviewCopy[lang];
  if (live.loading || live.error || !items.length) return null;
  const ofTypes=(types:string[])=>items.filter(item=>types.includes(item.type));
  const cityCounts=new Map<string,number>();
  for(const item of items){const city=baseCity(item.city||'');if(city)cityCounts.set(city,(cityCounts.get(city)||0)+1);}
  const cities=[...cityCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8);
  const stats:[number,string][]=[[items.length,o.published],[ofTypes(['hotel-motel','daycare','business','commercial']).length,o.business],[ofTypes(['land']).length,o.land],[cityCounts.size,o.cities]];
  const tiles=[
    {key:'hotel-motel',types:['hotel-motel'],title:c.types['hotel-motel'],href:categoryPath(lang,'hotel-motel')},
    {key:'daycare',types:['daycare'],title:c.types.daycare,href:categoryPath(lang,'daycare')},
    {key:'land',types:['land'],title:c.types.land,href:categoryPath(lang,'land')},
    {key:'residential',types:['house','condo','plex'],title:o.residential,href:cataloguePath(lang)},
  ].map(tile=>({...tile,items:ofTypes(tile.types)}));
  return <>
    <section className="home-stats" aria-label={o.label}><dl>{stats.map(([value,label])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className="section home-categories">
      <div className="section-heading"><div><p className="eyebrow">{c.eyebrow}</p><h2>{o.categories}</h2><p>{o.categoriesText}</p></div></div>
      <div className="home-category-grid">{tiles.map(tile=><a key={tile.key} className="home-category" href={tile.href}>
        <span className="home-category-photo">{tile.items[0]&&<img src={tile.items[0].image} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display='none';}}/>}</span>
        <span className="home-category-text"><strong>{tile.title}</strong><small>{o.count(tile.items.length)}</small></span><ArrowRight aria-hidden="true"/>
      </a>)}</div>
      {!!cities.length&&<nav className="home-cities" aria-label={o.citiesTitle}><h3>{o.citiesTitle}</h3><ul>{cities.map(([city,count])=><li key={city}><a href={`${cataloguePath(lang)}?q=${encodeURIComponent(city)}`}><MapPin aria-hidden="true"/>{city}<span>{count}</span></a></li>)}</ul></nav>}
    </section>
  </>;
}

export function ListingsPage({ lang, hash, handoffReady=true, metricsReady=false }: { lang: Language; hash: string; handoffReady?:boolean; metricsReady?:boolean }) {
  const library=usePropertyLibrary();
  const readCollection=()=>{const value=new URLSearchParams(hash.split('?')[1]||'').get('collection');return value==='saved'||value==='recent'?value:'all';};
  const [collection,setCollection]=useState<string>(readCollection);
  useEffect(()=>setCollection(readCollection()),[hash]);
  const libraryCopy={fr:{all:'Toutes les annonces',saved:'Mes favoris',recent:'Vues récemment',note:'Conservé dans ce navigateur. Seules les annonces encore disponibles sont affichées.',clear:'Effacer l’historique',empty:'Aucune propriété dans cette sélection',help:'Enregistrez une propriété avec le cœur ou retrouvez ici les annonces consultées. Les filtres ci-dessus restent actifs.',browse:'Voir toutes les annonces'},en:{all:'All properties',saved:'Saved properties',recent:'Recently viewed',note:'Stored in this browser. Only currently available listings are shown.',clear:'Clear history',empty:'No properties in this selection',help:'Save a property with the heart or find the listings you viewed here. The filters above still apply.',browse:'Browse all properties'},zh:{all:'全部房源',saved:'我的收藏',recent:'最近浏览',note:'保存在当前浏览器中，仅显示仍然有效的房源。',clear:'清除浏览记录',empty:'此选项中暂无房源',help:'点击爱心收藏房源，或在这里找回浏览过的房源。上方筛选条件仍然有效。',browse:'浏览全部房源'}}[lang];
  const live = usePublicListings();
  const catalogueItems = publicListingsEnabled ? live.items : listings;
  const pub = publicationCopy[lang];
  const c = listingsCopy[lang];
  const [filters, setFilters] = useState<Filters>(() => readFilters(hash));
  const [appliedFilters,setAppliedFilters]=useState<Filters>(()=>readFilters(hash));
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [initialSentence,setInitialSentence]=useState('');
  const handoffRead=useRef(false);
  useEffect(()=>{
    if(handoffReady&&!handoffRead.current){handoffRead.current=true;setInitialSentence(takeSearchIntent());}
  },[handoffReady]);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsHeading=useRef<HTMLDivElement>(null);
  const detailId = hash.startsWith("#propriete/") ? hash.slice("#propriete/".length).split("?")[0] : null;
  useEffect(()=>{
    const item=catalogueItems.find(item=>item.id===detailId||item.reference===detailId);
    if(item)rememberProperty(item.reference||item.id);
  },[detailId,catalogueItems]);
  useEffect(()=>{
    if(!metricsReady||!detailId)return;
    const item=catalogueItems.find(item=>item.id===detailId||item.reference===detailId);
    if(item?.real&&item.reference)void trackPropertyView(item.reference);
  },[detailId,catalogueItems,metricsReady]);
  // Filters the page applied itself come back through the hash; keep the
  // fields as typed so a debounced search never rewrites text mid-entry.
  const lastApplied=useRef<string|null>(null);
  const pendingApply=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(pendingApply.current),[]);
  useEffect(() => {
    const next=readFilters(hash);
    setAppliedFilters(next);
    // Navigation elsewhere cancels a search the visitor was still typing.
    if(filterQuery(next)!==lastApplied.current){window.clearTimeout(pendingApply.current);setFilters(next);}
    lastApplied.current=null;
  }, [hash]);
  const [filtersOpen,setFiltersOpen]=useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);

  useEffect(() => {
    if (detailId) {
      const item=catalogueItems.find(item=>item.id===detailId || item.reference===detailId);
      if (!live.loading || item) updateSeo(lang,hash,item,!item);
    }
  },[lang,hash,detailId,catalogueItems,live.loading]);
  const guide=categoryCopy(lang,appliedFilters.type);

  function collectionQuery(next:Filters,value=collection){const params=new URLSearchParams(filterQuery(next).replace(/^\?/,''));if(value==='saved'||value==='recent')params.set('collection',value);return params.size?'?'+params.toString():'';}
  function chooseCollection(value:string){setCollection(value);history.replaceState(history.state,'',catalogueHref(lang,collectionQuery(appliedFilters,value)));window.dispatchEvent(new PopStateEvent('popstate'));}
  function applyFilters(next:Filters){
    window.clearTimeout(pendingApply.current);
    setAppliedFilters(next);
    lastApplied.current=filterQuery(next);
    history.replaceState(history.state,"",catalogueHref(lang,collectionQuery(next)));
    window.dispatchEvent(new PopStateEvent("popstate"));
    // Stay in place unless the top of the results has scrolled out of view.
    if((resultsHeading.current?.getBoundingClientRect().top??0)<0)resultsHeading.current?.scrollIntoView({block:"start"});
  }
  // Results follow the filters as they change: choices apply at once, typed
  // text and prices after a short pause.
  function change(patch: Partial<Filters>,immediate=false) {
    const next = { ...filters, ...patch };
    if(next.type !== 'daycare')next.daycareSubsidy='';
    setFilters(next);
    window.clearTimeout(pendingApply.current);
    if(invalidPriceRange(next))return;
    if(immediate)applyFilters(next);
    else pendingApply.current=window.setTimeout(()=>applyFilters(next),400);
  }
  function reset() { change(defaultFilters,true); }
  const query = collectionQuery(appliedFilters);
  const selected = selectListings(catalogueItems, appliedFilters);
  const filtered = collection==='saved'?selected.filter(item=>library.saved.includes(item.reference||item.id)):collection==='recent'?selected.filter(item=>library.recent.includes(item.reference||item.id)).sort((a,b)=>library.recent.indexOf(a.reference||a.id)-library.recent.indexOf(b.reference||b.id)):selected;
  const invalid = invalidPriceRange(filters);
  const active = (Object.keys(defaultFilters) as (keyof Filters)[]).filter(key => key !== "sort" && Boolean(appliedFilters[key]));
  const extraCount = [filters.baths, filters.mode, filters.parking, filters.outdoor].filter(Boolean).length;
  function chip(key: keyof Filters) {
    const value = appliedFilters[key];
    switch (key) {
      case "q": return String(value);
      case "transaction": return appliedFilters.transaction==="rent"?({fr:"À louer",en:"For rent",zh:"出租"}[lang]):({fr:"À vendre",en:"For sale",zh:"出售"}[lang]);
      case "type": return c.types[appliedFilters.type as PropertyType];
      case "daycareSubsidy": return appliedFilters.daycareSubsidy ? daycareLabels[lang][appliedFilters.daycareSubsidy] : "";
      case "min": return `≥ ${money(Number(value), lang)}`;
      case "max": return `≤ ${money(Number(value), lang)}`;
      case "beds": return `${value}${Number(value)>=5?'+':''} ${c.beds}`;
      case "baths": return `${value}+ ${c.baths}`;
      case "mode": return appliedFilters.mode === "owner" ? c.owner : c.broker;
      case "parking": return c.parking;
      case "outdoor": return c.outdoor;
      default: return "";
    }
  }
  if (detailId && live.loading && !detailId.startsWith("demo-")) return <div className="catalogue" role="status">{pub.loading}</div>;
  if (detailId) {
    const item = catalogueItems.find(item => item.id === detailId || item.reference === detailId);
    const reference=item?.reference && /^\d+$/.test(item.reference)?item.reference:undefined;
    const mapLinks=item?propertyMapLinks(item):null;
    const googleMapHref=mapLinks?.google;
    const appleMapHref=mapLinks?.apple;
    const category=item?categoryCopy(lang,item.type):undefined;
    const title=item?propertyHeading(lang,item):'';
    const summary=item?propertySummary(lang,item):'';
    const related=item?relatedListings(item,catalogueItems):[];
    return <div className="catalogue property-detail"><div className="catalogue-shell">
      <a className="listing-back" href={catalogueHref(lang,query)}><ArrowLeft aria-hidden="true" />{c.back}</a>
      {item ? <>
        {!item.real && <DemoNotice lang={lang} />}
        <nav className="detail-breadcrumb" aria-label={{fr:'Fil d’Ariane',en:'Breadcrumb',zh:'当前位置'}[lang]}><ol><li><a href={cataloguePath(lang)}>{c.all}</a></li>{category&&<li><a href={categoryPath(lang,item.type as SeoCategory)}>{category.title}</a></li>}<li aria-current="page">{item.title||item.district}</li></ol></nav>
        <div className="detail-heading"><div><p className="eyebrow">{c.types[item.type]} · {item.city}</p><h1 ref={heading} tabIndex={-1}><span className="listing-sr-only">{c.types[item.type]} · </span>{item.title||item.district||title}</h1><p><MapPin aria-hidden="true" />{item.city}, Québec{item.postal?` · ${item.postal}`:""}</p>{!item.source&&<nav className="detail-map-links" aria-label={c.mapLinks}><a href={googleMapHref} target="_blank" rel="noopener noreferrer">{c.googleMaps}<ExternalLink aria-hidden="true" /></a><a href={appleMapHref} target="_blank" rel="noopener noreferrer">{c.appleMaps}<ExternalLink aria-hidden="true" /></a><span>{c.mapAreaHint}</span></nav>}</div><div className="detail-price"><span className="detail-transaction">{transactionLabel(item,lang)}</span><span>{item.transaction==='rent'?({fr:'Loyer mensuel',en:'Monthly rent',zh:'月租金'}[lang]):c.price}</span><strong>{listingPrice(item, lang)}</strong></div></div>
        {summary&&summary!==title&&<p className="property-summary">{summary}</p>}
        {item.transaction==="sale-rent"&&<p>{({fr:"Également à louer",en:"Also for rent",zh:"也可出租"}[lang])} : {money(item.rentPrice!,lang)}{({fr:"/mois",en:"/month",zh:"/月"}[lang])}</p>}{reference&&<p className="listing-reference">{c.reference} : {reference}</p>}
        <div className="detail-actions"><SaveProperty id={item.reference||item.id} lang={lang} label/><a href={cataloguePath(lang)+'?collection=saved'}>{libraryCopy.saved}</a>{item.real&&<a className="catalogue-cta" href={`#acheter?listing=${encodeURIComponent(reference||item.id)}`}>{pub.enquire}<ArrowRight aria-hidden="true"/></a>}</div>
        <PropertyGallery key={item.id} photos={item.real?[item.image,...(item.photos||[])]:[item.image]} title={title} lang={lang} illustration={item.source?.placeholder||!item.real}/>
        <PropertyMetrics item={item} lang={lang}/>
        {item.video&&<section className="detail-section"><h2>{lang==='fr'?'Vidéo de la propriété':lang==='en'?'Property video':'房屋视频'}</h2><video src={item.video} controls playsInline preload="metadata" style={{width:'100%',maxHeight:560}}/></section>}
        <div className="detail-columns"><div>
        <details className="decision-card-entry" key={`decision-${lang}-${item.id}`}><summary><span>{{en:'Property decision card · compare your needs and prepare questions',fr:'Carte de décision · comparer vos besoins et préparer vos questions',zh:'房源决策卡 · 对照需求，准备要问的问题'}[lang]}</span><ChevronRight aria-hidden="true"/></summary>
          <DecisionCard lang={lang} item={item} initialCriteria={appliedFilters} onAsk={questions=>{
            queuePropertyQuestions(reference||item.id,lang,questions);
            location.hash=`acheter?listing=${encodeURIComponent(reference||item.id)}`;
          }}/>
        </details>

          {!!item.features?.length&&<section className="detail-section"><h2>{{fr:'Caractéristiques et équipements',en:'Features and amenities',zh:'物业参数与设施'}[lang]}</h2><dl className="detail-facts imported-features">{item.features.map(feature=><div key={feature.key}><dt>{feature.label[lang]}</dt><dd>{feature.value[lang]}</dd></div>)}</dl></section>}
          <section className="detail-section"><h2>{c.overview}</h2><p className="publication-description">{item.descriptionTranslations?.[lang] || item.description || c.about[item.type]}</p></section>
          <section className="detail-section"><h2>{c.facts}</h2><dl className="detail-facts">{[
            [c.type, c.types[item.type]], ...(item.type==='daycare'&&item.daycareSubsidy?[[daycareLabels[lang].title,daycareLabels[lang][item.daycareSubsidy]]]:[]), ... (item.lotArea!=null?[[({fr:"Superficie du terrain",en:"Lot area",zh:"土地面积"}[lang]),`${number(item.lotArea,lang)} ${c.sqft}`]]:[]), [c.location, item.city], [c.mode, item.mode === "owner" ? c.owner : c.broker], [item.real ? ({en:"Published",fr:"Publication",zh:"发布日期"}[lang]) : c.date, new Intl.DateTimeFormat(locale(lang), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))], ...(reference?[[c.reference,reference]]:[]),
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
          {item.real?<PropertyContact reference={reference||item.id} lang={lang} price={listingPrice(item,lang)}/>:<aside className="detail-contact"><h2>{c.contactTitle}</h2><p>{c.contactText}</p><a href="#vendre" className="catalogue-cta">{c.contactLink}</a></aside>}
        </div>
        {item.real&&<PropertyContact reference={reference||item.id} lang={lang} price={listingPrice(item,lang)} mobile/>}
        {item.source&&<PropertyLocation item={item} lang={lang}/>}
        {!!related.length&&<section className="detail-related"><h2>{c.nearby}</h2><div className="property-grid">{related.map(other => <PropertyCard key={other.id} item={other} lang={lang} query={query} />)}</div></section>}
      </> : <div className="listing-empty"><House aria-hidden="true" /><h1 ref={heading} tabIndex={-1}>{c.notFound}</h1><a href={catalogueHref(lang,query)} className="catalogue-cta">{c.back}</a></div>}
    </div></div>;
  }
  const typeIcon=(type:PropertyType)=>type === "house" ? <House aria-hidden="true" /> : type === "condo" ? <Building aria-hidden="true" /> : type === "plex" ? <Blocks aria-hidden="true" /> : type === "land" ? <LandPlot aria-hidden="true" /> : <Building2 aria-hidden="true" />;
  const filtersLabel={fr:'Filtres',en:'Filters',zh:'筛选'}[lang];
  const showResults={fr:`Voir ${filtered.length} ${filtered.length===1?c.result:c.results}`,en:`Show ${filtered.length} ${filtered.length===1?c.result:c.results}`,zh:`查看 ${filtered.length} ${c.results}`}[lang];
  return <div className="catalogue catalogue-browse">
    <header className="catalogue-hero"><div className="catalogue-shell">
      <nav className="catalogue-breadcrumb" aria-label={{fr:'Fil d’Ariane',en:'Breadcrumb',zh:'当前位置'}[lang]}><ol><li><a href={homePath(lang)}>{{fr:'Accueil',en:'Home',zh:'首页'}[lang]}</a></li>{guide?<><li><a href={cataloguePath(lang)}>{c.all}</a></li><li aria-current="page">{guide.title}</li></>:<li aria-current="page">{c.all}</li>}</ol></nav>
      <div className="catalogue-heading"><div><p className="eyebrow">{c.eyebrow}</p><h1 ref={heading} tabIndex={-1}>{guide?.title || (collection==='saved'?libraryCopy.saved:collection==='recent'?libraryCopy.recent:{fr:'Trouvez votre prochaine propriété.',en:'Find your next property.',zh:'找到适合您的下一处房产。'}[lang])}</h1><p>{guide?.description || c.intro}</p></div><a className="catalogue-sell" href="#publier">{pub.publish}<ArrowRight aria-hidden="true" /></a></div>
    </div></header>
    <div className="catalogue-shell catalogue-layout">
    <aside className="catalogue-sidebar" aria-label={filtersLabel}>
      <button type="button" className="filters-toggle" aria-expanded={filtersOpen} aria-controls="catalogue-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal aria-hidden="true"/>{filtersLabel}{active.length>0&&<span>{active.length}</span>}</button>
      <div className="catalogue-filters" id="catalogue-filters" data-open={filtersOpen||undefined}>
      <div className="sidebar-group"><h2>{c.type}</h2><div className="property-type-tabs" aria-label={c.type}><button type="button" aria-pressed={!filters.type} onClick={() => change({ type: "" },true)}><LayoutGrid aria-hidden="true"/>{c.all}</button>{propertyTypes.map(type => {
        const content=<>{typeIcon(type)}{c.types[type]}</>;
        return categoryCopy(lang,type)?<a key={type} href={categoryPath(lang,type as SeoCategory)} aria-current={filters.type===type?'page':undefined} onClick={event=>{
          if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          event.preventDefault();change({type},true);
        }}>{content}</a>:<button type="button" key={type} aria-pressed={filters.type === type} onClick={() => change({ type },true)}>{content}</button>;
      })}</div>
      {filters.type==="daycare"&&<div className="property-type-tabs daycare-filter" role="group" aria-label={daycareLabels[lang].title}>{(["","subsidized","non-subsidized"] as const).map(value=><button type="button" key={value} aria-pressed={filters.daycareSubsidy===value} onClick={()=>change({daycareSubsidy:value},true)}>{value?daycareLabels[lang][value]:daycareLabels[lang].all}</button>)}</div>}</div>
      <form className="listing-filters" role="search" aria-label={c.browse} onSubmit={event => {event.preventDefault();if(invalid)return;applyFilters(filters);}}>
        <div className="filter-main"><label className="filter-location">{c.search}<span><Search aria-hidden="true" /><input type="search" maxLength={120} placeholder={c.searchPlaceholder} value={filters.q} onChange={event => change({ q: event.target.value })} /></span></label>
          <label className="transaction-filter">{{fr:"Transaction",en:"Listing",zh:"交易类型"}[lang]}<select value={filters.transaction||""} onChange={event=>change({transaction:event.target.value as Filters["transaction"]},true)}><option value="">{{fr:"Vente et location",en:"Sale and rent",zh:"出售及出租"}[lang]}</option><option value="sale">{{fr:"À vendre",en:"For sale",zh:"出售"}[lang]}</option><option value="rent">{{fr:"À louer",en:"For rent",zh:"出租"}[lang]}</option></select></label>
          <PriceRange filters={filters} lang={lang} invalid={invalid} onChange={change} ceiling={Math.max(filters.transaction==='rent'?5000:1000000,...catalogueItems.filter(item=>(!filters.type||item.type===filters.type)&&(!filters.transaction||(filters.transaction==='rent'?item.transaction==='rent'||item.transaction==='sale-rent':item.transaction!=='rent'))).map(item=>listingSearchPrice(item,filters.transaction)??0))}/>
          <label>{c.beds}<select value={filters.beds} onChange={event => change({ beds: event.target.value },true)}><option value="">{c.any}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n===5?'+':''}</option>)}</select></label>
          <button className={`more-filters ${expanded ? "expanded" : ""}`} type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="extra-listing-filters"><SlidersHorizontal aria-hidden="true" />{expanded ? c.less : c.more}{extraCount > 0 && <span>{extraCount}</span>}</button>
        </div>
        {expanded && <div className="filter-extra" id="extra-listing-filters"><label>{c.baths}<select value={filters.baths} onChange={event => change({ baths: event.target.value },true)}><option value="">{c.any}</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}</select></label><label>{c.mode}<select value={filters.mode} onChange={event => change({ mode: event.target.value as Filters["mode"] },true)}><option value="">{c.any}</option><option value="owner">{c.owner}</option><option value="broker">{c.broker}</option></select></label><label className="filter-checkbox"><input type="checkbox" checked={filters.parking} onChange={event => change({ parking: event.target.checked },true)} /><CarFront aria-hidden="true" />{c.parking}</label><label className="filter-checkbox"><input type="checkbox" checked={filters.outdoor} onChange={event => change({ outdoor: event.target.checked },true)} /><Trees aria-hidden="true" />{c.outdoor}</label></div>}
        {invalid && <p className="filter-error" id="price-range-error" role="alert">{c.rangeError}</p>}
        <div className="filter-submit"><button type="submit" className="catalogue-cta filters-done" disabled={invalid} onClick={()=>{setFiltersOpen(false);requestAnimationFrame(()=>resultsHeading.current?.focus({preventScroll:true}));}}>{showResults}</button>{active.length>0&&<button type="button" className="clear-filters" onClick={reset}>{c.reset}</button>}</div>
      </form>
      <p className="wanted-entry">{{en:'Still looking for the right property?',fr:'Vous cherchez encore la bonne propriété ?',zh:'还没有找到合适的房源？'}[lang]} <a href={`${homePath(lang)}#recherches`}>{{en:'Browse or post an anonymous wanted card',fr:'Consulter ou publier une recherche anonyme',zh:'浏览或发布匿名求购卡'}[lang]} →</a></p>
      </div>
    </aside>
    <div className="catalogue-results">
    {appliedFilters.type==='hotel-motel'&&<HotelAcquisitionIntro lang={lang}/>}
    <details className="smart-search-entry" open={!!initialSentence}><summary><MessageSquareText aria-hidden="true"/><span>{{fr:'Décrire ma recherche en une phrase',en:'Describe my search in one sentence',zh:'用一句话描述需求'}[lang]}</span><ChevronRight aria-hidden="true"/></summary>
    <SmartSearch lang={lang} items={catalogueItems} initialText={initialSentence} onApply={patch=>{
      const next={...defaultFilters,...patch,sort:appliedFilters.sort};
      setFilters(next);applyFilters(next);
    }}/></details>
    <div className="property-library"><div role="group" aria-label={libraryCopy.saved}>{(['all','saved','recent'] as const).map(value=><button key={value} type="button" aria-pressed={collection===value} onClick={()=>chooseCollection(value)}>{libraryCopy[value]}{value!=='all'&&<span>{catalogueItems.filter(item=>library[value].includes(item.reference||item.id)).length}</span>}</button>)}</div>{collection!=='all'&&<p>{libraryCopy.note}{collection==='recent'&&<button type="button" onClick={clearRecent}>{libraryCopy.clear}</button>}</p>}</div>
    <div className="results-toolbar" ref={resultsHeading} tabIndex={-1}><div className="result-count" role="status"><strong>{filtered.length} {filtered.length === 1 ? c.result : c.results}</strong><span>{publicListingsEnabled ? pub.listings : c.countNote}</span></div><div className="results-controls"><label>{c.sort}<select value={filters.sort} onChange={event => change({ sort: event.target.value as Filters["sort"] },true)}>{Object.entries(c.sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="view-toggle"><button type="button" aria-label={c.grid} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid aria-hidden="true" /></button><button type="button" aria-label={c.list} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /></button></div></div></div>
    {active.length > 0 && <div className="filter-chips" aria-label={c.active}>{active.map(key => <button key={key} type="button" aria-label={`${c.remove}: ${chip(key)}`} onClick={() => change({ [key]: defaultFilters[key] },true)}>{chip(key)}<X aria-hidden="true" /></button>)}<button type="button" className="clear-filters" onClick={reset}>{c.reset}</button></div>}
    {live.loading && <p role="status">{pub.loading}</p>}
    {live.error && <p role="alert">{pub.actionError}</p>}
    {publicListingsEnabled && !live.loading && !live.error && !live.items.length && <p>{pub.noPublic}</p>}
    {!publicListingsEnabled && <DemoNotice lang={lang} />}
    {filtered.length ? <div className={`property-grid ${view === "list" ? "property-list" : ""}`}>{filtered.map((item, index) => <PropertyCard key={item.id} item={item} lang={lang} query={query} eager={index < 3} />)}</div> : <div className="listing-empty"><Search aria-hidden="true" /><h2>{collection==='all'?c.empty:libraryCopy.empty}</h2><p>{collection==='all'?c.emptyHelp:libraryCopy.help}</p><button type="button" onClick={()=>{setFilters(defaultFilters);setAppliedFilters(defaultFilters);setCollection('all');history.replaceState(history.state,'',cataloguePath(lang));window.dispatchEvent(new PopStateEvent('popstate'));}}>{collection==='all'?c.reset:libraryCopy.browse}</button></div>}
    <CategoryGuide lang={lang} type={appliedFilters.type} />
    <section className="catalogue-seller-banner"><div><h2>{c.sellerTitle}</h2><p>{c.sellerText}</p></div><a href="#publier" className="catalogue-cta">{pub.publish}<ArrowRight aria-hidden="true" /></a></section>
    </div>
    </div>
  </div>;
}
