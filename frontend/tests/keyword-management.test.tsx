// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),invalidate:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
vi.mock('../src/lib/public-listings',()=>({invalidatePublicListings:mock.invalidate}));
import {KeywordManagement} from '../src/keyword-management';
let root:ReturnType<typeof createRoot>,el:HTMLDivElement;
const tag={id:'46000000-0000-4000-8000-000000000001',labels:{en:'Lakefront',fr:'Bord du lac',zh:'湖畔'},synonyms:['waterfront'],revision:1};
const rows=[{id:'26000000-0000-4000-8000-000000000001',reference:'100024',title:'Public hotel',city:'Montréal',type:'hotel-motel',status:'published',revision:3,keyword_ids:[tag.id]},
 {id:'26000000-0000-4000-8000-000000000002',reference:'100020',title:'Public daycare',city:'Brossard',type:'daycare',status:'published',revision:0,keyword_ids:[]}];
const button=(name:string)=>[...el.querySelectorAll('button')].find(b=>b.textContent===name)!;
const click=async(name:string)=>{expect(button(name)).toBeTruthy();await act(async()=>button(name).click());};
const check=async(label:string)=>{const e=el.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;expect(e).toBeTruthy();await act(async()=>e.click());};
async function fill(name:string,value:string){const e=el.querySelector(`[name="${name}"]`) as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});mock.rpc.mockReset();mock.invalidate.mockReset();
 mock.rpc.mockImplementation(async(name,args)=>name==='list_listing_keywords_admin'?{data:{keywords:[tag],listings:rows,has_more:false},error:null}:name==='save_listing_keyword'?{data:{...tag,labels:args.p_labels,synonyms:args.p_synonyms},error:null}:{data:null,error:null});
 el=document.createElement('div');document.body.append(el);root=createRoot(el);await act(async()=>root.render(<KeywordManagement lang="en"/>));
});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
it('creates and edits three-language labels and phrase aliases without touching listing fields',async()=>{
 await fill('keyword-en','Renovated');await fill('keyword-fr','Rénové');await fill('keyword-zh','已翻新');await fill('keyword-synonyms','refurbished\n装修更新');
 await act(async()=>el.querySelector('form.keyword-definition-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mock.rpc).toHaveBeenCalledWith('save_listing_keyword',{p_id:null,p_revision:0,p_labels:{en:'Renovated',fr:'Rénové',zh:'已翻新'},p_synonyms:['refurbished','装修更新']});
 await click('Edit · Lakefront');await fill('keyword-synonyms','by the lake');
 await act(async()=>el.querySelector('form.keyword-definition-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mock.rpc).toHaveBeenCalledWith('save_listing_keyword',{p_id:tag.id,p_revision:1,p_labels:tag.labels,p_synonyms:['by the lake']});
 expect(mock.invalidate).toHaveBeenCalledTimes(2);
});
it('bulk changes only explicitly selected IDs and carries their expected revisions',async()=>{
 await check('Select 100020');await check('Bulk tag: Lakefront');await click('Add to selected');
 expect(mock.rpc).toHaveBeenCalledWith('apply_listing_keywords',{p_listings:[{id:rows[1].id,revision:0}],p_keyword_ids:[tag.id],p_mode:'add'});
 await check('Select 100024');await click('Remove from selected');
 expect(mock.rpc).toHaveBeenLastCalledWith('list_listing_keywords_admin',{p_query:'',p_offset:0});
 expect(mock.rpc).toHaveBeenCalledWith('apply_listing_keywords',{p_listings:[{id:rows[0].id,revision:3}],p_keyword_ids:[tag.id],p_mode:'remove'});
});
it('edits one full tag set independently of bulk selection',async()=>{
 await click('Edit tags · 100024');await check('Listing tag: Lakefront');await click('Save tags');
 expect(mock.rpc).toHaveBeenCalledWith('apply_listing_keywords',{p_listings:[{id:rows[0].id,revision:3}],p_keyword_ids:[],p_mode:'replace'});
});
it('keeps drafts and selection on failure, prevents double submission and never claims success',async()=>{
 await check('Select 100024');await check('Bulk tag: Lakefront');
 let resolve!:(value:any)=>void;mock.rpc.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 await act(async()=>{button('Add to selected').click();button('Add to selected').click();});
 expect(mock.rpc.mock.calls.filter(([name])=>name==='apply_listing_keywords')).toHaveLength(1);
 await act(async()=>resolve({error:{code:'40001'}}));
 expect(el.textContent).toContain('Changes were not saved');expect(el.textContent).not.toContain('Changes saved.');
 expect((el.querySelector('input[aria-label="Select 100024"]') as HTMLInputElement).checked).toBe(true);
 expect(mock.invalidate).not.toHaveBeenCalled();
});
it('searches staff metadata with a bounded query and offers every UI in each language',async()=>{
 await fill('keyword-listing-search','waterfront');await act(async()=>el.querySelector('form.keyword-listing-search')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mock.rpc).toHaveBeenLastCalledWith('list_listing_keywords_admin',{p_query:'waterfront',p_offset:0});
 await act(async()=>root.render(<KeywordManagement lang="fr"/>));expect(el.textContent).toContain('Mots-clés');
 await act(async()=>root.render(<KeywordManagement lang="zh"/>));expect(el.textContent).toContain('关键词');
});
