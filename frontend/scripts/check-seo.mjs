import {readFile} from 'node:fs/promises';
import {strict as assert} from 'node:assert';
import {JSDOM} from 'jsdom';
const dist=new URL('../../dist/',import.meta.url);
const sitemap=await readFile(new URL('sitemap.xml',dist),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert(urls.length>=6);assert.equal(new Set(urls).size,urls.length);
const titles=new Set(),descriptions=new Set();
for(const url of urls){
  const route=new URL(url).pathname;
  const html=await readFile(new URL(route.slice(1)+'index.html',dist),'utf8');
  const doc=new JSDOM(html).window.document;
  assert.equal(doc.querySelector('link[rel=canonical]').href,url);
  assert.equal(doc.querySelector('meta[name=robots]').content,'index,follow');
  assert.equal(doc.querySelectorAll('link[hreflang]').length,4);
  assert(doc.querySelector('main h1')?.textContent);
  assert(doc.querySelector('script[type=module]')?.getAttribute('src').startsWith('/assets/'));
  for(const link of doc.querySelectorAll('link[hreflang]'))assert(urls.includes(link.href));
  assert(!titles.has(doc.title),`Duplicate title: ${url}`);titles.add(doc.title);
  const description=doc.querySelector('meta[name=description]').content;
  assert(!descriptions.has(description),`Duplicate description: ${url}`);descriptions.add(description);
  const lang=/^\/(en|fr|zh)\//.exec(route)?.[1];assert(lang);
  const image=`https://proprieteenvente.ca/social/og-${lang}.png`;
  for(const [property,value] of Object.entries({'og:type':'website','og:site_name':'Propriété En Vente','og:title':doc.title,'og:description':description,'og:url':url,'og:locale':{en:'en_CA',fr:'fr_CA',zh:'zh_CN'}[lang],'og:image':image,'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630'})){
    assert.equal(doc.querySelectorAll(`meta[property="${property}"]`).length,1);
    assert.equal(doc.querySelector(`meta[property="${property}"]`).content,value);
  }
  for(const [name,value] of Object.entries({'twitter:card':'summary_large_image','twitter:title':doc.title,'twitter:description':description,'twitter:image':image})){
    assert.equal(doc.querySelectorAll(`meta[name="${name}"]`).length,1);
    assert.equal(doc.querySelector(`meta[name="${name}"]`).content,value);
  }
  assert(doc.querySelector('meta[property="og:image:alt"]')?.content);
  assert(doc.querySelector('meta[name="twitter:image:alt"]')?.content);
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
console.log(`Verified ${urls.length} static pages: content, unique metadata, canonical, reciprocal hreflang, share tags and images, legacy redirects, asset paths, sitemap and 404.`);
