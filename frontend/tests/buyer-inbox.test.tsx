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
    expect(el.querySelector('.buyer-enquiry-card')).not.toBeNull();
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('.buyer-enquiry-details .buyer-enquiry-fields')).not.toBeNull();
    expect(mock.rpc).toHaveBeenCalledWith('list_buyer_enquiries',{p_offset:0});
    expect([...el.querySelectorAll('button')].some(button=>/refresh|actualiser|刷新/i.test(button.textContent||''))).toBe(false);
    mock.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
    await act(async()=>window.dispatchEvent(new Event('focus')));
    expect(el.textContent).toContain('buyer@example.test');expect(el.querySelector('[role=alert]')).not.toBeNull();
  }finally{await act(async()=>root.unmount());el.remove();}
});
