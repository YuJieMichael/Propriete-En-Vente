import {PropertyLocation,propertyMapLinks} from './property-location';
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bath, BedDouble, Blocks, Building, Building2, CarFront, ChevronRight, ExternalLink, House, Info, LandPlot, LayoutGrid, List, MapPin, Search, SlidersHorizontal, Square, Trees, X } from "lucide-react";
import type { Language } from "./seller-copy";
import { listingsCopy } from "./listings-copy";
import { defaultFilters, filterQuery, invalidPriceRange, listingFallback, listings, readFilters, selectListings, type Filters, type Listing, type PropertyType } from "./listings-data";
import "./listings.css";
import { publicationCopy } from "./publication-copy";
import { usePublicListings, publicListingsEnabled } from "./lib/public-listings";
import {PriceRange} from './price-range';

const locale = (lang: Language) => lang === "zh" ? "zh-CN" : `${lang}-CA`;
const money = (price: number, lang: Language) => new Intl.NumberFormat(locale(lang), { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(price);
const number = (value: number, lang: Language) => new Intl.NumberFormat(locale(lang)).format(value);
const propertyTypes: PropertyType[] = ["house", "condo", "plex", "commercial", "land"];

function transactionLabel(item:Listing,lang:Language){
  return {fr:{sale:'À vendre',rent:'À louer','sale-rent':'À vendre / À louer'},en:{sale:'For sale',rent:'For rent','sale-rent':'For sale / For rent'},zh:{sale:'出售',rent:'出租','sale-rent':'出售／出租'}}[lang][item.transaction||'sale'];
}
function listingPrice(item:Listing,lang:Language){
  const month={fr:'/mois',en:'/month',zh:'/月'}[lang];
  const taxes=item.taxExtra?({fr:' + TPS/TVQ',en:' + GST/QST',zh:' + GST/QST'}[lang]):'';
  return money(item.price,lang)+(item.transaction==='rent'?month:'')+taxes;
}
function ListingPhoto({ item, lang, eager = false }: { item: Listing; lang: Language; eager?: boolean }) {
  const c = listingsCopy[lang];
  return <img src={item.image} alt={`${item.real ? publicationCopy[lang].photos : c.photoNote} · ${c.types[item.type]}`} loading={eager ? "eager" : "lazy"} onError={event => {
    if (!event.currentTarget.src.endsWith("/propriete-en-vente-hero.png")) event.currentTarget.src = listingFallback;
  }} />;
}

function Facts({ item, lang }: { item: Listing; lang: Language }) {
  const c = listingsCopy[lang];
  return <div className="property-facts">
    {item.beds !== null && <span><BedDouble aria-hidden="true" />{item.beds}<span className="listing-sr-only"> {c.bedroomCount}</span></span>}
    {item.baths !== null && <span><Bath aria-hidden="true" />{item.baths}<span className="listing-sr-only"> {c.bathroomCount}</span></span>}
    {item.area!==null&&<span><Square aria-hidden="true" />{number(item.area, lang)} {c.sqft}</span>}{item.area===null&&item.lotArea!=null&&<span><Square aria-hidden="true" />{number(item.lotArea,lang)} {c.sqft} · {{fr:"terrain",en:"land",zh:"土地"}[lang]}</span>}
  </div>;
}

function PropertyMetrics({item,lang}:{item:Listing;lang:Language}){
  const c=listingsCopy[lang];
  const text={fr:{beds:'ch.',baths:'s. de bain',parking:'places',outdoor:'Extérieur'},en:{beds:'beds',baths:'baths',parking:'spaces',outdoor:'Outdoor'},zh:{beds:'卧室',baths:'浴室',parking:'车位',outdoor:'户外空间'}}[lang];
  const parkingCount=typeof item.parkingSpaces==='number'&&Number.isFinite(item.parkingSpaces)&&item.parkingSpaces>0?item.parkingSpaces:null;
  const parkingUnit=parkingCount===1?({fr:'place',en:'space',zh:'车位'}[lang]):text.parking;
  return <div className="property-metrics">
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
  return <article className="property-card">
    <a className="property-card-link" href={`#propriete/${item.id}${query}`} aria-label={`${c.details} · ${c.types[item.type]} · ${item.district} · ${listingPrice(item, lang)}`}>
      <div className="listing-photo"><ListingPhoto item={item} lang={lang} eager={eager} /><span className="property-demo">{item.source?.placeholder?({fr:"Illustration",en:"Illustration",zh:"示意图"}[lang]):item.real ? transactionLabel(item,lang) : c.demo}</span>{item.source?.placeholder&&<span className="property-transaction">{transactionLabel(item,lang)}</span>}<span className="listing-photo-type">{c.types[item.type]}</span></div>
      <div className="property-card-body">
        <div className="property-price-row"><strong>{listingPrice(item, lang)}</strong><ArrowRight aria-hidden="true" /></div>
        <h3>{item.district}</h3><p className="property-city"><MapPin aria-hidden="true" />{item.city}{item.postal?` · ${item.postal}`:""}</p>
        <Facts item={item} lang={lang} />
        <div className="property-card-footer"><span className={item.mode === "owner" ? "owner-label" : "broker-label"}>{item.mode === "owner" ? (item.real ? publicationCopy[lang].hybrid : c.owner) : c.broker}</span><span>{c.details}<ChevronRight aria-hidden="true" /></span></div>
      </div>
    </a>
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
    <div className="section-heading"><div><p className="eyebrow">{c.eyebrow}</p><h2>{c.browseTitle}</h2><p>{c.browseText}</p></div><a href="#proprietes" className="listing-text-link">{c.viewAll}<ArrowRight aria-hidden="true" /></a></div>
    {!publicListingsEnabled && <DemoNotice lang={lang} />}
    {live.loading && <p role="status">{pub.loading}</p>}
    {live.error && <p role="alert">{pub.actionError}</p>}
    {publicListingsEnabled && !live.loading && !live.error && !items.length && <p>{pub.noPublic}</p>}
    <div className="property-grid">{items.slice(0, 3).map(item => <PropertyCard key={item.id} item={item} lang={lang} />)}</div>
  </section>;
}

export function ListingsPage({ lang, hash }: { lang: Language; hash: string }) {
  const live = usePublicListings();
  const catalogueItems = publicListingsEnabled ? live.items : listings;
  const pub = publicationCopy[lang];
  const c = listingsCopy[lang];
  const [filters, setFilters] = useState<Filters>(() => readFilters(location.hash));
  const [appliedFilters,setAppliedFilters]=useState<Filters>(()=>readFilters(location.hash));
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsHeading=useRef<HTMLDivElement>(null);
  const detailId = hash.startsWith("#propriete/") ? hash.slice("#propriete/".length).split("?")[0] : null;
  useEffect(() => { const next=readFilters(location.hash);setFilters(next);setAppliedFilters(next); }, [hash]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [detailId]);

  function applyFilters(next:Filters){
    setAppliedFilters(next);
    history.replaceState(history.state,"",`#proprietes${filterQuery(next)}`);
  }
  function change(patch: Partial<Filters>,immediate=false) {
    const next = { ...filters, ...patch };
    setFilters(next);
    if(immediate)applyFilters(next);
  }
  function reset() { change(defaultFilters,true); }
  const query = filterQuery(appliedFilters);
  const filtered = selectListings(catalogueItems, appliedFilters);
  const invalid = invalidPriceRange(filters);
  const active = (Object.keys(defaultFilters) as (keyof Filters)[]).filter(key => key !== "sort" && Boolean(appliedFilters[key]));
  const extraCount = [filters.baths, filters.mode, filters.parking, filters.outdoor].filter(Boolean).length;
  function chip(key: keyof Filters) {
    const value = appliedFilters[key];
    switch (key) {
      case "q": return String(value);
      case "transaction": return appliedFilters.transaction==="rent"?({fr:"À louer",en:"For rent",zh:"出租"}[lang]):({fr:"À vendre",en:"For sale",zh:"出售"}[lang]);
      case "type": return c.types[appliedFilters.type as PropertyType];
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
    const item = catalogueItems.find(item => item.id === detailId);
    const reference=item?.reference && /^\d+$/.test(item.reference)?item.reference:undefined;
    const mapLinks=item?propertyMapLinks(item):null;
    const googleMapHref=mapLinks?.google;
    const appleMapHref=mapLinks?.apple;
    return <div className="catalogue property-detail"><div className="catalogue-shell">
      <a className="listing-back" href={`#proprietes${query}`}><ArrowLeft aria-hidden="true" />{c.back}</a>
      {item ? <>
        {!item.real && <DemoNotice lang={lang} />}
        <div className="detail-heading"><div><p className="eyebrow">{c.types[item.type]} · {item.city}</p><h1 ref={heading} tabIndex={-1}>{item.district}</h1><p><MapPin aria-hidden="true" />{item.city}, Québec{item.postal?` · ${item.postal}`:""}</p>{!item.source&&<nav className="detail-map-links" aria-label={c.mapLinks}><a href={googleMapHref} target="_blank" rel="noopener noreferrer">{c.googleMaps}<ExternalLink aria-hidden="true" /></a><a href={appleMapHref} target="_blank" rel="noopener noreferrer">{c.appleMaps}<ExternalLink aria-hidden="true" /></a><span>{c.mapAreaHint}</span></nav>}</div><div className="detail-price"><span className="detail-transaction">{transactionLabel(item,lang)}</span><span>{item.transaction==='rent'?({fr:'Loyer mensuel',en:'Monthly rent',zh:'月租金'}[lang]):c.price}</span><strong>{listingPrice(item, lang)}</strong></div></div>
        {item.transaction==="sale-rent"&&<p>{({fr:"Également à louer",en:"Also for rent",zh:"也可出租"}[lang])} : {money(item.rentPrice!,lang)}{({fr:"/mois",en:"/month",zh:"/月"}[lang])}</p>}{reference&&<p className="listing-reference">{c.reference} : {reference}</p>}
        <figure className="detail-image"><ListingPhoto item={item} lang={lang} eager /><figcaption>{item.source?.placeholder?({fr:"Illustration; photo réelle non publiée.",en:"Illustration; property photo not published.",zh:"示意图，未公开实拍照片。"}[lang]):item.real ? pub.photos : c.photoNote}</figcaption></figure>
        {item.real && <div className="publication-photo-gallery">{item.photos?.slice(1).map((src,i)=><img src={src} key={src} alt={`${pub.photos} ${i+2}`} loading="lazy" />)}</div>}
        {item.video&&<section className="detail-section"><h2>{lang==='fr'?'Vidéo de la propriété':lang==='en'?'Property video':'房屋视频'}</h2><video src={item.video} controls playsInline preload="metadata" style={{width:'100%',maxHeight:560}}/></section>}
        <div className="detail-columns"><div>
          {!!item.features?.length&&<section className="detail-section"><h2>{{fr:'Caractéristiques et équipements',en:'Features and amenities',zh:'物业参数与设施'}[lang]}</h2><dl className="detail-facts imported-features">{item.features.map(feature=><div key={feature.key}><dt>{feature.label[lang]}</dt><dd>{feature.value[lang]}</dd></div>)}</dl></section>}
          <section className="detail-section"><h2>{c.overview}</h2><p className="publication-description">{item.descriptionTranslations?.[lang] || item.description || c.about[item.type]}</p></section>
          <section className="detail-section"><h2>{c.facts}</h2><PropertyMetrics item={item} lang={lang}/><dl className="detail-facts">{[
            [c.type, c.types[item.type]], ... (item.lotArea!=null?[[({fr:"Superficie du terrain",en:"Lot area",zh:"土地面积"}[lang]),`${number(item.lotArea,lang)} ${c.sqft}`]]:[]), [c.location, item.city], [c.mode, item.mode === "owner" ? c.owner : c.broker], [item.real ? ({en:"Published",fr:"Publication",zh:"发布日期"}[lang]) : c.date, new Intl.DateTimeFormat(locale(lang), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))], ...(reference?[[c.reference,reference]]:[]),
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
          <aside className="detail-contact"><span className="detail-contact-icon"><House aria-hidden="true" /></span><h2>{item.real ? pub.contact : c.contactTitle}</h2><p>{item.real ? pub.contactText : c.contactText}</p><a href={item.real ? `#acheter?listing=${encodeURIComponent(reference||"")}` : "#vendre"} className="catalogue-cta">{item.real ? pub.enquire : c.contactLink}<ArrowRight aria-hidden="true" /></a><a href={`#proprietes${query}`} className="listing-text-link">{c.back}</a></aside>
        </div>
        {item.source&&<PropertyLocation item={item} lang={lang}/>}
        <section className="detail-related"><h2>{c.nearby}</h2><div className="property-grid">{catalogueItems.filter(other => other.id !== item.id).sort((a, b) => Number(b.type === item.type) - Number(a.type === item.type)).slice(0, 3).map(other => <PropertyCard key={other.id} item={other} lang={lang} query={query} />)}</div></section>
      </> : <div className="listing-empty"><House aria-hidden="true" /><h1 ref={heading} tabIndex={-1}>{c.notFound}</h1><a href={`#proprietes${query}`} className="catalogue-cta">{c.back}</a></div>}
    </div></div>;
  }
  return <div className="catalogue"><div className="catalogue-shell">
    <div className="catalogue-heading"><div><p className="eyebrow">{c.eyebrow}</p><h1 ref={heading} tabIndex={-1}>{c.title}</h1><p>{c.intro}</p></div><a className="catalogue-sell" href="#publier">{pub.publish}<ArrowRight aria-hidden="true" /></a></div>
    <div className="property-type-tabs" aria-label={c.type}><button type="button" aria-pressed={!filters.type} onClick={() => change({ type: "" },true)}><LayoutGrid aria-hidden="true"/>{c.all}</button>{propertyTypes.map(type => <button type="button" key={type} aria-pressed={filters.type === type} onClick={() => change({ type },true)}>{type === "house" ? <House aria-hidden="true" /> : type === "condo" ? <Building aria-hidden="true" /> : type === "plex" ? <Blocks aria-hidden="true" /> : type === "commercial" ? <Building2 aria-hidden="true" /> : <LandPlot aria-hidden="true" />}{c.types[type]}</button>)}</div>
    <label className="transaction-filter">{{fr:"Transaction",en:"Listing",zh:"交易类型"}[lang]} <select value={filters.transaction||""} onChange={event=>change({transaction:event.target.value as Filters["transaction"]})}><option value="">{{fr:"Vente et location",en:"Sale and rent",zh:"出售及出租"}[lang]}</option><option value="sale">{{fr:"À vendre",en:"For sale",zh:"出售"}[lang]}</option><option value="rent">{{fr:"À louer",en:"For rent",zh:"出租"}[lang]}</option></select></label>
    <form className="listing-filters" role="search" aria-label={c.browse} onSubmit={event => {event.preventDefault();if(invalid)return;applyFilters(filters);resultsHeading.current?.scrollIntoView({behavior:'smooth',block:'start'});resultsHeading.current?.focus({preventScroll:true});}}>
      <div className="filter-main"><label className="filter-location">{c.search}<span><Search aria-hidden="true" /><input type="search" maxLength={120} placeholder={c.searchPlaceholder} value={filters.q} onChange={event => change({ q: event.target.value })} /></span></label>
        <PriceRange filters={filters} lang={lang} invalid={invalid} onChange={change} ceiling={Math.max(filters.transaction==='rent'?5000:1000000,...catalogueItems.filter(item=>(!filters.type||item.type===filters.type)&&(!filters.transaction||(filters.transaction==='rent'?item.transaction==='rent'||item.transaction==='sale-rent':item.transaction!=='rent'))).map(item=>item.price))}/>
        <label>{c.beds}<select value={filters.beds} onChange={event => change({ beds: event.target.value })}><option value="">{c.any}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n===5?'+':''}</option>)}</select></label>
        <button className={`more-filters ${expanded ? "expanded" : ""}`} type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="extra-listing-filters"><SlidersHorizontal aria-hidden="true" />{expanded ? c.less : c.more}{extraCount > 0 && <span>{extraCount}</span>}</button>
      </div>
      {expanded && <div className="filter-extra" id="extra-listing-filters"><label>{c.baths}<select value={filters.baths} onChange={event => change({ baths: event.target.value })}><option value="">{c.any}</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}</select></label><label>{c.mode}<select value={filters.mode} onChange={event => change({ mode: event.target.value as Filters["mode"] })}><option value="">{c.any}</option><option value="owner">{c.owner}</option><option value="broker">{c.broker}</option></select></label><label className="filter-checkbox"><input type="checkbox" checked={filters.parking} onChange={event => change({ parking: event.target.checked })} /><CarFront aria-hidden="true" />{c.parking}</label><label className="filter-checkbox"><input type="checkbox" checked={filters.outdoor} onChange={event => change({ outdoor: event.target.checked })} /><Trees aria-hidden="true" />{c.outdoor}</label></div>}
      {invalid && <p className="filter-error" id="price-range-error" role="alert">{c.rangeError}</p>}
      <div className="filter-submit"><button type="submit" className="catalogue-cta" disabled={invalid}><Search aria-hidden="true"/>{({fr:'Rechercher',en:'Search',zh:'搜索'}[lang])}</button></div>
    </form>
    {active.length > 0 && <div className="filter-chips" aria-label={c.active}>{active.map(key => <button key={key} type="button" aria-label={`${c.remove}: ${chip(key)}`} onClick={() => change({ [key]: defaultFilters[key] },true)}>{chip(key)}<X aria-hidden="true" /></button>)}<button type="button" className="clear-filters" onClick={reset}>{c.reset}</button></div>}
    <div className="results-toolbar" ref={resultsHeading} tabIndex={-1}><div className="result-count" role="status"><strong>{filtered.length} {filtered.length === 1 ? c.result : c.results}</strong><span>{publicListingsEnabled ? pub.listings : c.countNote}</span></div><div className="results-controls"><label>{c.sort}<select value={filters.sort} onChange={event => change({ sort: event.target.value as Filters["sort"] },true)}>{Object.entries(c.sorts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div className="view-toggle"><button type="button" aria-label={c.grid} aria-pressed={view === "grid"} onClick={() => setView("grid")}><LayoutGrid aria-hidden="true" /></button><button type="button" aria-label={c.list} aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" /></button></div></div></div>
    {live.loading && <p role="status">{pub.loading}</p>}
    {live.error && <p role="alert">{pub.actionError}</p>}
    {publicListingsEnabled && !live.loading && !live.error && !live.items.length && <p>{pub.noPublic}</p>}
    {!publicListingsEnabled && <DemoNotice lang={lang} />}
    {filtered.length ? <div className={`property-grid ${view === "list" ? "property-list" : ""}`}>{filtered.map((item, index) => <PropertyCard key={item.id} item={item} lang={lang} query={query} eager={index < 3} />)}</div> : <div className="listing-empty"><Search aria-hidden="true" /><h2>{c.empty}</h2><p>{c.emptyHelp}</p><button type="button" onClick={reset}>{c.reset}</button></div>}
    <section className="catalogue-seller-banner"><div><h2>{c.sellerTitle}</h2><p>{c.sellerText}</p></div><a href="#publier" className="catalogue-cta">{pub.publish}<ArrowRight aria-hidden="true" /></a></section>
  </div></div>;
}
