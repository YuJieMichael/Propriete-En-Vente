import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {sourcePhotoWebp} from './centris-photos.mjs';

const source='https://mspublic.centris.ca/media.ashx?id=test&t=pi&w=640&h=480&sm=c';
test('downloads the advertised image URL without unsupported resizing parameters',async()=>{
  const jpeg=await sharp({create:{width:640,height:480,channels:3,background:'#ddd'}}).jpeg().toBuffer();
  const image=await sourcePhotoWebp(source,{fetchImpl:async(url,options)=>{
    assert.equal(url.href,source);assert.equal(options.redirect,'error');
    return new Response(jpeg,{headers:{'Content-Type':'image/jpeg'}});
  }});
  const result=await sharp(image).metadata();
  assert.equal(result.format,'webp');assert.equal(result.width,640);assert.equal(result.height,480);
});
test('empty HTTP 200, non-image responses and failed requests cannot become listing photos',async()=>{
  for(const response of [new Response(''),new Response('',{headers:{'Content-Type':'image/jpeg'}}),new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}),new Response('Unavailable',{status:503})]){
    await assert.rejects(()=>sourcePhotoWebp(source,{fetchImpl:async()=>response}),/Source photo failed|Invalid source photo size/);
  }
  await assert.rejects(()=>sourcePhotoWebp('https://example.com/media.ashx'),/Untrusted photo URL/);
});
