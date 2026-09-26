// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
import {BuyerEnquiries} from '../src/buyer-enquiries';
it('persists read/replied status and keeps the list visible during a failed refresh',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
  mock.rpc.mockResolvedValue({data:[{id:'buyer',created_at:'2026-09-23T12:00:00Z',status:'unread',payload:{name:'Test Buyer',email:'buyer@example.test',city:'Québec',requirements:'Three bedrooms'}}],error:null});
  try {
    await act(async()=>root.render(<BuyerEnquiries lang="en"/>));
    expect(el.textContent).toContain('Test Buyer');expect(el.textContent).toContain('Three bedrooms');
    expect(el.querySelector('.buyer-enquiry-card')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.buyer-enquiry-details .buyer-enquiry-fields')).not.toBeNull();
    expect(mock.rpc).toHaveBeenCalledWith('list_buyer_enquiries',{p_offset:0});
    mock.rpc.mockResolvedValue({data:null,error:null});
    const checks=el.querySelectorAll<HTMLInputElement>('.buyer-enquiry-status input');
    await act(async()=>checks[0].click());
    expect(mock.rpc).toHaveBeenLastCalledWith('set_buyer_enquiry_status',{p_id:'buyer',p_status:'read'});
    await act(async()=>checks[1].click());
    expect(mock.rpc).toHaveBeenLastCalledWith('set_buyer_enquiry_status',{p_id:'buyer',p_status:'replied'});
    mock.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
    await act(async()=>root.render(<BuyerEnquiries lang="en" refreshKey={1}/>));
    expect(el.textContent).toContain('buyer@example.test');expect(el.querySelector('[role=alert]')).not.toBeNull();
  }finally{await act(async()=>root.unmount());el.remove();}
});
