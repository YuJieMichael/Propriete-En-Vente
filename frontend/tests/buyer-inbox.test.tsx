// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
import {BuyerEnquiries} from '../src/buyer-enquiries';
it('keeps the latest buyer visible and syncs again when the page regains focus',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
  mock.rpc.mockResolvedValue({data:[{id:'buyer',created_at:'2026-09-23T12:00:00Z',payload:{name:'Test Buyer',email:'buyer@example.test',city:'Québec',requirements:'Three bedrooms'}}],error:null});
  try {
    await act(async()=>root.render(<BuyerEnquiries lang="en"/>));
    expect(el.textContent).toContain('Test Buyer');expect(el.textContent).toContain('Three bedrooms');
    expect(el.textContent).toContain('Updates automatically every 15 seconds');
    expect(el.querySelector('.buyer-enquiry-card')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.buyer-enquiry-details .buyer-enquiry-fields')).not.toBeNull();
    expect(mock.rpc).toHaveBeenCalledWith('list_buyer_enquiries_managed',{p_filter:'active',p_offset:0});
    expect([...el.querySelectorAll('button')].some(button=>/refresh|actualiser|刷新/i.test(button.textContent||''))).toBe(false);
    mock.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
    await act(async()=>window.dispatchEvent(new Event('focus')));
    expect(el.textContent).toContain('buyer@example.test');expect(el.querySelector('[role=alert]')).not.toBeNull();
  }finally{await act(async()=>root.unmount());el.remove();}
});
it('accepts, confirms deletion, and restores the same enquiry with revision checks',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 let row={id:'buyer-action',created_at:'2026-09-28T12:00:00Z',payload:{name:'Action Buyer',email:'action@example.test'},review_status:'pending',deleted_at:null as string|null,revision:0};
 mock.rpc.mockReset();
 mock.rpc.mockImplementation(async(name:string,args:any)=>{
  if(name==='review_buyer_enquiry'){
   expect(args.p_revision).toBe(row.revision);
   row={...row,review_status:args.p_action==='accept'?'accepted':row.review_status,deleted_at:args.p_action==='delete'?'2026-09-28T13:00:00Z':args.p_action==='restore'?null:row.deleted_at,revision:row.revision+1};
   return {data:[row],error:null};
  }
  return {data:args.p_filter==='deleted'?(row.deleted_at?[row]:[]):row.deleted_at?[]:[row],error:null};
 });
 const click=async(text:string)=>{const button=[...el.querySelectorAll('button')].find(b=>b.textContent===text);expect(button).toBeTruthy();await act(async()=>button!.click());};
 try{
  await act(async()=>root.render(<BuyerEnquiries lang="en"/>));
  await click('Accept');expect(el.querySelector('.buyer-enquiry-status')?.textContent).toBe('Accepted');
  await click('Delete');expect(mock.rpc.mock.calls.filter(([name])=>name==='review_buyer_enquiry')).toHaveLength(1);
  expect(el.textContent).toContain('You can restore it later');
  await click('Keep enquiry');expect(el.textContent).not.toContain('Confirm delete');
  await click('Delete');await click('Confirm delete');expect(el.textContent).not.toContain('Action Buyer');
  await click('Deleted');expect(el.textContent).toContain('Action Buyer');
  await click('Restore');expect(el.textContent).not.toContain('Action Buyer');
  await click('All active');expect(el.textContent).toContain('Action Buyer');expect(el.querySelector('.buyer-enquiry-status')?.textContent).toBe('Accepted');
 }finally{await act(async()=>root.unmount());el.remove();}
});
it('shows the resolved property before expanding request details, while preserving buyer preferences',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 mock.rpc.mockReset();mock.rpc.mockResolvedValue({data:[{id:'linked',created_at:'2026-10-28T12:00:00Z',payload:{name:'Synthetic buyer',city:'Montréal',listingReference:'100024',listingStatus:'linked',listingNumber:'100024',listingCity:'Saint-Sauveur',listingPrice:'4890000',listingAddress:'',listingAddressStatus:'unpublished',listingSnapshotSource:'backfill',listingUrl:'https://proprieteenvente.ca/fr/proprietes/100024/'}}],error:null});
 try{
  await act(async()=>root.render(<BuyerEnquiries lang="en"/>));
  const property=el.querySelector('.buyer-enquiry-property');
  expect(property?.textContent).toContain('100024');expect(property?.textContent).toContain('Saint-Sauveur');expect(property?.textContent).toContain('4,890,000');
  expect(property?.textContent).toContain('Address not published');expect(property?.textContent).toContain('current listing');
  expect(property?.closest('details')).toBeNull();expect(property?.querySelector('a')?.getAttribute('href')).toBe('/en/proprietes/100024/');
  expect(el.textContent).toContain('Montréal');
  expect([...el.querySelectorAll('button')].some(b=>b.textContent==='Export this page (CSV)')).toBe(true);
 }finally{await act(async()=>root.unmount());el.remove();}
});
it('labels missing properties without inventing a link',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const el=document.createElement('div'),root=createRoot(el);
 mock.rpc.mockReset();mock.rpc.mockResolvedValue({data:[{id:'missing',created_at:'2026-10-28T12:00:00Z',payload:{listingReference:'999999',listingStatus:'unresolved'}}],error:null});
 try{await act(async()=>root.render(<BuyerEnquiries lang="en"/>));expect(el.querySelector('.buyer-enquiry-property')?.textContent).toContain('Property unavailable');expect(el.querySelector('.buyer-enquiry-property a')).toBeNull();}
 finally{await act(async()=>root.unmount());}
});
it('downloads the displayed enquiry with its property facts in a safe CSV',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval']});
 const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 let attachment:Blob|undefined,filename='';
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
 URL.createObjectURL=vi.fn((blob:Blob)=>{attachment=blob;return 'blob:enquiry-export';});URL.revokeObjectURL=vi.fn();
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download;});
 mock.rpc.mockReset();mock.rpc.mockResolvedValue({data:[{id:'csv',created_at:'2026-10-28T12:00:00Z',payload:{name:'=FORMULA()',city:'Montréal',listingReference:'100025',listingStatus:'linked',listingNumber:'100025',listingCity:'Québec',listingAddress:'12 Test Street',listingPrice:'500000',listingUrl:'https://proprieteenvente.ca/fr/proprietes/100025/'}}],error:null});
 try{
  await act(async()=>root.render(<BuyerEnquiries lang="en"/>));
  await act(async()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Export this page (CSV)')!.click());
  expect(filename).toBe('buyer-enquiries.csv');expect(attachment).toBeInstanceOf(Blob);
  const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(attachment!);});
  expect(text).toContain('12 Test Street');expect(text).toContain('Québec');expect(text).toContain('500000');expect(text).toContain('/proprietes/100025/');expect(text).toContain("'=FORMULA()");expect(text.trim().split('\r\n')).toHaveLength(2);
  await act(async()=>vi.advanceTimersByTime(1000));expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:enquiry-export');
 }finally{await act(async()=>root.unmount());click.mockRestore();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;vi.useRealTimers();el.remove();}
});
