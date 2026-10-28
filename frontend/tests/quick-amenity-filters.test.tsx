// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ListingsPage} from '../src/listings';
import type {Listing} from '../src/listings-data';
const live=vi.hoisted(()=>({items:[] as Listing[],loading:false,error:false}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>live}));
const pool={id:'49000000-0000-4000-8000-000000000001',labels:{en:'Swimming pool',fr:'Piscine',zh:'泳池'},synonyms:['pool']};
const elevator={id:'49000000-0000-4000-8000-000000000002',labels:{en:'Elevator',fr:'Ascenseur',zh:'电梯'},synonyms:['lift']};
let root:Root;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('scrollTo',vi.fn());history.replaceState(null,'','/en/proprietes/');
 document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
 const base:Listing={id:'both',reference:'100001',type:'condo',district:'Public location',city:'Montréal',postal:'',aliases:'',price:500000,beds:2,baths:1,area:900,date:'2026-10-28',mode:'broker',parking:true,outdoor:false,image:'/sample.png',real:true,keywords:[pool,elevator]};
 live.items=[base,{...base,id:'pool-only',reference:'100002',parking:false,keywords:[pool]},{...base,id:'parking-only',reference:'100003',keywords:[]},{...base,id:'unknown',reference:'100004',parking:null,keywords:[]}];
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();});
const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('.quick-amenity-filters button')].find(b=>b.textContent===label)!;
const count=()=>document.querySelectorAll('.catalogue-results .property-card').length;
it.each([['en','Quick filters','Pool','Parking','Elevator'],['fr','Filtres rapides','Piscine','Stationnement','Ascenseur'],['zh','快捷筛选','泳池','停车','电梯']] as const)('offers localized shortcuts outside the collapsed phone filters in %s',async(lang,group,poolLabel,parkingLabel,liftLabel)=>{
 await act(async()=>root.render(<ListingsPage lang={lang} hash="#proprietes"/>));
 const row=document.querySelector('.quick-amenity-filters');
 expect(row?.getAttribute('aria-label')).toBe(group);
 expect(row?.closest('.catalogue-filters')).toBeNull();
 for(const label of [poolLabel,parkingLabel,liftLabel])expect(button(label)?.getAttribute('aria-pressed')).toBe('false');
 await act(async()=>button(poolLabel).click());
 expect(count()).toBe(2);expect(button(poolLabel).getAttribute('aria-pressed')).toBe('true');expect(location.search).toContain('pool=1');
});
it('toggles multiple amenities immediately and keeps them in detail/back links and the clear action',async()=>{
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes?q=Montréal&max=600000"/>));
 await act(async()=>button('Pool').click());expect(count()).toBe(2);
 await act(async()=>button('Elevator').click());expect(count()).toBe(1);
 await act(async()=>button('Parking').click());expect(count()).toBe(1);
 const href=document.querySelector<HTMLAnchorElement>('.property-card-link')!.href;
 expect(new URL(href).searchParams.get('pool')).toBe('1');expect(new URL(href).searchParams.get('elevator')).toBe('1');
 expect(new URL(href).searchParams.get('q')).toBe('Montréal');expect(new URL(href).searchParams.get('max')).toBe('600000');
 await act(async()=>button('Pool').click());expect(location.search).not.toContain('pool=');expect(button('Pool').getAttribute('aria-pressed')).toBe('false');
 const clear=document.querySelector<HTMLButtonElement>('.quick-amenity-filters .clear-filters')!;
 await act(async()=>clear.click());expect(count()).toBe(4);expect(location.search).toBe('');
 for(const label of ['Pool','Parking','Elevator'])expect(button(label).getAttribute('aria-pressed')).toBe('false');
});
it('shows selected amenities once and merges other removable conditions into the same bar',async()=>{
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes?q=Montréal&max=600000&pool=1&elevator=1&parking=1"/>));
 const row=document.querySelector('.quick-amenity-filters')!;
 expect(document.querySelector('.filter-chips')).toBeNull();
 for(const label of ['Pool','Parking','Elevator']){
  expect([...row.querySelectorAll('button')].filter(b=>b.textContent===label)).toHaveLength(1);
  expect(row.querySelector(`[aria-label="Remove filter: ${label}"]`)).toBeNull();
 }
 const city=[...row.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes('Montréal'))!;
 expect(city).toBeTruthy();
 await act(async()=>city.click());
 const params=new URLSearchParams(location.search);
 expect(params.has('q')).toBe(false);expect(params.get('max')).toBe('600000');
 for(const key of ['pool','parking','elevator'])expect(params.get(key)).toBe('1');
 expect(count()).toBe(1);
});
it('restores shared URL selections on navigation and synchronizes the existing parking checkbox',async()=>{
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes?pool=1&elevator=1&parking=1"/>));
 expect(count()).toBe(1);
 for(const label of ['Pool','Parking','Elevator'])expect(button(label).getAttribute('aria-pressed')).toBe('true');
 await act(async()=>document.querySelector<HTMLButtonElement>('.more-filters')!.click());
 const parking=document.querySelector<HTMLInputElement>('#extra-listing-filters input[type=checkbox]')!;
 expect(parking.checked).toBe(true);
 await act(async()=>parking.click());expect(button('Parking').getAttribute('aria-pressed')).toBe('false');
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
 expect(count()).toBe(4);expect(button('Pool').getAttribute('aria-pressed')).toBe('false');
});
it('keeps pending typed city text when a shortcut applies immediately',async()=>{
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
 vi.useFakeTimers();
 const input=document.querySelector<HTMLInputElement>('.filter-location input')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'Montréal');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>button('Pool').click());
 expect(count()).toBe(2);expect(input.value).toBe('Montréal');expect(new URLSearchParams(location.search).get('q')).toBe('Montréal');
 await act(async()=>vi.advanceTimersByTime(500));
 expect(count()).toBe(2);expect(button('Pool').getAttribute('aria-pressed')).toBe('true');
});
