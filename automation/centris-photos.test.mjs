import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {sourcePhotoWebp,fullSizeUrl} from './centris-photos.mjs';

const source='https://mspublic.centris.ca/media.ashx?id=test&t=pi&w=320&h=240&sm=c';
const jpeg=(width,height)=>sharp({create:{width,height,channels:3,background:'#ddd'}}).jpeg().toBuffer();

test('requests the full-size gallery photo instead of the mosaic thumbnail',async()=>{
  assert.equal(fullSizeUrl(source).href,'https://mspublic.centris.ca/media.ashx?id=test&t=pi&w=1260&h=1024&sm=m');
  const big=await jpeg(1260,840),seen=[];
  const image=await sourcePhotoWebp(source,{fetchImpl:async(url,options)=>{
    seen.push(url.href);assert.equal(options.redirect,'error');
    return new Response(big,{headers:{'Content-Type':'image/jpeg'}});
  }});
  const result=await sharp(image).metadata();
  assert.deepEqual(seen,[fullSizeUrl(source).href]);
  assert.equal(result.format,'webp');assert.equal(result.width,1260);assert.equal(result.height,840);
});
test('falls back to the advertised URL when the full-size request is empty, not an image or no larger',async()=>{
  const small=await jpeg(320,240);
  for(const fullResponse of [()=>new Response(''),()=>new Response('',{headers:{'Content-Type':'image/jpeg'}}),()=>new Response('<html/>',{headers:{'Content-Type':'text/html'}}),()=>new Response('x',{status:404}),()=>new Response(small,{headers:{'Content-Type':'image/jpeg'}})]){
    const seen=[];
    const image=await sourcePhotoWebp(source,{fetchImpl:async url=>{seen.push(url.href);return url.href===source?new Response(small,{headers:{'Content-Type':'image/jpeg'}}):fullResponse();}});
    assert.deepEqual(seen,[fullSizeUrl(source).href,source]);
    assert.equal((await sharp(image).metadata()).width,320);
  }
});
test('empty HTTP 200, non-image responses and failed requests cannot become listing photos',async()=>{
  for(const response of [()=>new Response(''),()=>new Response('',{headers:{'Content-Type':'image/jpeg'}}),()=>new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}),()=>new Response('Unavailable',{status:503})]){
    await assert.rejects(()=>sourcePhotoWebp(source,{fetchImpl:async()=>response()}),/Source photo failed|Invalid source photo size/);
  }
  await assert.rejects(()=>sourcePhotoWebp('https://example.com/media.ashx'),/Untrusted photo URL/);
});
