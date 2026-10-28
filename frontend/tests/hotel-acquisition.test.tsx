// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import {HotelAcquisitionIntro} from '../src/hotel-acquisition';
import {hotelAcquisitionCopy,hotelAcquisitionHref} from '../src/hotel-acquisition-copy';
import {CategoryGuide} from '../src/category-guide';
import {categoryCopy,categoryPath,pageSeo,type SeoLanguage} from '../src/seo';

let root:Root|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;document.body.innerHTML='';});
async function render(lang:SeoLanguage,type='hotel-motel'){
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root!.render(<>{type==='hotel-motel'&&<HotelAcquisitionIntro lang={lang}/>}<CategoryGuide lang={lang} type={type}/></>));
}

it.each(['fr','en','zh'] as const)('offers one localized hotel acquisition action with a public prefill intent in %s',async lang=>{
  await render(lang);const t=hotelAcquisitionCopy[lang];
  const intro=document.querySelector('.hotel-acquisition')!;
  expect(intro.querySelector('h2')?.textContent).toBe(t.title);
  expect(intro.querySelectorAll('.hotel-acquisition-criteria li')).toHaveLength(3);
  const links=[...document.querySelectorAll<HTMLAnchorElement>('a')];expect(links).toHaveLength(1);
  expect(links[0].textContent).toBe(t.cta);expect(links[0].dataset.acquisitionEntry).toBe('hotel');
  expect(links[0].getAttribute('href')).toBe(hotelAcquisitionHref(lang));
  const url=new URL(links[0].href);expect(url.pathname).toBe(`/${lang}/`);
  expect(url.search).toBe('');const [route,query]=url.hash.split('?');expect(route).toBe('#acheter');
  expect([...new URLSearchParams(query)]).toEqual([['propertyType','hotel-motel'],['intent','hotel-acquisition']]);
  expect(document.querySelector('.hotel-acquisition-guide h2')?.textContent).toBe(t.guideTitle);
  expect(document.querySelectorAll('.hotel-acquisition-guide details')).toHaveLength(3);
  expect(document.querySelector('.hotel-acquisition-guide a')).toBeNull();
  expect(document.querySelector('form')).toBeNull();
  expect(intro.textContent).not.toMatch(/7\s+(listings|hôtels)|rendement|guaranteed|收益|免费服务|精选|best price/i);
});

it('keeps the existing category routes and shared static metadata focused on the same hotel intent',()=>{
  for(const lang of ['fr','en','zh'] as const){
    expect(categoryPath(lang,'hotel-motel')).toBe(`/${lang}/proprietes/hotels-motels/`);
    const copy=categoryCopy(lang,'hotel-motel')!,meta=pageSeo(lang,'catalogue',undefined,'hotel-motel');
    expect(meta.title).toBe(`${copy.title} | Propriété En Vente`);expect(meta.description).toBe(copy.description);
    expect(copy.questions).toHaveLength(3);
    expect(copy.questions[0][1]).toContain({fr:'budget',en:'budget',zh:'预算'}[lang]);
    expect(copy.questions[2][1]).toContain({fr:'privé',en:'privately',zh:'私密'}[lang]);
  }
});

it('preserves the general search action for other categories',async()=>{
  await render('fr','daycare');expect(document.querySelector('.hotel-acquisition')).toBeNull();expect(document.querySelector('.hotel-acquisition-guide')).toBeNull();
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/fr/#acheter');
  expect(document.querySelector('a')?.textContent).toBe('Préciser ma recherche');
});
