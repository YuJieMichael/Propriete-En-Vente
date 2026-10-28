// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PropertyGallery} from '../src/property-gallery';
import {PropertyTour} from '../src/property-tour';
import {Reveal} from '../src/reveal';
import {virtualTour} from '../src/lib/virtual-tour';
import {parseImportedProperty} from '../src/lib/imported-listings';
import importRecords from '../../data/centris-import-20260928.json';
import type {Listing} from '../src/listings-data';
const live=vi.hoisted(()=>({items:[] as Listing[],loading:false,error:false}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>live}));
import {ListingsPage} from '../src/listings';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  localStorage.clear();history.replaceState(null,'','/en/proprietes/');
  vi.stubGlobal('scrollTo',vi.fn());
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  live.loading=false;live.error=false;
  live.items=[1,2].map(n=>({id:`id-${n}`,type:'house',district:`Home ${n}`,city:'Montréal',postal:'',aliases:'',price:n*100000,beds:n,baths:2,area:1500,date:'2026-09-28',mode:'broker',parking:true,outdoor:true,image:`/image-${n}.webp`,real:true}));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('preloads only adjacent photos after opening, handles failed photos and recovers on the next photo',async()=>{
  const requested:string[]=[];
  vi.stubGlobal('Image',class{set src(value:string){requested.push(value);}});
  await act(async()=>root.render(<PropertyGallery photos={['/1.webp','/2.webp','/3.webp','/4.webp']} title="House" lang="en"/>));
  expect(requested).toEqual([]);
  await act(async()=>host.querySelector<HTMLButtonElement>('.gallery-all')!.click());
  expect(requested).toEqual(['/4.webp','/2.webp']);
  const photo=document.querySelector<HTMLImageElement>('.gallery-image img')!;
  expect(document.querySelector('.gallery-image')?.getAttribute('aria-busy')).toBe('true');
  await act(async()=>photo.dispatchEvent(new Event('error')));
  expect(document.querySelector('.gallery-image')?.textContent).toContain('unavailable');
  await act(async()=>document.querySelector<HTMLButtonElement>('.gallery-next')!.click());
  await act(async()=>document.querySelector('.gallery-image img')!.dispatchEvent(new Event('load')));
  expect(document.querySelector('.gallery-image')?.getAttribute('aria-busy')).toBe('false');
  expect(document.querySelector('.gallery-image img')?.getAttribute('class')).toBe('is-ready');
});
it('does not preload gallery photos when the visitor requests data saving',async()=>{
  vi.stubGlobal('navigator',{connection:{saveData:true}});
  const create=vi.fn();vi.stubGlobal('Image',class{constructor(){create();}});
  await act(async()=>root.render(<PropertyGallery photos={['/1.webp','/2.webp']} title="House" lang="en"/>));
  await act(async()=>host.querySelector<HTMLButtonElement>('.gallery-all')!.click());
  expect(create).not.toHaveBeenCalled();
});
it('shows loading placeholders without a false zero-result or empty state',async()=>{
  live.items=[];live.loading=true;
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  expect(host.querySelectorAll('.skeleton-card')).toHaveLength(6);
  expect(host.querySelector('.listing-empty')).toBeNull();
  expect(host.querySelector('.result-count')?.textContent).toContain('Loading properties');
  live.loading=false;live.error=true;
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  expect(host.querySelector('.skeleton-card')).toBeNull();
  expect(host.querySelector('.listing-empty')).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it('keeps previous results, scroll and focus while typing, then announces the new count',async()=>{
  vi.useFakeTimers();
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  const scroll=vi.spyOn(window,'scrollTo').mockClear();
  const intoView=vi.fn();Element.prototype.scrollIntoView=intoView;
  vi.spyOn(Element.prototype,'getBoundingClientRect').mockReturnValue({top:-500} as DOMRect);
  const input=host.querySelector<HTMLInputElement>('.price-range-max')!;input.focus();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'150000');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(host.querySelector('.results-feedback')?.textContent).toBe('Updating results…');
  expect(host.querySelectorAll('.property-card')).toHaveLength(2);
  await act(async()=>vi.advanceTimersByTime(400));
  expect(host.querySelectorAll('.property-card')).toHaveLength(1);
  expect(host.querySelector('.results-feedback')?.textContent).toBe('');
  expect(host.querySelector('.result-count')?.textContent).toContain('1');
  expect(document.activeElement).toBe(input);expect(scroll).not.toHaveBeenCalled();expect(intoView).not.toHaveBeenCalled();
});
it('does not show a tour or request an iframe when the listing has no valid tour',async()=>{
  await act(async()=>root.render(<PropertyTour lang="fr"/>));expect(host.innerHTML).toBe('');
  await act(async()=>root.render(<PropertyTour url="https://www.centris.ca/fr/123" lang="en"/>));expect(host.innerHTML).toBe('');
});
it('loads a normalized tour only after a click and removes the frame on close',async()=>{
  await act(async()=>root.render(<PropertyTour url="https://my.matterport.com/show/?m=aB12cD34eF5&play=1" lang="en"/>));
  expect(host.querySelector('iframe')).toBeNull();
  await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
  expect(host.querySelector('iframe')?.src).toBe('https://my.matterport.com/show/?m=aB12cD34eF5');
  expect(document.activeElement).toBe(host.querySelector('.property-tour-heading button'));
  await act(async()=>host.querySelector<HTMLButtonElement>('.property-tour-heading button')!.click());
  expect(host.querySelector('iframe')).toBeNull();
});
it.each(['javascript:alert(1)','http://my.matterport.com/show/?m=aB12cD34eF5','https://my.matterport.com.evil.test/show/?m=aB12cD34eF5','https://evil.test/?url=https://kuula.co/share/7abcd','https://user:secret@kuula.co/share/7abcd','https://kuula.co:8443/share/7abcd','https://kuula.co/help/anything','https://my.matterport.com/show/?m=short','https://my.matterport.com/show/?m=aB12cD34eF5&m=aB12cD34eF5','<iframe src="https://kuula.co/share/7abcd"></iframe>'])('rejects an unsafe or unsupported tour: %s',url=>{expect(virtualTour(url)).toBeNull();});
it('preserves verified provider links in broker imports and ignores malformed optional media',()=>{
  const property=importRecords[0].property;
  expect(parseImportedProperty({...property,virtualTourUrl:'https://www.kuula.co/share/collection/7abcd?autoplay=1'}).virtualTourUrl).toBe('https://kuula.co/share/collection/7abcd');
  expect(parseImportedProperty({...property,virtualTourUrl:'javascript:alert(1)'}).virtualTourUrl).toBeUndefined();
});
it('keeps content visible with reduced motion and cancels an entrance when the preference changes',async()=>{
  const animate=vi.fn(()=>({cancel:vi.fn()}));
  const original=HTMLElement.prototype.animate;HTMLElement.prototype.animate=animate as any;
  let reduced=true,change=()=>{},intersect:IntersectionObserverCallback=()=>{};
  vi.stubGlobal('matchMedia',()=>({get matches(){return reduced;},addEventListener:(_name:string,callback:()=>void)=>{change=callback;},removeEventListener:vi.fn()}));
  const observe=vi.fn(),disconnect=vi.fn();
  vi.stubGlobal('IntersectionObserver',class{constructor(callback:IntersectionObserverCallback){intersect=callback;}observe=observe;disconnect=disconnect;});
  try{
    await act(async()=>root.render(<Reveal revealKey="motion-disabled">Visible content</Reveal>));
    expect(host.textContent).toBe('Visible content');expect(observe).not.toHaveBeenCalled();
    reduced=false;
    await act(async()=>root.render(<Reveal revealKey="motion-enabled">Visible content</Reveal>));
    await act(async()=>intersect([{isIntersecting:true}] as IntersectionObserverEntry[],{} as IntersectionObserver));
    expect(animate).toHaveBeenCalledTimes(1);
    reduced=true;change();expect(animate.mock.results[0].value.cancel).toHaveBeenCalled();
  }finally{HTMLElement.prototype.animate=original;}
});
