// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {BusinessInformation,NdaRequestLink} from '../src/business-information';
import type {Listing} from '../src/listings-data';
const property={id:'00000000-0000-5000-8000-000000000024',reference:'100024',real:true,type:'hotel-motel',beds:200,features:[]} as unknown as Listing;
beforeEach(()=>vi.stubEnv('VITE_NDA_REQUESTS_ENABLED','true'));
afterEach(()=>vi.unstubAllEnvs());
async function display(item:Listing){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div'),root=createRoot(host);
 await act(async()=>root.render(<><NdaRequestLink item={item} lang="en"/><BusinessInformation item={item} lang="en"/></>));
 return {host,close:async()=>{await act(async()=>root.unmount());}};
}
it('uses published guest rooms only, with an NDA request rather than a fake document unlock',async()=>{
 const {host,close}=await display(property);
 try{
  expect(host.textContent).toContain('To confirm');expect(host.textContent).not.toContain('200');
  expect(host.textContent).toContain('depends on owner approval');
  expect(host.querySelector('a')?.getAttribute('href')).toBe('#acheter?listing=100024&intent=nda');
  expect(host.querySelector('.business-information a')).toBeNull();
  expect(host.querySelector('details')?.open).toBe(false);expect(host.textContent).toContain('Revenue');
 }finally{await close();}
});
it('preserves a published approximate room count and daycare capacity without manufacturing financials',async()=>{
 for(const item of [{...property,features:[{key:'guestRooms',label:{en:'Rooms',fr:'Chambres',zh:'客房'},value:{en:'Approximately 32; broker estimate',fr:'Environ 32',zh:'约32间'}}]}, {...property,type:'daycare',daycareSubsidy:'subsidized',features:[{key:'capacity',label:{en:'Capacity',fr:'Places',zh:'名额'},value:{en:'60 places',fr:'60 places',zh:'60个名额'}}]}] as Listing[]){
  const {host,close}=await display(item);
  try{expect(host.textContent).toContain(item.type==='daycare'?'60 places':'Approximately 32; broker estimate');expect(host.textContent).toContain(item.type==='daycare'?'Subsidized':'occupancy');expect(host.querySelectorAll('a')).toHaveLength(1);}finally{await close();}
 }
});
it('does not offer confidential business documents on residential or demo properties',async()=>{
 for(const item of [{...property,type:'house'}, {...property,real:false}] as Listing[]){const {host,close}=await display(item);try{expect(host.textContent).toBe('');}finally{await close();}}
});
it.each(['hotel-motel','daycare'] as const)('hides document requests while showing published %s facts',async type=>{
 vi.stubEnv('VITE_NDA_REQUESTS_ENABLED','false');
 const {host,close}=await display({...property,type});
 try{
  expect(host.querySelector('summary')?.textContent).toBe('Published business facts');
  expect(host.querySelector('dl')?.textContent).toContain(type==='daycare'?'Advertised capacity':'Guest rooms');
  expect(host.querySelector('a')).toBeNull();
  expect(host.textContent).not.toContain('Documents you can request');
 }finally{await close();}
});
