// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {HomeSearchHero} from '../src/home-search-hero';
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:false,usePublicListings:()=>({items:[],loading:false,error:false})}));
import {ListingsPage} from '../src/listings';
import {readFilters} from '../src/listings-data';
import {routeHash} from '../src/seo';
import {takeSearchIntent} from '../src/lib/discovery-handoff';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('scrollTo',vi.fn());
 vi.stubGlobal('matchMedia',()=>({matches:false}));sessionStorage.clear();
 history.replaceState(null,'','/fr/');host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function show(lang:'en'|'fr'|'zh'='fr'){await act(async()=>root.render(<HomeSearchHero lang={lang}/>));}
async function set(name:string,value:string){
 const input=host.querySelector<HTMLInputElement|HTMLSelectElement>(`[name=${name}]`)!;
 const prototype=input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
}
async function submit(){await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));}
it.each(['en','fr','zh'] as const)('keeps motel/daycare and existing publish/browse/wanted entry points in %s',async lang=>{
 await show(lang);
 const featured=[...host.querySelectorAll<HTMLAnchorElement>('.home-search-priority a')];
 expect(featured.map(a=>a.getAttribute('href'))).toEqual([`/${lang}/proprietes/hotels-motels/`,`/${lang}/proprietes/garderies/`]);
 expect(host.querySelector('a[href="#publier"]')).not.toBeNull();
 expect(host.querySelector(`a[href="/${lang}/proprietes/"]`)).not.toBeNull();
 expect(host.querySelector(`a[href="/${lang}/#recherches"]`)).not.toBeNull();
 expect(host.querySelector('h1')?.textContent).toBe({fr:'Votre prochain projet commence ici.',en:'Your next project starts here.',zh:'从这里，找到您的下一处物业。'}[lang]);
 expect([...host.querySelectorAll('select option')].map(o=>(o as HTMLOptionElement).value)).toEqual(['','hotel-motel','daycare','land','business','house','condo','plex','commercial']);
});
it.each([['hotel-motel','/fr/proprietes/hotels-motels/'],['daycare','/fr/proprietes/garderies/'],['land','/fr/proprietes/terrains/'],['house','/fr/proprietes/?type=house'],['','/fr/proprietes/']])('searches category %s while keeping the sentence out of the URL',async(type,href)=>{
 await show();await set('query','  Montréal, un motel avec stationnement  ');await set('propertyType',type);await submit();
 expect(location.pathname+location.search).toBe(href);expect(location.href).not.toContain('stationnement');
 expect(takeSearchIntent()).toBe('Montréal, un motel avec stationnement');expect(takeSearchIntent()).toBe('');
});
it('retains the query and selected category if private browser storage is blocked',async()=>{
 await show();await set('query','Montréal 80 places');await set('propertyType','daycare');
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 await submit();expect(location.pathname).toBe('/fr/');
 expect((host.querySelector('[name=query]') as HTMLInputElement).value).toBe('Montréal 80 places');
 expect(host.querySelector('[role=alert]')).not.toBeNull();expect(host.querySelector('[role=alert] a')?.getAttribute('href')).toBe('/fr/proprietes/garderies/');
});
it('can browse a category with an empty query when browser storage is unavailable',async()=>{
 await show();await set('propertyType','hotel-motel');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 await submit();expect(location.pathname).toBe('/fr/proprietes/hotels-motels/');expect(host.querySelector('[role=alert]')).toBeNull();
});
it('clears a previously queued sentence when starting a new blank search',async()=>{
 sessionStorage.setItem('propriete-en-vente:search-intent:v1',JSON.stringify({input:'old request',created:Date.now()}));
 await show();await submit();expect(takeSearchIntent()).toBe('');
});

it.each(['hotel-motel','daycare'] as const)('keeps selected %s through catalogue preview and confirmation of a city-only sentence',async type=>{
 await show();await set('query','Montréal');await set('propertyType',type);await submit();
 await act(async()=>root.render(<ListingsPage lang="fr" hash={routeHash(location.pathname,location.search,location.hash)}/>));
 expect(host.querySelector('.smart-search-preview dl')?.textContent).toContain(type==='daycare'?'Garderie':'Hôtel / motel');
 await act(async()=>host.querySelector<HTMLButtonElement>('.smart-search-confirm')!.click());
 const applied=readFilters(routeHash(location.pathname,location.search,location.hash));
 expect(applied).toMatchObject({q:'Montréal',type});
});
