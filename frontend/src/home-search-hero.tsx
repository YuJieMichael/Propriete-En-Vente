import {useState,type FormEvent} from 'react';
import {ArrowRight,ArrowUpRight,Baby,Hotel,MapPin,Search} from 'lucide-react';
import type {Language} from './seller-copy';
import homeCopy from './home-copy.json';
import {catalogueHref,cataloguePath,categoryPath,homePath} from './seo';
import {queueSearchIntent} from './lib/discovery-handoff';
import {openInSite} from './lib/public-navigation';
import './home-search-hero.css';

const searchCopy={
 en:{eyebrow:'Montréal & Québec',publish:'List a property',query:'Location or search criteria',placeholder:'e.g. a motel in Montréal',type:'Property type',search:'Search',all:'All properties',hotel:'Hotels & motels',hotelHint:'Guest rooms, location and asking price',daycare:'Daycares',daycareHint:'Capacity, subsidy status and premises',land:'Land',business:'Businesses',house:'Houses',condo:'Condos',plex:'Plexes',commercial:'Commercial',browse:'Browse all listings',wanted:'Post a property request',review:'Describe your search, then review the suggested filters.',error:'We couldn’t transfer your search. Open the listings and try again.',open:'Browse listings'},
 fr:{eyebrow:'Montréal et le Québec',publish:'Publier une annonce',query:'Lieu ou critères de recherche',placeholder:'Ex. : un motel à Montréal',type:'Type de propriété',search:'Rechercher',all:'Toutes les propriétés',hotel:'Hôtels et motels',hotelHint:'Chambres, emplacement et prix demandé',daycare:'Garderies',daycareHint:'Capacité, subvention et locaux',land:'Terrains',business:'Entreprises',house:'Maisons',condo:'Condos',plex:'Plex',commercial:'Commercial',browse:'Voir toutes les annonces',wanted:'Publier ma recherche',review:'Décrivez votre recherche, puis vérifiez les filtres proposés.',error:'Votre recherche n’a pas été transférée. Ouvrez les annonces et réessayez.',open:'Voir les annonces'},
 zh:{eyebrow:'蒙特利尔及魁北克省',publish:'发布房源',query:'城市、地区或找房需求',placeholder:'输入城市、地区，或一句话描述需求',type:'物业类型',search:'搜索房源',all:'全部物业',hotel:'酒店 / 汽车旅馆',hotelHint:'查看客房数量、位置与挂牌价格',daycare:'托儿所',daycareHint:'了解名额、补贴类型与场地',land:'土地',business:'企业',house:'独立屋',condo:'公寓',plex:'多户住宅',commercial:'商业物业',browse:'浏览全部房源',wanted:'发布匿名求购卡',review:'支持一句话找房，进入目录后可核对识别出的条件。',error:'找房需求暂时无法带入，请打开目录后重新输入。',open:'打开房源目录'}
};

export function HomeSearchHero({lang}:{lang:Language}){
 const t=searchCopy[lang],d=homeCopy[lang];
 const [query,setQuery]=useState(''),[type,setType]=useState(''),[error,setError]=useState(false);
 const href=catalogueHref(lang,type?new URLSearchParams({type}).toString():'');
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError(false);
  // Keep sentence criteria private and retain the catalogue's review step.
  // Blank browsing clears an old handoff without depending on browser storage.
  if(!queueSearchIntent(query)&&query.trim()){setError(true);return;}
  openInSite(href);
 }
 const options=[['',t.all],['hotel-motel',t.hotel],['daycare',t.daycare],['land',t.land],['business',t.business],['house',t.house],['condo',t.condo],['plex',t.plex],['commercial',t.commercial]];
 return <section id="top" className="search-home" aria-labelledby="home-search-title">
  <div className="home-search-shell">
   <div className="home-search-meta"><p>{t.eyebrow}</p><a href="#publier">{t.publish}<ArrowUpRight aria-hidden="true"/></a></div>
   <h1 id="home-search-title">{d.heroTitle}</h1>
   <p className="home-search-intro">{d.heroText}</p>
   <form className="home-search-form" onSubmit={submit}>
    <label className="home-search-query"><span>{t.query}</span><span className="home-search-input"><MapPin aria-hidden="true"/><input name="query" value={query} onChange={event=>setQuery(event.target.value)} maxLength={300} placeholder={t.placeholder}/></span></label>
    <label className="home-search-type"><span>{t.type}</span><select name="propertyType" value={type} onChange={event=>setType(event.target.value)}>{options.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <button type="submit" className="home-search-submit"><Search aria-hidden="true"/>{t.search}</button>
   </form>
   {error?<p className="home-search-note home-search-error" role="alert">{t.error} <a href={href}>{t.open} →</a></p>:<p className="home-search-note">{t.review}</p>}
   <nav className="home-search-priority" aria-label={{en:'Hotels, motels and daycares',fr:'Hôtels, motels et garderies',zh:'酒店、汽车旅馆与托儿所'}[lang]}>
    <a href={categoryPath(lang,'hotel-motel')} className="home-search-hotel"><span className="home-search-category-icon"><Hotel aria-hidden="true"/></span><span><strong>{t.hotel}</strong><small>{t.hotelHint}</small></span><ArrowUpRight aria-hidden="true"/></a>
    <a href={categoryPath(lang,'daycare')} className="home-search-daycare"><span className="home-search-category-icon"><Baby aria-hidden="true"/></span><span><strong>{t.daycare}</strong><small>{t.daycareHint}</small></span><ArrowUpRight aria-hidden="true"/></a>
   </nav>
   <nav className="home-search-other" aria-label={{en:'More property types',fr:'Autres types de propriétés',zh:'其他物业类型'}[lang]}>
    <a href={categoryPath(lang,'land')}>{t.land}</a><a href={categoryPath(lang,'business')}>{t.business}</a><a href={catalogueHref(lang,'type=house')}>{t.house}</a><a href={catalogueHref(lang,'type=condo')}>{t.condo}</a>
   </nav>
   <div className="home-search-links"><a href={cataloguePath(lang)}>{t.browse}<ArrowRight aria-hidden="true"/></a><a href={homePath(lang)+'#recherches'}>{t.wanted}<ArrowUpRight aria-hidden="true"/></a></div>
  </div>
 </section>;
}
