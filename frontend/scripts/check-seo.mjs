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
  assert(!url.includes('#'));assert(!url.includes('demo-'));
}
assert((await readFile(new URL('robots.txt',dist),'utf8')).includes('Allow: /'));
assert((await readFile(new URL('404.html',dist),'utf8')).includes('noindex,follow'));
console.log(`Verified ${urls.length} static pages: content, unique metadata, canonical, reciprocal hreflang, asset paths, sitemap and 404.`);
