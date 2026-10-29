// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {listingFallback,type Listing} from '../src/listings-data';
const live=vi.hoisted(()=>({items:[] as Listing[],loading:false}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>({items:live.items,loading:live.loading,error:false})}));
import {HomePhotoMosaic} from '../src/listings';
const listing=(n:number,extra:Partial<Listing>={}):Listing=>({id:`id-${n}`,reference:String(100000+n),type:'condo',district:'',city:'Montréal (Ville-Marie)',postal:'',aliases:'',price:400000+n,beds:2,baths:1,area:800,date:'2026-10-28',mode:'broker',parking:null,outdoor:null,image:`/centris/${n}/001.webp`,real:true,transaction:'sale',...extra});
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('matchMedia',()=>({matches:false}));
 vi.useFakeTimers();
 live.loading=false;host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const show=()=>act(async()=>root.render(<HomePhotoMosaic lang="fr"/>));
const hrefs=()=>[...host.querySelectorAll<HTMLAnchorElement>('.home-mosaic-tile')].map(a=>a.getAttribute('href'));

it('shows three published photos with links and skips fallback or placeholder images',async()=>{
 live.items=[listing(1,{image:listingFallback}),listing(2,{source:{id:'x',url:'',placeholder:true}}),listing(3),listing(4),listing(5)];
 await show();
 expect(hrefs()).toEqual(['/fr/proprietes/100003/','/fr/proprietes/100004/','/fr/proprietes/100005/']);
 expect(host.querySelector('.home-mosaic')?.getAttribute('aria-label')).toBe('Propriétés publiées récemment');
 expect(host.querySelector('.home-mosaic-chip small')?.textContent).toBe('Condo · Montréal');
 expect(host.querySelector('.home-mosaic-tile')?.getAttribute('aria-label')).toContain('400');
});

it('keeps a placeholder while loading and hides the mosaic with fewer than three photos',async()=>{
 live.loading=true;live.items=[];
 await show();
 expect(host.querySelector('.home-mosaic.is-loading')?.getAttribute('aria-hidden')).toBe('true');
 live.loading=false;live.items=[listing(1),listing(2)];
 await show();
 expect(host.querySelector('.home-mosaic')).toBeNull();
});

it('rotates every few seconds, pauses on hover, and stays still for reduced motion',async()=>{
 live.items=[1,2,3,4].map(n=>listing(n));
 await show();
 expect(hrefs()[0]).toBe('/fr/proprietes/100001/');
 await act(async()=>{vi.advanceTimersByTime(6500);});
 expect(hrefs()[0]).toBe('/fr/proprietes/100002/');
 await act(async()=>{host.querySelector('.home-mosaic')!.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));vi.advanceTimersByTime(13000);});
 expect(hrefs()[0]).toBe('/fr/proprietes/100002/');
 await act(async()=>root.unmount());root=createRoot(host);
 vi.stubGlobal('matchMedia',()=>({matches:true}));
 await show();
 await act(async()=>{vi.advanceTimersByTime(20000);});
 expect(hrefs()[0]).toBe('/fr/proprietes/100001/');
});
