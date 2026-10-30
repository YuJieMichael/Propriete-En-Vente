// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {parseProperty} from '../../supabase/functions/_shared/listing-input';
import {defaultFilters,filterQuery,readFilters,selectListings,type Listing} from '../src/listings-data';
import {ListingsPage} from '../src/listings';
import {PublishProperty} from '../src/publish-property';
import {queueSearchIntent,takeSearchIntent} from '../src/lib/discovery-handoff';
vi.mock('../src/lib/supabase',()=>({backendConfigured:true,supabase:null}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>({items:items,loading:false,error:false})}));
const base:Listing={id:'subsidized',type:'daycare',daycareSubsidy:'subsidized',city:'Montréal',district:'Daycare A',postal:'H2J 1A1',aliases:'',price:500000,beds:0,baths:1,area:1000,date:'2026-09-29',mode:'broker',parking:false,outdoor:false,image:'/test.png',real:true};
const items:Listing[]=[base,{...base,id:'non-subsidized',district:'Daycare B',daycareSubsidy:'non-subsidized'},{...base,id:'unknown',district:'Daycare C',daycareSubsidy:undefined},{...base,id:'hotel',type:'hotel-motel',daycareSubsidy:undefined}];
let root:ReturnType<typeof createRoot>;
async function render(element:React.ReactNode){
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal('scrollTo',vi.fn());
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(element));
}
afterEach(async()=>{if(root)await act(async()=>root.unmount());document.body.innerHTML='';vi.unstubAllGlobals();sessionStorage.clear();window.history.replaceState(null,'','#proprietes');});
it('preserves a home-page search across an auth-loading remount, then previews it only after handoff is ready',async()=>{
  sessionStorage.clear();
  const sentence='Montréal daycare under 700k';
  const originalUrl='/en/proprietes/';
  window.history.replaceState(null,'',originalUrl);
  expect(queueSearchIntent(sentence)).toBe(true);
  await render(<ListingsPage lang="en" hash="#proprietes" handoffReady={false}/>);
  expect(document.querySelector<HTMLTextAreaElement>('.smart-search textarea')?.value).toBe('');
  expect(document.querySelector('.smart-search-preview')).toBeNull();
  // Auth restoration changes the surrounding layout and remounts the catalogue.
  await act(async()=>root.unmount());
  await render(<ListingsPage lang="en" hash="#proprietes" handoffReady={false}/>);
  expect(document.querySelector<HTMLTextAreaElement>('.smart-search textarea')?.value).toBe('');
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes" handoffReady/>));
  expect(document.querySelector<HTMLTextAreaElement>('.smart-search textarea')?.value).toBe(sentence);
  expect(document.querySelector('.smart-search-preview dl')?.textContent).toContain('Maximum budget');
  expect(document.querySelector<HTMLInputElement>('.filter-location input')?.value).toBe('');
  expect(location.pathname).toBe(originalUrl);expect(location.search).toBe('');
  expect(takeSearchIntent()).toBe('');
  // The sentence itself never enters the URL, and filters still require confirmation.
  await act(async()=>document.querySelector<HTMLButtonElement>('.smart-search-confirm')!.click());
  expect(new URLSearchParams(location.search).get('q')).toBe('Montréal');
  expect(new URLSearchParams(location.search).get('max')).toBe('700000');
  expect(location.pathname).toBe('/en/proprietes/garderies/');
  expect(location.href).not.toContain(encodeURIComponent(sentence));
});
it('retains the new listing types and subsidy metadata through server validation',()=>{
  const p={...base,title:'A property',description:'Details'};
  for(const type of ['land','hotel-motel','business'])expect(parseProperty({...p,type,daycareSubsidy:undefined}).type).toBe(type);
  for(const daycareSubsidy of ['subsidized','non-subsidized'])expect(parseProperty({...p,daycareSubsidy}).daycareSubsidy).toBe(daycareSubsidy);
  for(const extra of [{daycareSubsidy:undefined},{daycareSubsidy:'unknown'},{daycareSubsidy:['subsidized']},{type:'house'}])expect(()=>parseProperty({...p,...extra})).toThrow();
});
it('round-trips subsidy filters and never treats missing subsidy information as non-subsidized',()=>{
  const filters={...defaultFilters,type:'daycare' as const,daycareSubsidy:'non-subsidized' as const};
  expect(readFilters('#proprietes'+filterQuery(filters))).toEqual(filters);
  expect(selectListings(items,filters).map(item=>item.id)).toEqual(['non-subsidized']);
  expect(selectListings(items,{...filters,daycareSubsidy:''})).toHaveLength(3);
  expect(readFilters('#proprietes?type=hotel-motel&daycareSubsidy=subsidized').daycareSubsidy).toBe('');
});
it.each([['fr','Garderie','Subventionnée','Non subventionnée'],['en','Daycare','Subsidized','Non-subsidized'],['zh','托儿机构','有政府补贴','无政府补贴']] as const)('filters daycare listings using localized links in %s',async(lang,daycare,yes,no)=>{
  window.history.replaceState(null,'','#proprietes');await render(<ListingsPage lang={lang} hash="#proprietes"/>);
  const typeButtons=[...document.querySelectorAll<HTMLElement>('.property-type-tabs button,.property-type-tabs a')];
  expect(typeButtons.some(button=>button.textContent==='Commercial')).toBe(false);
  await act(async()=>typeButtons.find(button=>button.textContent===daycare)!.click());
  const subsidyButtons=[...document.querySelectorAll<HTMLButtonElement>('.daycare-filter button')];
  expect(subsidyButtons.map(button=>button.textContent)).toEqual(expect.arrayContaining([yes,no]));
  await act(async()=>subsidyButtons.find(button=>button.textContent===no)!.click());
  expect(document.querySelectorAll('.property-card')).toHaveLength(1);
  expect(document.querySelector('.property-card')!.textContent).toContain('Daycare B');
  expect(location.search).toContain('daycareSubsidy=non-subsidized');
  await act(async()=>typeButtons[0].click());
  expect(document.querySelector('.daycare-filter')).toBeNull();expect(location.search).not.toContain('daycareSubsidy');
});
it('exposes the existing category routes as links while keeping the current client search filters',async()=>{
  window.history.replaceState(null,'','/fr/proprietes/?q=Montr%C3%A9al&max=700000');
  await render(<ListingsPage lang="fr" hash="#proprietes?q=Montr%C3%A9al&max=700000"/>);
  const links=[...document.querySelectorAll<HTMLAnchorElement>('.property-type-tabs a')];
  expect(links.map(link=>link.pathname)).toEqual(['/fr/proprietes/terrains/','/fr/proprietes/hotels-motels/','/fr/proprietes/garderies/','/fr/proprietes/entreprises/']);
  const daycare=links.find(link=>link.pathname.endsWith('/garderies/'))!;
  await act(async()=>daycare.click());
  expect(location.pathname).toBe('/fr/proprietes/garderies/');
  expect(new URLSearchParams(location.search).get('q')).toBe('Montréal');
  expect(new URLSearchParams(location.search).get('max')).toBe('700000');
  expect(daycare.getAttribute('aria-current')).toBe('page');
  expect(document.querySelectorAll('.property-card')).toHaveLength(3);
});
it('shows the subsidy in property details',async()=>{
  await render(<ListingsPage lang="fr" hash="#propriete/subsidized"/>);
  expect(document.querySelector('.detail-facts')?.textContent).toContain('Subventionnée');
  expect(document.querySelector<HTMLAnchorElement>('.detail-breadcrumb a[href="/fr/proprietes/garderies/"]')).not.toBeNull();
  expect(document.querySelector('h1')?.textContent).toContain('Garderie');
  expect(document.querySelector('.property-summary')?.textContent).toContain('1');
  expect(document.querySelector('.detail-breadcrumb [aria-current=page]')?.textContent).toBe('Daycare A');
});
it('requires an explicit subsidy choice when preparing a daycare listing and clears it when changing type',async()=>{
  await render(<PublishProperty lang="fr"/>);
  const select=document.querySelector<HTMLSelectElement>('select[name="type"]')!;
  expect([...select.options].map(option=>option.value)).toEqual(['house','condo','plex','land','hotel-motel','daycare','business']);
  const change=async(value:string)=>act(async()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
  await change('daycare');
  const radio=document.querySelector<HTMLInputElement>('input[value="subsidized"]')!;
  expect(radio.validity.valueMissing).toBe(true);await act(async()=>radio.click());
  expect(new FormData(document.querySelector('form')!).get('daycareSubsidy')).toBe('subsidized');
  await change('land');expect(new FormData(document.querySelector('form')!).has('daycareSubsidy')).toBe(false);
  await change('daycare');expect(document.querySelector<HTMLInputElement>('input[value="subsidized"]')!.checked).toBe(false);
});
