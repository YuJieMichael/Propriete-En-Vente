import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {origin,languages,homePath,cataloguePath,propertyPath,pageSeo,pageSocialMetadata,seoCopy,categories,categoryPath,categoryCopy,propertyHeading,propertySummary,cityPages,cityPath,citySlug,cityCopy,cityPageSeo,structuredData,structuredDataTags,welcomeTaxPath,welcomeTaxSeo,propertyShareImage} from '../src/seo.ts';
import {taxScales,welcomeTaxYear} from '../src/lib/welcome-tax.ts';
import {overviewTitle,propertyOverview} from '../src/property-overview.ts';
import {relatedListings} from '../src/listing-navigation.ts';
import {isImportedPhotoPath} from '../src/lib/imported-photo-path.ts';
import {hotelAcquisitionCopy,hotelAcquisitionHref} from '../src/hotel-acquisition-copy.ts';
import {commercialSummaryCopy,commercialSummaryRows} from '../src/commercial-summary.ts';
import {commercialIntakeCopy} from '../src/commercial-listing-copy.ts';
import {listingsCopy} from '../src/listings-copy.ts';
import {publicationCopy} from '../src/publication-copy.ts';
import {compareNewest} from '../src/lib/catalogue-order.ts';
import {cardPhotoSources,cardSizes} from '../src/lib/card-photo.ts';

const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(frontend,'../dist');
const env={...loadEnv('production',frontend,''),...process.env};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=JSON.parse(await readFile(path.join(frontend,'src/home-copy.json'),'utf8'));
const photoVersions=JSON.parse(await readFile(path.join(frontend,'src/photo-versions.json'),'utf8'));
const template=await readFile(path.join(output,'index.html'),'utf8');
const rows=[];
if(env.VITE_LISTING_PUBLICATION_ENABLED==='true'){
  const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!env.VITE_SUPABASE_URL||!key)throw Error('Public catalogue configuration is required for the SEO build.');
  const anon=key.startsWith('sb_publishable_') || (()=>{try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{return false;}})();
  if(!anon)throw Error('Only a public Supabase key may be used for the SEO build.');
  const client=createClient(env.VITE_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
  for(let start=0;;start+=500){
    const {data,error}=await client.from('published_listings').select('id,listing_number,property,published_at,photo_paths').order('id').range(start,start+499);
    if(error)throw Error(`Public catalogue could not be read: ${error.message}`);
    rows.push(...data);if(data.length<500)break;
  }
} else console.warn('Public catalogue disabled: generating language entry pages only.');
// Use the same public location fields as the browser catalogue. A listing's
// title can be an address; its actual neighbourhood is stored separately.
// Only permanent public photo paths go into structured data; uploaded photos use expiring signed links.
function publicPhoto(row){const first=row.photo_paths?.[0];return row.property?.confidential!==true&&first&&isImportedPhotoPath(first)?first:undefined;}
const assetExists=asset=>access(path.join(output,asset.split('?')[0])).then(()=>true,()=>false);
const items=await Promise.all(rows.sort(compareNewest).map(async row=>{
  const photo=publicPhoto(row);
  const image=photo&&await assetExists(photo)?photo+(photoVersions[photo]?`?v=${photoVersions[photo]}`:''):undefined;
  const sources=image?cardPhotoSources(image,cardSizes):{};
  const thumbnail=sources.srcSet?.split(' ')[0];
  const coverSources=thumbnail&&await assetExists(thumbnail)?sources:{};
  return {...row.property,id:row.id,district:row.property.title||row.property.district,neighbourhood:row.property.district,reference:String(row.listing_number||row.id),publishedAt:row.published_at,image,coverSources,real:true,property:row.property};
}));
const cities=cityPages(items);
const paths=[];
const heading=(tag,value)=>`<${tag}>${escape(value)}</${tag}>`;
const link=(href,text)=>`<a href="${escape(href)}">${escape(text)}</a>`;
function cards(lang,type,values=items){return '<ul>'+values.filter(item=>!type||item.type===type).map(item=>{
  const title=propertyHeading(lang,item),summary=propertySummary(lang,item);
  return `<li>${link(propertyPath(lang,item.reference),title)}${summary!==title?heading('p',summary):''}</li>`;
}).join('')+'</ul>';}
function priceText(item,lang,rent=false){
  const value=rent?item.rentPrice:item.price;
  if(typeof value!=='number'||!Number.isFinite(value))return '';
  const monthly=rent||item.transaction==='rent';
  return new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value)
    +(monthly?{en:'/month',fr:'/mois',zh:'/月'}[lang]:'')
    +(item.taxExtra?{en:' + GST/QST',fr:' + TPS/TVQ',zh:' + GST/QST'}[lang]:'');
}
const illustrationLabel={en:'Illustration — property photo not published',fr:'Illustration — photo réelle non publiée',zh:'示意图 · 未公开实拍照片'};
function propertyPreview(item,lang,title){
  if(item.confidential)return `<p class="static-property-withheld">${escape(commercialIntakeCopy[lang].withheld)}</p>`;
  // Use only reviewed, permanent images already included in the public build.
  if(!item.image)return '';
  const illustration=item.source?.placeholder===true;
  return `<figure class="static-property-media"><img src="${escape(item.image)}" alt="${escape(illustration?illustrationLabel[lang]:title)}" />${illustration?`<figcaption>${escape(illustrationLabel[lang])}</figcaption>`:''}</figure>`;
}
function previewCover(item,{lazy=false,sizes=cardSizes}={}){
  if(!item.image)return '';
  const srcSet=item.coverSources.srcSet;
  return `<img src="${escape(item.image)}"${srcSet?` srcset="${escape(srcSet)}" sizes="${escape(sizes)}"`:''}${lazy?' loading="lazy"':''} alt="" />`;
}
function previewCards(lang,values){
  const c=listingsCopy[lang];
  if(!values.length)return heading('p',publicationCopy[lang].noPublic);
  return `<ul class="static-listing-grid">${values.map((entry,index)=>{
    const title=propertyHeading(lang,entry),summary=propertySummary(lang,entry),price=priceText(entry,lang);
    const note=entry.confidential?commercialIntakeCopy[lang].withheld:entry.source?.placeholder?c.photoNote:'';
    return `<li class="static-listing-card"><a href="${escape(propertyPath(lang,entry.reference))}"><div class="static-listing-cover">${previewCover(entry,{lazy:index>=3})}${note?`<span>${escape(note)}</span>`:''}</div><div class="static-listing-card-body">${heading('small',entry.city)}${heading('strong',title)}${price?`<b>${escape(price)}</b>`:''}</div></a>${summary!==title?heading('p',summary):''}</li>`;
  }).join('')}</ul>`;
}
function homePreview(lang,d){
  const c=listingsCopy[lang];
  const covers=items.filter(entry=>entry.image&&!entry.source?.placeholder).slice(0,3);
  const mosaic=covers.length===3?`<nav class="home-mosaic static-home-mosaic" aria-label="${escape(c.browseTitle)}">${covers.map(entry=>{
    const title=propertyHeading(lang,entry);
    return `<a class="home-mosaic-tile" href="${escape(propertyPath(lang,entry.reference))}" aria-label="${escape(title)}">${previewCover(entry,{sizes:'(max-width: 700px) 34vw, 260px'})}<span class="home-mosaic-chip">${heading('small',entry.city)}${heading('strong',priceText(entry,lang))}</span></a>`;
  }).join('')}</nav>`:'';
  const shortcuts=categories.map(type=>link(categoryPath(lang,type),c.types[type])).join('');
  const hero=`<section class="search-home"><div class="home-search-shell"><div class="home-search-top"><div class="home-search-copy">${heading('h1',d.heroTitle)}<p class="home-search-intro">${escape(d.heroText)}</p><div class="static-home-actions"><a class="home-search-submit" href="${cataloguePath(lang)}">${escape(c.browse)}</a>${link(homePath(lang)+'#publier',c.sell)}</div><nav class="home-search-other" aria-label="${escape(c.type)}">${shortcuts}</nav></div>${mosaic}</div></div></section>`;
  const featured=`<section id="proprietes" class="static-home-featured static-catalogue"><div class="static-listing-section-heading">${heading('h2',seoCopy[lang].catalogue)}${link(cataloguePath(lang),c.viewAll)}</div>${previewCards(lang,items)}</section>`;
  const guide=`<section class="static-home-guide static-catalogue" id="parcours">${heading('h2',d.routeTitle)}${heading('h3',d.sellerTitle)}${heading('p',d.sellerText)}${heading('h3',d.buyerTitle)}${heading('p',d.buyerText)}${heading('h2',d.differenceTitle)}${heading('p',d.differenceText)}</section>`;
  return hero+featured+guide;
}
function cataloguePreview(lang,values,headingHtml,extraHtml){
  const c=listingsCopy[lang];
  const pending=`<div class="static-filter-pending"><div class="static-listing-section-heading"><p role="status">${escape(publicationCopy[lang].loading)}</p>${link(cataloguePath(lang),c.all)}</div><div class="static-listing-grid" aria-hidden="true"><span></span><span></span><span></span></div></div>`;
  return `<div class="static-catalogue-content"><div class="static-catalogue-heading">${headingHtml}</div>${extraHtml}<div class="static-catalogue-results">${previewCards(lang,values)}</div>${pending}</div>`;
}
// A query can change matching results or order. Wait for the actual filtered list instead of flashing the default snapshot.
const catalogueFilterMarker=`<script>if([...new URLSearchParams(location.search)].some(([key,value])=>value&&!/^(utm_|gclid$|gbraid$|wbraid$|fbclid$|msclkid$)/i.test(key)))document.documentElement.dataset.staticCatalogueFiltered="";</script>`;
async function generate(lang,kind,item,type,city){
  const route=l=>kind==='welcome-tax'?welcomeTaxPath(l):kind==='city'?cityPath(l,city.slug):kind==='property'?propertyPath(l,item.reference):kind==='catalogue'?type?categoryPath(l,type):cataloguePath(l):homePath(l);
  const meta=kind==='welcome-tax'?welcomeTaxSeo[lang]:kind==='city'?cityPageSeo(lang,city):pageSeo(lang,kind,item,type);
  const jsonLd=structuredDataTags(structuredData(lang,kind==='welcome-tax'?{kind}:kind==='city'?{kind,city}:kind==='property'?{kind,item}:kind==='catalogue'?{kind,type}:{kind:'home'}),route(lang));
  const sharePath=kind==='property'?propertyShareImage(lang,item.reference):'';
  const shared=sharePath&&await access(path.join(output,sharePath)).then(()=>true,()=>false)?{path:sharePath,alt:propertyHeading(lang,item)}:undefined;
  const social=pageSocialMetadata(lang,origin+route(lang),meta,shared);
  const socialTags=Object.entries(social).flatMap(([attribute,fields])=>Object.entries(fields).map(([name,content])=>`<meta ${attribute}="${name}" content="${escape(content)}" />`)).join('\n');
  const alternates=[...languages,'x-default'].map(l=>`<link rel="alternate" hreflang="${l==='zh'?'zh-Hans':l}" href="${origin}${route(l==='x-default'?'fr':l)}" />`).join('\n');
  const d=copy[lang];
  const isCatalogue=kind==='catalogue'||kind==='city';
  const isProperty=kind==='property';
  const previewKind=isCatalogue?'catalogue':isProperty?'property':kind==='home'?'home':'';
  let body;
  if(kind==='home') body=homePreview(lang,d);
  else if(kind==='catalogue') {
    const guide=categoryCopy(lang,type);
    let extra='';
    if(type==='hotel-motel'){
      const hotel=hotelAcquisitionCopy[lang];
      extra=`<section class="hotel-acquisition">${heading('p',hotel.eyebrow)}${heading('h2',hotel.title)}${heading('p',hotel.intro)}${heading('h3',hotel.criteriaTitle)}<dl>${hotel.criteria.map(([label,text])=>`<dt>${escape(label)}</dt><dd>${escape(text)}</dd>`).join('')}</dl>${link(hotelAcquisitionHref(lang),hotel.cta)}${heading('p',hotel.privacy)}</section>`;
    }
    body=cataloguePreview(lang,items.filter(entry=>!type||entry.type===type),heading('h1',guide?.title||seoCopy[lang].catalogue)+heading('p',guide?.description||seoCopy[lang].description),extra);
    if(guide)body+=heading('h2',type==='hotel-motel'?hotelAcquisitionCopy[lang].guideTitle:{en:'Prepare your purchase',fr:'Préparer votre achat',zh:'购前准备'}[lang])+heading('p',guide.intro)+guide.questions.map(([q,a])=>`<details><summary>${escape(q)}</summary>${heading('p',a)}</details>`).join('');
    if(type!=='hotel-motel')body+=link(homePath(lang)+'#acheter',{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]);
  }
  else if(kind==='welcome-tax') {
    const names={montreal:{en:'Montréal',fr:'Montréal',zh:'蒙特利尔'},quebec:{en:'Québec City',fr:'Ville de Québec',zh:'魁北克市'},provincial:{en:'Provincial minimum',fr:'Barème provincial minimal',zh:'全省最低税率'}};
    const amount=value=>Number.isFinite(value)?new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value):'∞';
    body=heading('h1',welcomeTaxSeo[lang].heading)+heading('p',welcomeTaxSeo[lang].description)+Object.entries(taxScales).map(([scale,brackets])=>heading('h2',`${names[scale][lang]} · ${welcomeTaxYear}`)+'<ul>'+brackets.map((bracket,index)=>`<li>${escape(amount(index?brackets[index-1].upTo:0))} – ${escape(amount(bracket.upTo))} : ${bracket.rate*100} %</li>`).join('')+'</ul>').join('')+link(cataloguePath(lang),seoCopy[lang].catalogue);
  }
  else if(kind==='city') {
    const guide=cityCopy(lang,city);
    const breadcrumb=`<nav aria-label="${{en:'Breadcrumb',fr:'Fil d’Ariane',zh:'位置导航'}[lang]}">${link(cataloguePath(lang),seoCopy[lang].catalogue)}</nav>`;
    body=cataloguePreview(lang,items.filter(entry=>citySlug(entry.city)===city.slug),breadcrumb+heading('h1',guide.title)+heading('p',guide.description),'')+link(homePath(lang)+'#acheter',{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]);
  }
  else {
    const p=item.property;
    const title=propertyHeading(lang,item),summary=propertySummary(lang,item);
    const price=priceText(item,lang);
    const deal=commercialSummaryRows(item,lang);
    const category=categories.includes(item.type)?categoryCopy(lang,item.type):undefined;
    const breadcrumb=`<nav aria-label="${{en:'Breadcrumb',fr:'Fil d’Ariane',zh:'位置导航'}[lang]}">${link(cataloguePath(lang),seoCopy[lang].catalogue)}${category?' · '+link(categoryPath(lang,item.type),category.title):''}</nav>`;
    body=breadcrumb+`<div class="static-property-heading"><div>${heading('h1',title)}${heading('p',`${item.city}, Québec · ${item.reference}`)}</div>${price?`<strong class="static-property-price">${escape(price)}</strong>`:''}</div>`+
      propertyPreview(item,lang,title)+
      (deal.length?heading('h2',commercialSummaryCopy[lang].title)+'<dl>'+deal.map(([label,value])=>heading('dt',label)+heading('dd',value)).join('')+'</dl>':'')+
      (item.transaction==='sale-rent'&&priceText(item,lang,true)?heading('p',`${{en:'Also for rent',fr:'Également à louer',zh:'也可出租'}[lang]} : ${priceText(item,lang,true)}`):'')+
      (summary!==title?`<p class="property-summary">${escape(summary)}</p>`:'')+`<p class="publication-description">${escape(item.descriptionTranslations?.[lang]||item.description)}</p>`+
      `<section class="listing-overview">${heading('h2',overviewTitle[lang])}${propertyOverview(lang,item).map(text=>heading('p',text)).join('')}</section>`+
      '<dl>'+(p.features||[]).map(f=>heading('dt',f.label[lang])+heading('dd',f.value[lang])).join('')+'</dl>';
    const related=relatedListings(item,items);
    if(related.length)body+=`<section class="detail-related">${heading('h2',{en:'Keep exploring',fr:'Continuez à explorer',zh:'继续浏览'}[lang])}${cards(lang,undefined,related)}</section>`;
  }
  const nav=previewKind
    ? `<nav><a class="static-public-brand" href="${homePath(lang)}"><img src="/favicon.svg" width="37" height="37" alt="" />Propriété En Vente</a>${link(cataloguePath(lang),listingsCopy[lang].browse)}<div class="static-public-languages">${languages.map(l=>`<a href="${escape(route(l))}" lang="${l}"${l===lang?' aria-current="page"':''}>${l==='zh'?'中文':l.toUpperCase()}</a>`).join('')}</div></nav>`
    : `<nav>${link(homePath(lang),'Propriété En Vente')} · ${link(cataloguePath(lang),seoCopy[lang].catalogue)} · ${languages.map(l=>link(route(l),l==='zh'?'中文':l.toUpperCase())).join(' · ')}</nav>`;
  const footer=`<footer class="static-page"><nav>${categories.map(type=>link(categoryPath(lang,type),categoryCopy(lang,type).title)).join(' · ')} · ${link(welcomeTaxPath(lang),welcomeTaxSeo[lang].heading)}</nav>${cities.length?`<nav>${cities.map(other=>link(cityPath(lang,other.slug),cityCopy(lang,other).title)).join(' · ')}</nav>`:''}</footer>`;
  const html=template.replace(/<html lang="[^"]*"/,'<html lang="'+(lang==='zh'?'zh-Hans':lang)+'"')
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${origin}${route(lang)}" />\n<meta name="robots" content="index,follow" />\n${alternates}`)
    .replace('</head>',()=>`${socialTags}\n${jsonLd}\n${isCatalogue?catalogueFilterMarker:''}</head>`)
    .replace('<div id="root"></div>',()=>`<div id="root"><header class="static-page${previewKind?' static-public-header':''}">${nav}</header><main class="static-page${previewKind?` static-${previewKind}`:''}">${isProperty?`<div class="static-property-content">${body}</div>`:body}</main>${footer}</div>`);
  const file=path.join(output,route(lang),'index.html');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,html);
  paths.push(route(lang));
  if(lang==='fr'&&kind==='home')await writeFile(path.join(output,'index.html'),html);
}
for(const lang of languages){await generate(lang,'home');await generate(lang,'catalogue');await generate(lang,'welcome-tax');for(const type of categories)await generate(lang,'catalogue',undefined,type);for(const city of cities)await generate(lang,'city',undefined,undefined,city);for(const item of items)await generate(lang,'property',item);}
await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p=>`<url><loc>${origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(output,'404.html'),`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Page introuvable | Propriété En Vente</title></head><body><h1>Page introuvable / Page not found / 页面不存在</h1>${link('/fr/','Accueil')} · ${link('/en/','Home')} · ${link('/zh/','首页')}</body></html>`);
console.log(`SEO: ${paths.length} public URLs (${items.length} published properties and ${cities.length} city pages in 3 languages).`);
