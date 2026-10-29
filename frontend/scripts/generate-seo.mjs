import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {origin,languages,homePath,cataloguePath,propertyPath,pageSeo,pageSocialMetadata,seoCopy,categories,categoryPath,categoryCopy,propertyHeading,propertySummary,cityPages,cityPath,citySlug,cityCopy,cityPageSeo,structuredData,structuredDataTags,propertyShareImage} from '../src/seo.ts';
import {relatedListings} from '../src/listing-navigation.ts';
import {isImportedPhotoPath} from '../src/lib/imported-photo-path.ts';
import {hotelAcquisitionCopy,hotelAcquisitionHref} from '../src/hotel-acquisition-copy.ts';

const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(frontend,'../dist');
const env={...loadEnv('production',frontend,''),...process.env};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=JSON.parse(await readFile(path.join(frontend,'src/home-copy.json'),'utf8'));
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
function publicPhoto(row){const first=row.photo_paths?.[0];return row.property?.source?.provider==='centris'&&first&&isImportedPhotoPath(first)?first:undefined;}
const items=rows.map(row=>({...row.property,id:row.id,district:row.property.title||row.property.district,neighbourhood:row.property.district,reference:String(row.listing_number||row.id),publishedAt:row.published_at,image:publicPhoto(row),real:true,property:row.property}))
const cities=cityPages(items);;
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
async function generate(lang,kind,item,type,city){
  const route=l=>kind==='city'?cityPath(l,city.slug):kind==='property'?propertyPath(l,item.reference):kind==='catalogue'?type?categoryPath(l,type):cataloguePath(l):homePath(l);
  const meta=kind==='city'?cityPageSeo(lang,city):pageSeo(lang,kind,item,type);
  const jsonLd=structuredDataTags(structuredData(lang,kind==='city'?{kind,city}:kind==='property'?{kind,item}:kind==='catalogue'?{kind,type}:{kind:'home'}),route(lang));
  const sharePath=kind==='property'?propertyShareImage(lang,item.reference):'';
  const shared=sharePath&&await access(path.join(output,sharePath)).then(()=>true,()=>false)?{path:sharePath,alt:propertyHeading(lang,item)}:undefined;
  const social=pageSocialMetadata(lang,origin+route(lang),meta,shared);
  const socialTags=Object.entries(social).flatMap(([attribute,fields])=>Object.entries(fields).map(([name,content])=>`<meta ${attribute}="${name}" content="${escape(content)}" />`)).join('\n');
  const alternates=[...languages,'x-default'].map(l=>`<link rel="alternate" hreflang="${l==='zh'?'zh-Hans':l}" href="${origin}${route(l==='x-default'?'fr':l)}" />`).join('\n');
  const d=copy[lang];
  let body;
  if(kind==='home') body=heading('h1',d.heroTitle)+heading('p',d.heroText)+heading('h2',d.routeTitle)+heading('h3',d.sellerTitle)+heading('p',d.sellerText)+heading('h3',d.buyerTitle)+heading('p',d.buyerText)+heading('h2',d.differenceTitle)+heading('p',d.differenceText)+heading('h2',seoCopy[lang].catalogue)+cards(lang);
  else if(kind==='catalogue') {
    const guide=categoryCopy(lang,type);
    body=heading('h1',guide?.title||seoCopy[lang].catalogue)+heading('p',guide?.description||seoCopy[lang].description);
    if(type==='hotel-motel'){
      const hotel=hotelAcquisitionCopy[lang];
      body+=`<section class="hotel-acquisition">${heading('p',hotel.eyebrow)}${heading('h2',hotel.title)}${heading('p',hotel.intro)}${heading('h3',hotel.criteriaTitle)}<dl>${hotel.criteria.map(([label,text])=>`<dt>${escape(label)}</dt><dd>${escape(text)}</dd>`).join('')}</dl>${link(hotelAcquisitionHref(lang),hotel.cta)}${heading('p',hotel.privacy)}</section>`;
    }
    body+=cards(lang,type);
    if(guide)body+=heading('h2',type==='hotel-motel'?hotelAcquisitionCopy[lang].guideTitle:{en:'Prepare your purchase',fr:'Préparer votre achat',zh:'购前准备'}[lang])+heading('p',guide.intro)+guide.questions.map(([q,a])=>`<details><summary>${escape(q)}</summary>${heading('p',a)}</details>`).join('');
    if(type!=='hotel-motel')body+=link(homePath(lang)+'#acheter',{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]);
  }
  else if(kind==='city') {
    const guide=cityCopy(lang,city);
    body=`<nav aria-label="${{en:'Breadcrumb',fr:'Fil d’Ariane',zh:'位置导航'}[lang]}">${link(cataloguePath(lang),seoCopy[lang].catalogue)}</nav>`+heading('h1',guide.title)+heading('p',guide.description)+cards(lang,undefined,items.filter(other=>citySlug(other.city)===city.slug))+link(homePath(lang)+'#acheter',{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]);
  }
  else {
    const p=item.property;
    const title=propertyHeading(lang,item),summary=propertySummary(lang,item);
    const category=categories.includes(item.type)?categoryCopy(lang,item.type):undefined;
    const breadcrumb=`<nav aria-label="${{en:'Breadcrumb',fr:'Fil d’Ariane',zh:'位置导航'}[lang]}">${link(cataloguePath(lang),seoCopy[lang].catalogue)}${category?' · '+link(categoryPath(lang,item.type),category.title):''}</nav>`;
    body=breadcrumb+heading('h1',title)+heading('p',`${item.city}, Québec · ${item.reference}`)+heading('p',priceText(item,lang))+
      (item.transaction==='sale-rent'&&priceText(item,lang,true)?heading('p',`${{en:'Also for rent',fr:'Également à louer',zh:'也可出租'}[lang]} : ${priceText(item,lang,true)}`):'')+
      (summary!==title?`<p class="property-summary">${escape(summary)}</p>`:'')+`<p class="publication-description">${escape(item.descriptionTranslations?.[lang]||item.description)}</p>`+
      '<dl>'+(p.features||[]).map(f=>heading('dt',f.label[lang])+heading('dd',f.value[lang])).join('')+'</dl>';
    const related=relatedListings(item,items);
    if(related.length)body+=`<section class="detail-related">${heading('h2',{en:'Keep exploring',fr:'Continuez à explorer',zh:'继续浏览'}[lang])}${cards(lang,undefined,related)}</section>`;
  }
  const nav=`<nav>${link(homePath(lang),'Propriété En Vente')} · ${link(cataloguePath(lang),seoCopy[lang].catalogue)} · ${languages.map(l=>link(route(l),l==='zh'?'中文':l.toUpperCase())).join(' · ')}</nav>`;
  const footer=`<footer><nav>${categories.map(type=>link(categoryPath(lang,type),categoryCopy(lang,type).title)).join(' · ')}</nav>${cities.length?`<nav>${cities.map(other=>link(cityPath(lang,other.slug),cityCopy(lang,other).title)).join(' · ')}</nav>`:''}</footer>`;
  const html=template.replace(/<html lang="[^"]*"/,'<html lang="'+(lang==='zh'?'zh-Hans':lang)+'"')
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${origin}${route(lang)}" />\n<meta name="robots" content="index,follow" />\n${alternates}`)
    .replace('</head>',()=>`${socialTags}\n${jsonLd}\n</head>`)
    .replace('<div id="root"></div>',`<div id="root"><header>${nav}</header><main class="section">${body}</main>${footer}</div>`);
  const file=path.join(output,route(lang),'index.html');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,html);
  paths.push(route(lang));
  if(lang==='fr'&&kind==='home')await writeFile(path.join(output,'index.html'),html);
}
for(const lang of languages){await generate(lang,'home');await generate(lang,'catalogue');for(const type of categories)await generate(lang,'catalogue',undefined,type);for(const city of cities)await generate(lang,'city',undefined,undefined,city);for(const item of items)await generate(lang,'property',item);}
await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p=>`<url><loc>${origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(output,'404.html'),`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Page introuvable | Propriété En Vente</title></head><body><h1>Page introuvable / Page not found / 页面不存在</h1>${link('/fr/','Accueil')} · ${link('/en/','Home')} · ${link('/zh/','首页')}</body></html>`);
console.log(`SEO: ${paths.length} public URLs (${items.length} published properties and ${cities.length} city pages in 3 languages).`);
