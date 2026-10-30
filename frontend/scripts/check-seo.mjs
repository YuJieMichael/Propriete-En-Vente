import {readFile} from 'node:fs/promises';
import {strict as assert} from 'node:assert';
import {JSDOM} from 'jsdom';
const dist=new URL('../../dist/',import.meta.url);
const sitemap=await readFile(new URL('sitemap.xml',dist),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert(urls.length>=6);assert.equal(new Set(urls).size,urls.length);
const titles=new Set(),descriptions=new Set();
let ownImages=0;
// Share images must be baseline or progressive JPEGs of exactly 1200×630.
function assertShareJpeg(jpeg,file){
  assert(jpeg[0]===0xff&&jpeg[1]===0xd8,`Not a JPEG: ${file}`);
  for(let offset=2;offset<jpeg.length;){
    const marker=jpeg[offset+1],length=jpeg.readUInt16BE(offset+2);
    if(marker===0xc0||marker===0xc2){assert.equal(jpeg.readUInt16BE(offset+5),630,file);assert.equal(jpeg.readUInt16BE(offset+7),1200,file);return;}
    offset+=2+length;
  }
  assert.fail(`No JPEG size: ${file}`);
}
const publicPaths=new Set(urls.map(url=>new URL(url).pathname));
const propertyCount=urls.filter(url=>/\/proprietes\/\d+\/$/.test(new URL(url).pathname)).length/3;
for(const url of urls){
  const route=new URL(url).pathname;
  const html=await readFile(new URL(route.slice(1)+'index.html',dist),'utf8');
  const doc=new JSDOM(html).window.document;
  assert.equal(doc.querySelector('link[rel=canonical]').href,url);
  assert.equal(doc.querySelector('meta[name=robots]').content,'index,follow');
  assert.equal(doc.querySelectorAll('link[hreflang]').length,4);
  assert(doc.querySelector('main h1')?.textContent);
  assert.equal(doc.querySelectorAll('main h1').length,1,`Ambiguous main heading: ${url}`);
  assert(doc.querySelector('script[type=module]')?.getAttribute('src').startsWith('/assets/'));
  for(const link of doc.querySelectorAll('link[hreflang]'))assert(urls.includes(link.href));
  assert(!titles.has(doc.title),`Duplicate title: ${url}`);titles.add(doc.title);
  const description=doc.querySelector('meta[name=description]').content;
  assert(!descriptions.has(description),`Duplicate description: ${url}`);descriptions.add(description);
  const lang=/^\/(en|fr|zh)\//.exec(route)?.[1];assert(lang);
  const reference=/\/proprietes\/(\d+)\/$/.exec(route)?.[1];
  const own=reference?`social/properties/${reference}-${lang}.jpg`:'';
  const hasOwn=own&&await readFile(new URL(own,dist)).then(jpeg=>{assertShareJpeg(jpeg,own);return true;},()=>false);
  const image=hasOwn?`https://proprieteenvente.ca/${own}`:`https://proprieteenvente.ca/social/og-${lang}.png`;
  if(hasOwn)ownImages++;
  for(const [property,value] of Object.entries({'og:type':'website','og:site_name':'Propriété En Vente','og:title':doc.title,'og:description':description,'og:url':url,'og:locale':{en:'en_CA',fr:'fr_CA',zh:'zh_CN'}[lang],'og:image':image,'og:image:type':hasOwn?'image/jpeg':'image/png','og:image:width':'1200','og:image:height':'630'})){
    assert.equal(doc.querySelectorAll(`meta[property="${property}"]`).length,1);
    assert.equal(doc.querySelector(`meta[property="${property}"]`).content,value);
  }
  for(const [name,value] of Object.entries({'twitter:card':'summary_large_image','twitter:title':doc.title,'twitter:description':description,'twitter:image':image})){
    assert.equal(doc.querySelectorAll(`meta[name="${name}"]`).length,1);
    assert.equal(doc.querySelector(`meta[name="${name}"]`).content,value);
  }
  assert(doc.querySelector('meta[property="og:image:alt"]')?.content);
  assert(doc.querySelector('meta[name="twitter:image:alt"]')?.content);
  for(const anchor of doc.querySelectorAll('main a[href]')){
    const target=new URL(anchor.getAttribute('href'),url);
    if(target.origin===new URL(url).origin)assert(publicPaths.has(target.pathname),`Internal link has no public page: ${url} -> ${target.pathname}`);
  }
  if(/\/proprietes\/\d+\/$/.test(route)){
    assert(!/^(?:Property|Propriété|房源) \d+/.test(doc.title),`Reference leads the search title: ${url}`);
    assert(doc.querySelector('.publication-description')?.textContent.trim()||doc.querySelector('.property-summary')?.textContent.trim(),`Missing factual property introduction: ${url}`);
    const summary=doc.querySelector('.property-summary');
    if(summary)assert.notEqual(summary.textContent,doc.querySelector('main h1').textContent,`Summary repeats the heading: ${url}`);
    assert(doc.querySelector('main nav a[href$="/proprietes/"]'),`Missing catalogue breadcrumb: ${url}`);
    const related=[...doc.querySelectorAll('.detail-related a[href]')];
    assert.equal(related.length,Math.min(3,Math.max(0,propertyCount-1)),`Unexpected related property count: ${url}`);
    assert(related.every(anchor=>anchor.href!==url),`Property recommends itself: ${url}`);
    assert.equal(new Set(related.map(anchor=>anchor.href)).size,related.length,`Duplicate related properties: ${url}`);
  }
  assert(!url.includes('#'));assert(!url.includes('demo-'));
}
for(const lang of ['en','fr','zh']){
  const png=await readFile(new URL(`social/og-${lang}.png`,dist));
  assert(png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),`Invalid share image: ${lang}`);
  assert.equal(png.toString('ascii',12,16),'IHDR');
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
}
const redirects=(await readFile(new URL('_redirects',dist),'utf8')).trim().split(/\r?\n/);
assert.deepEqual(redirects,['en','fr','zh'].map(lang=>`/${lang}/proprietes/07427f6d-a560-5b37-9bd4-b0fe0644dc7f/ /${lang}/proprietes/100011/ 301`));
for(const rule of redirects){
  const [source,target,status]=rule.split(/\s+/);
  assert(source.startsWith('/')&&!source.startsWith('//'));
  assert(target.startsWith('/')&&!target.startsWith('//'));
  assert.equal(status,'301');
  assert(urls.includes(`https://proprieteenvente.ca${target}`),`Redirect target missing from sitemap: ${target}`);
}
assert((await readFile(new URL('robots.txt',dist),'utf8')).includes('Allow: /'));
assert((await readFile(new URL('404.html',dist),'utf8')).includes('noindex,follow'));
console.log(`Verified ${urls.length} static pages (${ownImages} with their own share image): content, unique metadata, factual summaries, public internal links, related properties, canonical, reciprocal hreflang, share tags and images, legacy redirects, asset paths, sitemap and 404.`);
