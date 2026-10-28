// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PropertyGallery} from '../src/property-gallery';
import {SaveProperty,readLibrary,rememberProperty,clearRecent,toggleSaved} from '../src/property-library';
import {PropertyContact} from '../src/property-contact';
import {takePropertyQuestions} from '../src/lib/discovery-handoff';
import type {Listing} from '../src/listings-data';
const live=vi.hoisted(()=>({items:[] as Listing[],loading:false,error:false}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>live}));
import {ListingsPage} from '../src/listings';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  localStorage.clear();sessionStorage.clear();
  vi.stubGlobal('scrollTo',vi.fn());
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  live.items=[1,2].map(n=>({id:`id-${n}`,reference:`10000${n}`,type:'house',district:`Home ${n}`,city:'Montréal',postal:'',aliases:'',price:500000,beds:3,baths:2,area:1500,date:'2026-09-28',mode:'broker',parking:true,outdoor:true,image:`/image-${n}.webp`,real:true}));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('limits the initial gallery and opens every image in a keyboard accessible modal',async()=>{
  await act(async()=>root.render(<PropertyGallery photos={Array.from({length:43},(_,i)=>`/${i}.webp`)} title="LaSalle" lang="en"/>));
  expect(host.querySelectorAll('img')).toHaveLength(5);
  const opener=host.querySelector<HTMLButtonElement>('.gallery-all')!;
  await act(async()=>opener.click());
  const dialog=document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);expect(document.body.style.overflow).toBe('hidden');
  expect(dialog.querySelectorAll('.gallery-thumbnails button')).toHaveLength(43);
  await act(async()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
  expect(dialog.querySelector('header strong')?.textContent).toBe('43 / 43');
  await act(async()=>dialog.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  expect(dialog.querySelector('header strong')?.textContent).toBe('1 / 43');
  await act(async()=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));
  expect(document.querySelector('dialog')).toBeNull();expect(document.activeElement).toBe(opener);expect(document.body.style.overflow).toBe('');
});
it('handles a single illustration without inventing extra images',async()=>{
  await act(async()=>root.render(<PropertyGallery photos={['/one.webp','/one.webp','']} title="Land" lang="fr" illustration/>));
  expect(host.querySelectorAll('img')).toHaveLength(1);expect(host.textContent).toContain('Illustration');
  await act(async()=>host.querySelector<HTMLButtonElement>('.gallery-all')!.click());
  expect(document.querySelector('.gallery-next')).toBeNull();expect(document.querySelector('.gallery-modal-disclosure')).not.toBeNull();
});
it('changes the photo on a horizontal swipe and ignores vertical scrolling',async()=>{
  await act(async()=>root.render(<PropertyGallery photos={['/one.webp','/two.webp']} title="Home" lang="zh"/>));
  await act(async()=>host.querySelector<HTMLButtonElement>('.gallery-all')!.click());
  const stage=document.querySelector('.gallery-stage')!;
  const touch=(type:string,x:number,y:number)=>{const event=new Event(type,{bubbles:true});Object.defineProperty(event,type==='touchstart'?'touches':'changedTouches',{value:[{clientX:x,clientY:y}]});stage.dispatchEvent(event);};
  await act(async()=>{touch('touchstart',200,100);touch('touchend',100,110);});
  expect(document.querySelector('header strong')?.textContent).toBe('2 / 2');
  await act(async()=>{touch('touchstart',200,100);touch('touchend',120,300);});
  expect(document.querySelector('header strong')?.textContent).toBe('2 / 2');
});
it('synchronizes saved buttons and persists only property IDs',async()=>{
  await act(async()=>root.render(<><SaveProperty id="100001" lang="en"/><SaveProperty id="100001" lang="fr" label/></>));
  await act(async()=>host.querySelector('button')!.click());
  expect([...host.querySelectorAll('button')].every(button=>button.getAttribute('aria-pressed')==='true')).toBe(true);
  expect(readLibrary().saved).toEqual(['100001']);
  await act(async()=>host.querySelectorAll('button')[1].click());expect(readLibrary().saved).toEqual([]);
});
it('deduplicates and caps recent history and allows clearing it independently',()=>{
  toggleSaved('100001');
  for(let n=0;n<25;n++)rememberProperty(String(n));
  rememberProperty('20');expect(readLibrary().recent).toHaveLength(20);expect(readLibrary().recent[0]).toBe('20');
  clearRecent();expect(readLibrary()).toEqual({saved:['100001'],recent:[]});
});
it('filters saved listings without resurrecting unavailable properties and keeps the return query',async()=>{
  toggleSaved('100002');toggleSaved('withdrawn');
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes?collection=saved"/>));
  expect(host.querySelectorAll('.property-card')).toHaveLength(1);
  expect(host.querySelector('.property-card-link')?.getAttribute('href')).toContain('100002/?collection=saved');
  await act(async()=>root.render(<ListingsPage lang="en" hash="#propriete/100002?collection=saved"/>));
  expect(host.querySelector('.listing-back')?.getAttribute('href')).toContain('collection=saved');
  expect(readLibrary().recent[0]).toBe('100002');
});
it('passes the listing and viewing request to the enquiry without confirming a booking',async()=>{
  await act(async()=>root.render(<PropertyContact lang="en" reference="100002" price="$500,000"/>));
  const link=host.querySelector<HTMLAnchorElement>('.contact-viewing')!;
  expect(link.getAttribute('href')).toBe('#acheter?listing=100002');
  await act(async()=>link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  expect(takePropertyQuestions('100002','en')).toContain('arrange a time');
  expect(host.textContent).toContain('will be confirmed with you');
});
it('keeps saved actions usable in this tab when storage cannot be written',()=>{
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota');});
  toggleSaved('100001');expect(readLibrary().saved).toEqual(['100001']);
  rememberProperty('100002');expect(readLibrary().recent).toEqual(['100002']);
  write.mockRestore();clearRecent();
});
