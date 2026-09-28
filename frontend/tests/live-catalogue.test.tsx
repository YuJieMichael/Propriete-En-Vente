// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Listing } from '../src/listings-data';
import importRecords from '../../data/centris-import-20260928.json';
import {parseImportedProperty} from '../src/lib/imported-listings';
const live = vi.hoisted(() => ({ items: [] as Listing[], loading: false, error: false }));
vi.mock('../src/lib/public-listings', () => ({ publicListingsEnabled: true, usePublicListings: () => live }));
import { FeaturedProperties, ListingsPage } from '../src/listings';
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  live.items = []; live.loading = false; live.error = false;
  vi.stubGlobal('scrollTo', vi.fn());
  document.body.innerHTML = '<div id="test"></div>';
  root = createRoot(document.getElementById('test')!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
it('applies exact bedroom counts and the price range only after Search, and omits the area filter',async()=>{
 window.history.replaceState(null,'','#proprietes?area=999999');
 Element.prototype.scrollIntoView=vi.fn();
 live.items=[1,2,3,4,5,6].map(beds=>({id:`beds-${beds}`,type:'house',district:`House ${beds}`,city:'Montréal',postal:'',aliases:'',price:beds*100000,beds,baths:1,area:1000,date:'2026-09-28',mode:'owner',parking:true,outdoor:false,image:'/sample.png',real:true}));
 await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes?area=999999"/>));
 const bedrooms=document.querySelector<HTMLSelectElement>('.filter-main>label select')!;
 const submit=async()=>{await act(async()=>document.querySelector('form.listing-filters')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));};
 await act(async()=>{bedrooms.value='2';bedrooms.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(document.querySelectorAll('.property-card')).toHaveLength(6);
 await submit();expect(document.querySelectorAll('.property-card')).toHaveLength(1);expect(document.querySelector('.property-card')?.textContent).toContain('House 2');expect(location.hash).toContain('beds=2');expect(location.hash).not.toContain('area=');
 await act(async()=>{bedrooms.value='5';bedrooms.dispatchEvent(new Event('change',{bubbles:true}));});
 await submit();expect(document.querySelectorAll('.property-card')).toHaveLength(2);
 await act(async()=>{bedrooms.value='';bedrooms.dispatchEvent(new Event('change',{bubbles:true}));});
 const maximum=document.querySelector<HTMLInputElement>('.price-range-max')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(maximum,'300000');maximum.dispatchEvent(new Event('input',{bubbles:true}));});
 await submit();expect(document.querySelectorAll('.property-card')).toHaveLength(3);expect(location.hash).toContain('max=300000');
 await act(async()=>document.querySelector<HTMLButtonElement>('.more-filters')!.click());
 expect(document.querySelector('#extra-listing-filters')?.textContent).not.toContain('area');
});
it.each([
 [true,undefined,'Oui'],[false,undefined,'Non'],[true,0,'Oui'],[true,1,'1place'],[true,2,'2places'],[null,3,'3places']
])('shows parking availability without a count unit, and pluralises numeric counts (%s, %s)',async(parking,parkingSpaces,expected)=>{
 live.items=[{id:'parking',type:'house',district:'Test',city:'Montréal',postal:'',aliases:'',price:500000,beds:3,baths:2,area:1500,date:'2026-09-28',mode:'owner',parking:parking as boolean|null,parkingSpaces:parkingSpaces as number|undefined,outdoor:false,image:'/sample.png',real:true}];
 await act(async()=>root.render(<ListingsPage lang="fr" hash="#propriete/parking"/>));
 expect(document.querySelector('.property-metrics [title="Stationnement"]')?.textContent).toBe(expected);
});
it('does not turn an empty live database into fictional sale listings on the homepage or catalogue', async () => {
  await act(async () => root.render(<><FeaturedProperties lang="en"/><ListingsPage lang="en" hash="#proprietes"/></>));
  expect(document.querySelectorAll('.property-card')).toHaveLength(0);
  expect(document.body.textContent).toContain('No approved listings');
  expect(document.body.textContent).not.toContain('Examples are shown below');
});
it('shows a database error instead of falling back to fictional listings', async () => {
  live.error = true;
  await act(async () => root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  expect(document.querySelector('[role=alert]')).not.toBeNull();
  expect(document.querySelectorAll('.property-card')).toHaveLength(0);
});
it('opens the publicly shown neighbourhood in Google Maps or Apple Maps', async () => {
  live.items = [{ id:'real-1', type:'house', district:'Plateau', neighbourhood:'Plateau-Mont-Royal', city:'Montréal', postal:'H2J', aliases:'', price:500000, beds:3, baths:2, area:1500, date:'2026-09-27', mode:'owner', parking:false, outdoor:false, image:'/sample.png', real:true }];
  window.history.replaceState(null, '', '#propriete/real-1');
  await act(async () => root.render(<ListingsPage lang="en" hash="#propriete/real-1"/>));
  const google=document.querySelector<HTMLAnchorElement>('.detail-map-links a[href^="https://www.google.com/maps"]')!;
  const apple=document.querySelector<HTMLAnchorElement>('.detail-map-links a[href^="https://maps.apple.com"]')!;
  expect(decodeURIComponent(google.href)).toContain('Plateau-Mont-Royal, Montréal, H2J, Québec');
  expect(decodeURIComponent(apple.href)).toContain('Plateau-Mont-Royal, Montréal, H2J, Québec');
  expect(google.rel).toContain('noopener');expect(apple.target).toBe('_blank');
});
it('shows translated amenities and embeds the exact listing coordinates below the details',async()=>{
 const records=importRecords;
 const record=records.find((r:any)=>r.property.source.id==='23484515');
 live.items=[{...parseImportedProperty(record.property),id:record.id,reference:'100005',date:'2026-09-28'}];
 await act(async()=>root.render(<ListingsPage lang="zh" hash={`#propriete/${record.id}`}/>));
 expect(document.body.textContent).toContain('100005');
 expect(document.body.textContent).not.toMatch(/centris/i);
 expect(document.querySelector('a[href*="centris"]')).toBeNull();
 expect(document.querySelector('.detail-facts')?.textContent).not.toContain(record.id);
 expect(document.body.textContent).toContain('顶层');expect(document.body.textContent).toContain('九英尺');
 expect(document.body.textContent).toContain('接受购买或租赁要约后30天');
 const map=document.querySelector<HTMLElement>('.property-location .property-map')!;
 expect(map).not.toBeNull();expect(map.dataset.latitude).toBe('45.51891143');expect(map.dataset.longitude).toBe('-73.71244573');
 expect(map.getAttribute('aria-label')).toContain('2300, Rue Wilfrid-Reid');
 const embed=map.querySelector('iframe')!;
 expect(embed.src).toContain('https://www.google.com/maps/embed?pb=');
 expect(embed.src).toContain('!2d-73.71244573!3d45.51891143');
 expect(embed.title).toContain('Google Maps');
 expect(embed.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
 expect(document.querySelector('.property-location .detail-map-links')?.textContent).toContain('Google Maps');
 const googleLink=document.querySelector<HTMLAnchorElement>('.property-location .detail-map-links a')!;
 expect(decodeURIComponent(googleLink.href)).toContain('2300, Rue Wilfrid-Reid, app. 404, Montréal (Saint-Laurent)');
 expect(googleLink.href).not.toContain('45.51891143');
 const hidden=records.find((r:any)=>r.property.source.id==='27396478');
 live.items=[{...parseImportedProperty(hidden.property),id:hidden.id,date:'2026-09-28'}];
 await act(async()=>root.render(<ListingsPage lang="zh" hash={`#propriete/${hidden.id}`}/>));
 expect(document.querySelector('.property-location .property-map')).toBeNull();
 expect(document.body.textContent).toContain('未公开具体地址');
});
