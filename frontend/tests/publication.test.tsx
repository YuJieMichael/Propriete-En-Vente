// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
vi.hoisted(() => { vi.stubEnv('VITE_LISTING_PUBLICATION_ENABLED', 'false'); });
import {parseListingInput,parseProperty} from '../../supabase/functions/_shared/listing-input';
import {PublishProperty} from '../src/publish-property';
import {ListingsPage} from '../src/listings';
vi.mock('../src/lib/supabase',()=>({backendConfigured:true,supabase:null}));
const property={title:'Test property',city:'Québec',district:'Saint-Roch',postal:'G1K 3A1',price:500000,type:'house',beds:3,baths:2,area:1400,description:'Description',mode:'owner',parking:true,outdoor:false};
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+afoQAAAAASUVORK5CYII=';
it('validates public listing data and excludes any contact data injected into it',()=>{
  expect(parseProperty({...property,email:'private@example.com'})).not.toHaveProperty('email');
  expect(parseProperty({...property,parkingSpaces:2,streetParking:true})).toMatchObject({parkingSpaces:2,streetParking:true,parking:true});
  expect(parseProperty({...property,parkingSpaces:0,streetParking:true})).toMatchObject({parkingSpaces:0,streetParking:true,parking:true});
  for(const extra of [{city:''},{price:0},{area:NaN},{type:'invalid'},{postal:'M5V 1A1'},{beds:-1},{parking:'yes'}])expect(()=>parseProperty({...property,...extra})).toThrow();
});
it('requires authority consent, private contact details and actual image signatures',()=>{
  const input={requestId:crypto.randomUUID(),property,contact:{name:'Test',email:'test@example.com',phone:''},consent:true,photos:[photo]};
  expect(parseListingInput(input).photos).toHaveLength(1);
  for(const extra of [{consent:false},{photos:[]},{photos:Array(5).fill(photo)},{photos:['data:image/png;base64,PGh0bWw+YmFkPC9odG1sPg==']},{website:'spam'}])expect(()=>parseListingInput({...input,...extra})).toThrow();
});
let root:ReturnType<typeof createRoot>;
afterEach(async()=>{if(root)await act(async()=>root.unmount());document.body.innerHTML='';vi.unstubAllGlobals();});
it('previews seller photos and details without exposing private contact or claiming publication',async()=>{
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await act(async()=>root.render(<PublishProperty lang="en"/>));
  const form=document.querySelector('form')!;
  for(const[name,value]of Object.entries({...property,name:'Private Seller',email:'private@example.com'})){
    const input=form.elements.namedItem(name) as HTMLInputElement|null;if(input){if(input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value);}
  }
  (form.elements.namedItem('consent') as HTMLInputElement).checked=true;
  const fileInput=document.querySelector<HTMLInputElement>('input[type=file]')!;
  const bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0));
  Object.defineProperty(fileInput,'files',{value:[new File([bytes],'house.png',{type:'image/png'})],configurable:true});
  await act(async()=>{fileInput.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,30));});
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(form.hidden).toBe(true);
  const preview=document.querySelector('.enquiry-card:not(form)')!;
  expect(preview.textContent).toContain('Test property');expect(preview.textContent).not.toContain('private@example.com');
  await act(async()=>preview.querySelectorAll('button')[1].click());expect(fetch).not.toHaveBeenCalled();expect(document.querySelector('[role=alert]')?.textContent).toContain('preview only');
  await act(async()=>preview.querySelector('button')!.click());expect(form.hidden).toBe(false);expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Private Seller');
});
it('opens the independent catalogue and keeps filter URLs on the property route',async()=>{
  window.history.replaceState(null,'','#proprietes');vi.stubGlobal('scrollTo',vi.fn());
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  expect(document.querySelector('a[href="#publier"]')?.textContent).toContain('List my property');
  const condo=[...document.querySelectorAll<HTMLButtonElement>('.property-type-tabs button')].find(b=>b.textContent==='Condo')!;
  await act(async()=>condo.click());expect(window.location.hash).toContain('#proprietes?');
});
