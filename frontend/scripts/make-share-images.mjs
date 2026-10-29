// Creates a 1200×630 share image per published property and language, from its
// public cover photo with the heading and price on top:
//   public/social/properties/{reference}-{lang}.jpg
// Run after importing listings or changing a price:
//   npm install --no-save sharp && node scripts/make-share-images.mjs [--refresh]
// Existing images are kept unless --refresh. The SEO build uses an image only
// when its file exists, and falls back to the site-wide image otherwise.
import {access,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {languages,propertyHeading} from '../src/seo.ts';
import {isImportedPhotoPath} from '../src/lib/imported-photo-path.ts';

const sharp=await import('sharp').then(module=>module.default,()=>{throw Error('Install sharp first: npm install --no-save sharp');});
const frontend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(frontend,'public/social/properties');
const env={...loadEnv('production',frontend,''),...process.env};
const refresh=process.argv.includes('--refresh');
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await client.from('published_listings').select('listing_number,property,photo_paths').order('listing_number').limit(1000);
if(error)throw Error(`Public catalogue could not be read: ${error.message}`);
await mkdir(output,{recursive:true});

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const font=`'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', sans-serif`;
const locale=lang=>lang==='zh'?'zh-CN':`${lang}-CA`;
function price(property,lang){
  const value=property.transaction==='rent'?property.rentPrice??property.price:property.price;
  if(typeof value!=='number'||!(value>0))return '';
  return new Intl.NumberFormat(locale(lang),{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value)
    +(property.transaction==='rent'?{en:'/month',fr:'/mois',zh:'/月'}[lang]:'')
    +(property.taxExtra?{en:' + GST/QST',fr:' + TPS/TVQ',zh:' + GST/QST'}[lang]:'');
}
// SVG text does not wrap. Break on spaces (or anywhere in Chinese), at most two lines.
function lines(text,max){
  const words=/[㐀-鿿]/.test(text)?[...text]:text.split(' ');
  const joiner=/[㐀-鿿]/.test(text)?'':' ';
  const result=[''];
  for(const word of words){
    const next=result.at(-1)?result.at(-1)+joiner+word:word;
    if(next.length<=max||!result.at(-1))result[result.length-1]=next;
    else if(result.length<2)result.push(word);
    else{result[1]=result[1].slice(0,max-1).trimEnd()+'…';break;}
  }
  return result;
}
function overlay(property,reference,lang){
  const [label,place=property.city]=propertyHeading(lang,property).split(' — ');
  const title=lines(place,40),amount=price(property,lang);
  const ref={en:'Ref.',fr:'Réf.',zh:'编号'}[lang];
  const titleTop=amount?400:450;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.2" stop-color="#0a2422" stop-opacity="0"/><stop offset="0.55" stop-color="#0a2422" stop-opacity="0.62"/><stop offset="1" stop-color="#0a2422" stop-opacity="0.95"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect x="48" y="40" rx="22" width="270" height="44" fill="#ffffff" fill-opacity="0.92"/>
  <text x="70" y="70" font-family="${font}" font-size="22" font-weight="700" fill="#123f3e">Propriété En Vente</text>
  <text x="56" y="${titleTop-58}" font-family="${font}" font-size="28" font-weight="700" fill="#e3f1e8">${escape(label)}</text>
  ${title.map((line,index)=>`<text x="56" y="${titleTop+index*54}" font-family="${font}" font-size="46" font-weight="700" fill="#ffffff">${escape(line)}</text>`).join('')}
  ${amount?`<text x="56" y="${titleTop+title.length*54+40}" font-family="${font}" font-size="52" font-weight="800" fill="#ffffff">${escape(amount)}</text>`:''}
  <text x="1144" y="590" text-anchor="end" font-family="${font}" font-size="22" fill="#cfe3d8">${ref} ${escape(reference)} · proprieteenvente.ca</text>
</svg>`);
}

let made=0,kept=0,skipped=0;
for(const row of data){
  const reference=String(row.listing_number),photo=row.photo_paths?.[0];
  // Only permanent public photos; uploaded photos are private and signed per visit.
  if(!photo||!isImportedPhotoPath(photo)){skipped++;continue;}
  const source=path.join(frontend,'public',photo);
  if(!await access(source).then(()=>true,()=>false)){skipped++;continue;}
  const property={...row.property,district:row.property.title||row.property.district};
  for(const lang of languages){
    const target=path.join(output,`${reference}-${lang}.jpg`);
    if(!refresh&&await access(target).then(()=>true,()=>false)){kept++;continue;}
    // Illustrations carry their own large caption; soften them so the text stays readable.
    const placeholder=row.property?.source?.placeholder===true;
    const base=sharp(source).resize(1200,630,{fit:'cover',position:'attention'});
    await (placeholder?base.blur(18).modulate({brightness:0.8}):base).composite([{input:overlay(property,reference,lang)}]).jpeg({quality:80,mozjpeg:true}).toFile(target);
    made++;
  }
}
console.log(`Share images: ${made} created, ${kept} kept, ${skipped} properties without a public photo.`);
