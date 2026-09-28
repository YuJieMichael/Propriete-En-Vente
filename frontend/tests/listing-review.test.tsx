// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),limit:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc,from:()=>({select:()=>({neq:()=>({order:()=>({limit:mock.limit})})})})}}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true}));
import {ListingReview} from '../src/listing-review';
let root:ReturnType<typeof createRoot>,el:HTMLDivElement,row:any;
const button=(text:string)=>[...el.querySelectorAll('button')].find(b=>b.textContent===text)!;
const click=async(text:string)=>{expect(button(text)).toBeTruthy();await act(async()=>button(text).click());};
beforeEach(async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 row={id:'listing-one',listing_number:100031,property:{title:'1892, Route 117',city:'Mont-Tremblant',type:'commercial',price:1999999,description:'Original description',mode:'broker'},contact:{name:'Team'},photo_paths:[],status:'published',revision:4,review_note:''};
 mock.limit.mockImplementation(async()=>({data:[{...row}],error:null}));
 mock.rpc.mockReset();mock.rpc.mockImplementation(async(name,args)=>{
  if(name==='review_listing'){row={...row,status:args.p_decision,revision:row.revision+1};return {error:null};}
  return {data:[{id:'event-one',action:'listing_rejected',created_at:'2026-09-28T15:41:50Z',actor:'reviewer@example.test',metadata:{}}],error:null};
 });
 el=document.createElement('div');document.body.append(el);root=createRoot(el);
 await act(async()=>root.render(<ListingReview lang="en"/>));
});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
async function reason(value:string){await act(async()=>{const textarea=el.querySelector('dialog textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,value);textarea.dispatchEvent(new Event('input',{bubbles:true}));});}
it('requires a second confirmation and a reason; cancelling has no side effect',async()=>{
 await click('Unpublish');expect(mock.rpc).not.toHaveBeenCalled();
 const dialog=el.querySelector('dialog')!;expect(dialog.open).toBe(true);expect(dialog.textContent).toContain('100031');expect(dialog.textContent).toContain('1892, Route 117');
 expect(button('Confirm unpublish').disabled).toBe(true);
 await click('Cancel');expect(el.querySelector('dialog')).toBeNull();expect(mock.rpc).not.toHaveBeenCalled();
 await click('Unpublish');await reason('Sold');await click('Confirm unpublish');
 expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('review_listing',{p_id:'listing-one',p_revision:4,p_decision:'rejected',p_note:'Sold'});
 expect(el.querySelector('dialog')).toBeNull();expect(button('Republish')).toBeTruthy();
 await click('Republish');expect(mock.rpc).toHaveBeenCalledTimes(1);await click('Confirm republish');
 expect(mock.rpc).toHaveBeenLastCalledWith('review_listing',{p_id:'listing-one',p_revision:5,p_decision:'published',p_note:'Sold'});
});
it('shows legacy history with actor, time and an honest missing-reason label',async()=>{
 const details=el.querySelector('details')!;
 await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
 expect(mock.rpc).toHaveBeenCalledWith('list_listing_history',{p_id:'listing-one',p_offset:0});
 expect(details.textContent).toContain('reviewer@example.test');expect(details.textContent).toContain('Not recorded at the time');expect(details.querySelector('time')?.dateTime).toBe('2026-09-28T15:41:50Z');
});
it('rejects stale confirmation after a background status change',async()=>{
 await click('Unpublish');row={...row,revision:5};
 await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(el.querySelector('dialog')).toBeNull();expect(el.textContent).toContain('This listing has changed');expect(mock.rpc).not.toHaveBeenCalled();
});
it('locks repeated submissions and reports failure without claiming success',async()=>{
 let resolve!:(value:any)=>void;mock.rpc.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 await click('Unpublish');await reason('Unavailable');
 const form=el.querySelector('dialog form')!;
 await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 expect(mock.rpc).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({error:{message:'conflict'}}));
 expect(el.textContent).toContain('Action not confirmed');expect(el.textContent).not.toContain('Action saved in the history');expect(button('Unpublish')).toBeTruthy();
});
