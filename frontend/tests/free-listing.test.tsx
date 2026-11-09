// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),limit:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({backendConfigured:true,supabase:{rpc:mock.rpc,from:()=>({select:()=>({neq:()=>({order:()=>({limit:mock.limit})})})})}}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true}));
import {ListingReview} from '../src/listing-review';
import {PublishProperty} from '../src/publish-property';
import {freeListingCopy} from '../src/free-listing-copy';

let root:ReturnType<typeof createRoot>,el:HTMLDivElement,row:any;
const button=(text:string)=>[...el.querySelectorAll('button')].find(b=>b.textContent===text);
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  el=document.createElement('div');document.body.append(el);root=createRoot(el);
  row={id:'free-one',listing_number:100060,property:{title:'Maison Brossard',city:'Brossard',type:'house',price:650000,description:'Desc',mode:'owner'},
    contact:{name:'Owner',email:'owner@example.test',phone:''},photo_paths:[],video_path:null,status:'expired',revision:3,review_note:'',
    free_listing:true,expires_at:'2026-11-01T15:00:00Z'};
  mock.limit.mockReset();mock.limit.mockImplementation(async()=>({data:[{...row}],error:null}));
  mock.rpc.mockReset();mock.rpc.mockImplementation(async(name:string,args:any)=>{
    if(name==='renew_free_listing'){row={...row,status:'published',revision:row.revision+1,expires_at:'2026-12-09T15:00:00Z'};return {data:row.expires_at,error:null};}
    return {data:[],error:null};
  });
});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});

it('submission form announces the free first month and links to its terms',async()=>{
  for(const lang of ['fr','en','zh'] as const){
    await act(async()=>root.render(<PublishProperty lang={lang}/>));
    const banner=el.querySelector('.free-listing-banner')!;
    expect(banner.textContent).toContain(freeListingCopy[lang].bannerTitle);
    expect(banner.textContent).toContain('30');
    expect(banner.querySelector('a')?.getAttribute('href')).toBe('#terms');
  }
});

it('staff see an expired free listing and can extend it by 30 days without republishing through review',async()=>{
  await act(async()=>root.render(<ListingReview lang="zh"/>));
  const summary=el.querySelector<HTMLButtonElement>('.listing-review-summary')!;
  expect(summary.textContent).toContain('已到期');
  await act(async()=>summary.click());
  expect(button('重新上架')).toBeUndefined();
  expect(el.querySelector('.listing-review-expiry')?.textContent).toContain('请先与卖家确认');
  await act(async()=>button('续期 30 天')!.click());
  expect(mock.rpc).toHaveBeenCalledWith('renew_free_listing',{p_id:'free-one',p_revision:3,p_days:30,p_note:''});
  expect(el.textContent).toContain('已续期 30 天。');
  expect(el.querySelector('.listing-review-summary')!.textContent).toContain('免费至');
});

it('listings that are not free never show the renewal control',async()=>{
  row={...row,free_listing:false,expires_at:null,status:'published'};
  await act(async()=>root.render(<ListingReview lang="en"/>));
  await act(async()=>el.querySelector<HTMLButtonElement>('.listing-review-summary')!.click());
  expect(el.querySelector('.listing-review-expiry')).toBeNull();
  expect(button('Extend by 30 days')).toBeUndefined();
});
