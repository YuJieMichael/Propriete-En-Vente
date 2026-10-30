// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({failed:false}));
vi.mock('../src/auth',()=>({useAuth:()=>({user:{id:'reviewer'},staffRole:'owner',adminVerified:true,loading:false,error:null})}));
vi.mock('../src/lib/project-api',()=>({apiUrl:'',apiResult:vi.fn(),projectRequest:vi.fn()}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:async()=>({data:[],error:null}),from:(table:string)=>{
 const filters:Array<(row:Record<string,unknown>)=>boolean>=[];
 const query={select:()=>query,eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return query;},neq:(key:string,value:unknown)=>{filters.push(row=>row[key]!==value);return query;},is:()=>query,order:()=>query,limit:async()=>mock.failed?{data:null,error:{message:'Offline'}}:({data:table==='listing_submissions'?['pending','published','rejected','uploading'].map((status,index)=>({id:status,listing_number:100040+index,property:{title:`Property ${status}`,city:'Québec',price:225000,type:'house',description:'Description',mode:'hybrid'},contact:{name:'Seller'},photo_paths:[],status,revision:1,review_note:''})).filter(row=>filters.every(filter=>filter(row))):[],error:null})};return query;
}}}));
import {AdminPage} from '../src/admin';
let root:ReturnType<typeof createRoot>,el:HTMLDivElement;
beforeEach(async()=>{mock.failed=false;Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});el=document.createElement('div');document.body.append(el);root=createRoot(el);await act(async()=>root.render(<AdminPage lang="en"/>));});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
it('routes pending and returned submissions to seller projects and excludes them from public listings',()=>{
 const seller=el.querySelector<HTMLElement>('#seller-projects-panel')!;
 const published=el.querySelector<HTMLElement>('#published-listings-panel')!;
 expect(seller.hidden).toBe(false);expect(published.hidden).toBe(true);
 expect(seller.textContent).toContain('Property pending');expect(seller.textContent).toContain('Property rejected');expect(seller.textContent).not.toContain('Property published');expect(seller.textContent).not.toContain('Property uploading');
 expect(published.textContent).toContain('Property published');expect(published.textContent).not.toContain('Property pending');expect(published.textContent).not.toContain('Property rejected');
 expect(el.querySelector('#seller-projects-tab')?.textContent).toBe('Seller projects');
});
it('preserves expanded records and draft review notes across tab and background refreshes',async()=>{
 const seller=el.querySelector<HTMLElement>('#seller-projects-panel')!;
 const details=seller.querySelector<HTMLDetailsElement>('.listing-review-item')!;
 const input=seller.querySelector<HTMLTextAreaElement>('textarea')!;
 await act(async()=>{details.open=true;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Check the documents');input.dispatchEvent(new Event('input',{bubbles:true}));});
 const publicTab=el.querySelector<HTMLButtonElement>('#published-listings-tab')!;
 await act(async()=>publicTab.click());expect(seller.hidden).toBe(true);
 await act(async()=>{publicTab.focus();publicTab.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));});
 await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(seller.hidden).toBe(false);expect(details.open).toBe(true);expect(input.value).toBe('Check the documents');
 expect(el.querySelector('#seller-projects-tab')?.getAttribute('aria-selected')).toBe('true');
 expect(seller.querySelector('[role=status]')).toBeNull();
});
it('keeps the last successful records visible after a background network failure',async()=>{
 mock.failed=true;await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(el.querySelector('#seller-projects-panel')?.textContent).toContain('Property pending');
 expect(el.querySelector('#seller-projects-panel [role=alert]')).not.toBeNull();
 expect(el.querySelector('#seller-projects-panel [role=status]')).toBeNull();
});
it('does not describe a failed initial project request as an empty queue',async()=>{
 mock.failed=true;await act(async()=>root.render(<AdminPage key="offline" lang="en"/>));
 expect(el.querySelector('[role=alert]')).not.toBeNull();
 expect(el.querySelector('#seller-projects-panel')?.textContent).not.toContain('No projects are awaiting review');
});
