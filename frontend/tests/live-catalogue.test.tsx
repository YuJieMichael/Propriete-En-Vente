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
 expect(document.querySelector('.property-location .detail-map-links')?.textContent).toContain('Google Maps');
 const hidden=records.find((r:any)=>r.property.source.id==='27396478');
 live.items=[{...parseImportedProperty(hidden.property),id:hidden.id,date:'2026-09-28'}];
 await act(async()=>root.render(<ListingsPage lang="zh" hash={`#propriete/${hidden.id}`}/>));
 expect(document.querySelector('.property-location .property-map')).toBeNull();
 expect(document.body.textContent).toContain('未公开具体地址');
});
