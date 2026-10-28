// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {Listing} from '../src/listings-data';
import {hotelGuestRooms, propertySummary} from '../src/seo';
const live = vi.hoisted(() => ({items: [] as Listing[], loading: false, error: false}));
vi.mock('../src/lib/public-listings', () => ({publicListingsEnabled: true, usePublicListings: () => live}));
import {ListingsPage} from '../src/listings';

const base: Listing = {id:'motel',reference:'100021',type:'hotel-motel',title:'104, Rue Olivier',district:'104, Rue Olivier',city:'Laurier-Station',postal:'',aliases:'',price:1180000,beds:null,baths:null,area:null,lotArea:null,date:'2026-10-28',mode:'broker',parking:null,outdoor:null,image:'/sample.png',real:true};
const feature = (key:string,en:string,fr:string,zh:string) => ({key,label:{en:'Guest rooms',fr:'Chambres',zh:'客房'},value:{en,fr,zh}});
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('scrollTo', vi.fn());
  document.body.innerHTML='<div id="test"></div>';
  root=createRoot(document.getElementById('test')!);
  live.items=[];
});
afterEach(async () => {await act(async () => root.unmount()); vi.unstubAllGlobals();});

it.each([
  ['en','Guest rooms: Approximately 17'],
  ['fr','Chambres : Environ 17'],
  ['zh','客房：约17间'],
] as const)('preserves the approximate count on cards, details and static summaries in %s',async (lang,summary) => {
  live.items=[{...base,features:[feature('guestRooms','Approximately 17','Environ 17','约17间')]}];
  await act(async () => root.render(<ListingsPage lang={lang} hash="#proprietes?type=hotel-motel"/>));
  expect(document.querySelector('.property-facts')?.textContent).toContain(summary);
  await act(async () => root.render(<ListingsPage lang={lang} hash="#propriete/100021"/>));
  expect(document.querySelector('.property-summary')?.textContent).toBe(summary);
  expect(document.querySelector('.property-metrics')?.textContent).toContain(hotelGuestRooms(lang,live.items[0])!.value);
  expect(propertySummary(lang,live.items[0])).toBe(summary);
});

it('does not infer guest capacity from commercial units, bedrooms, area or promotional text',async () => {
  const item={...base,beds:1,area:55555,description:'A large hotel with spacious rooms',features:[feature('Nombre d’unités','Commercial (1)','Commercial (1)','商业 (1)')]};
  live.items=[item];
  await act(async () => root.render(<ListingsPage lang="en" hash="#proprietes?type=hotel-motel"/>));
  expect(document.querySelector('.property-facts')?.textContent).toContain('Guest rooms: To confirm');
  expect(hotelGuestRooms('fr',item)?.value).toBe('À confirmer');
  expect(propertySummary('zh',item)).toContain('客房：待确认');
});

it('does not put hotel capacity on residential properties or use another language as a fallback',() => {
  expect(hotelGuestRooms('en',{...base,type:'house'})).toBeNull();
  expect(propertySummary('en',{...base,type:'house',beds:3})).toBe('3 bedrooms');
  expect(hotelGuestRooms('fr',{...base,features:[{key:'guestRooms',value:{en:'18',fr:' '}}]})?.value).toBe('À confirmer');
});
