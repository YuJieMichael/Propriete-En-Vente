import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {origin,languages,homePath,cataloguePath,propertyPath,pageSeo,pageSocialMetadata,seoCopy,categories,categoryPath,categoryCopy} from '../src/seo.ts';

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
    const {data,error}=await client.from('published_listings').select('id,listing_number,property,published_at').order('id').range(start,start+499);
    if(error)throw Error(`Public catalogue could not be read: ${error.message}`);
    rows.push(...data);if(data.length<500)break;
  }
} else console.warn('Public catalogue disabled: generating language entry pages only.');
const items=rows.map(row=>({id:row.id,title:row.property.title,city:row.property.city,description:row.property.description,descriptionTranslations:row.property.descriptionTranslations,reference:String(row.listing_number||row.id),real:true,property:row.property}));
const paths=[];
const heading=(tag,value)=>`<${tag}>${escape(value)}</${tag}>`;
const link=(href,text)=>`<a href="${escape(href)}">${escape(text)}</a>`;
function cards(lang,type){return '<ul>'+items.filter(item=>!type||item.property.type===type).map(item=>`<li>${link(propertyPath(lang,item.reference),`${item.title} · ${item.city} · ${item.reference}`)}</li>`).join('')+'</ul>';}
async function generate(lang,kind,item,type){
  const route=l=>kind==='property'?propertyPath(l,item.reference):kind==='catalogue'?type?categoryPath(l,type):cataloguePath(l):homePath(l);
  const meta=pageSeo(lang,kind,item,type);
  const social=pageSocialMetadata(lang,origin+route(lang),meta);
  const socialTags=Object.entries(social).flatMap(([attribute,fields])=>Object.entries(fields).map(([name,content])=>`<meta ${attribute}="${name}" content="${escape(content)}" />`)).join('\n');
  const alternates=[...languages,'x-default'].map(l=>`<link rel="alternate" hreflang="${l==='zh'?'zh-Hans':l}" href="${origin}${route(l==='x-default'?'fr':l)}" />`).join('\n');
  const d=copy[lang];
  let body;
  if(kind==='home') body=heading('h1',d.heroTitle)+heading('p',d.heroText)+heading('h2',d.routeTitle)+heading('h3',d.sellerTitle)+heading('p',d.sellerText)+heading('h3',d.buyerTitle)+heading('p',d.buyerText)+heading('h2',d.differenceTitle)+heading('p',d.differenceText)+heading('h2',seoCopy[lang].catalogue)+cards(lang);
  else if(kind==='catalogue') {
    const guide=categoryCopy(lang,type);
    body=heading('h1',guide?.title||seoCopy[lang].catalogue)+heading('p',guide?.description||seoCopy[lang].description)+cards(lang,type);
    if(guide)body+=heading('h2',{en:'Prepare your purchase',fr:'Préparer votre achat',zh:'购前准备'}[lang])+heading('p',guide.intro)+guide.questions.map(([q,a])=>`<details><summary>${escape(q)}</summary>${heading('p',a)}</details>`).join('');
    body+=link(homePath(lang)+'#acheter',{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]);
  }
  else {
    const p=item.property;
    body=heading('h1',item.title)+heading('p',`${item.city}, Québec · ${item.reference}`)+heading('p',new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD'}).format(p.price))+
      heading('p',item.descriptionTranslations?.[lang]||item.description)+
      '<dl>'+(p.features||[]).map(f=>heading('dt',f.label[lang])+heading('dd',f.value[lang])).join('')+'</dl>';
  }
  const nav=`<nav>${link(homePath(lang),'Propriété En Vente')} · ${link(cataloguePath(lang),seoCopy[lang].catalogue)} · ${languages.map(l=>link(route(l),l==='zh'?'中文':l.toUpperCase())).join(' · ')}</nav>`;
  const footer=`<footer><nav>${categories.map(type=>link(categoryPath(lang,type),categoryCopy(lang,type).title)).join(' · ')}</nav></footer>`;
  const html=template.replace(/<html lang="[^"]*"/,'<html lang="'+(lang==='zh'?'zh-Hans':lang)+'"')
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/,`<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${origin}${route(lang)}" />\n<meta name="robots" content="index,follow" />\n${alternates}`)
    .replace('</head>',()=>`${socialTags}\n</head>`)
    .replace('<div id="root"></div>',`<div id="root"><header>${nav}</header><main class="section">${body}</main>${footer}</div>`);
  const file=path.join(output,route(lang),'index.html');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,html);
  paths.push(route(lang));
  if(lang==='fr'&&kind==='home')await writeFile(path.join(output,'index.html'),html);
}
for(const lang of languages){await generate(lang,'home');await generate(lang,'catalogue');for(const type of categories)await generate(lang,'catalogue',undefined,type);for(const item of items)await generate(lang,'property',item);}
await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p=>`<url><loc>${origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(output,'404.html'),`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Page introuvable | Propriété En Vente</title></head><body><h1>Page introuvable / Page not found / 页面不存在</h1>${link('/fr/','Accueil')} · ${link('/en/','Home')} · ${link('/zh/','首页')}</body></html>`);
console.log(`SEO: ${paths.length} public URLs (${items.length} published properties in 3 languages).`);
