// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {cardPhotoSources,cardSizes,fallBackToFullPhoto} from '../src/lib/card-photo';

it('offers the 640 px thumbnail for imported cover photos only',()=>{
  expect(cardPhotoSources('/centris/19078347/001.webp',cardSizes)).toEqual({srcSet:'/centris/19078347/001-640w.webp 640w, /centris/19078347/001.webp 1260w',sizes:cardSizes});
  for(const src of ['/centris/19078347/002.webp','https://example.supabase.co/storage/v1/object/sign/photo.jpg?token=x','/propriete-en-vente-hero.png'])expect(cardPhotoSources(src,cardSizes)).toEqual({});
});

it('switches to the full photo once when a thumbnail is missing',()=>{
  const image=document.createElement('img');
  image.setAttribute('srcset','/centris/19078347/001-640w.webp 640w, /centris/19078347/001.webp 1260w');image.setAttribute('sizes',cardSizes);
  expect(fallBackToFullPhoto(image,'/centris/19078347/001.webp')).toBe(true);
  expect(image.hasAttribute('srcset')).toBe(false);expect(image.getAttribute('src')).toBe('/centris/19078347/001.webp');
  expect(fallBackToFullPhoto(image,'/centris/19078347/001.webp')).toBe(false);
});
