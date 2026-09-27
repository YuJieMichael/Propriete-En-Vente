// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { EnquiryForm } from '../src/enquiry';
import { parseEnquiry, enquiriesCsv } from '../../supabase/functions/_shared/enquiry';
vi.mock('../src/lib/supabase',()=>({backendConfigured:true}));
let root: ReturnType<typeof createRoot>;
afterEach(async()=>{if(root)await act(async()=>root.unmount());document.body.innerHTML='';vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function render(kind:'buyer'|'seller', choose = true){
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(<EnquiryForm kind={kind} lang="en" />));
  if (kind === 'seller' && choose) await act(async()=>document.querySelector<HTMLButtonElement>('.selling-option')!.click());
  return document.querySelector('form')!;
}
it.each(['buyer','seller'] as const)('%s only requires name and email',async kind=>{
  const form=await render(kind);
  expect([...form.querySelectorAll<HTMLInputElement>('[required]')].map(x=>x.name)).toEqual(['name','email']);
  (form.elements.namedItem('name') as HTMLInputElement).value='Test Customer';
  (form.elements.namedItem('email') as HTMLInputElement).value='test@example.com';
  expect(form.checkValidity()).toBe(true);
});
it('does not pretend to save while setup is pending',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','false');const send=vi.fn();vi.stubGlobal('fetch',send);
  const form=await render('buyer');(form.elements.namedItem('name') as HTMLInputElement).value='Test';
  (form.elements.namedItem('email') as HTMLInputElement).value='test@example.com';
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(send).not.toHaveBeenCalled();expect(document.querySelector('[role=alert]')?.textContent).toContain('not been recorded');
});
it('shows and submits the listing reference when opened from a property detail',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(<EnquiryForm kind="buyer" lang="zh" listingReference="18054a31-a700-40ef-8d59-b926e6c23ef9"/>));
  const form=document.querySelector('form')!;(form.elements.namedItem('name') as HTMLInputElement).value='买家';(form.elements.namedItem('email') as HTMLInputElement).value='buyer@example.com';
  expect((form.elements.namedItem('listingReference') as HTMLInputElement).value).toBe('18054a31-a700-40ef-8d59-b926e6c23ef9');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(send.mock.calls[0][1].body).listingReference).toBe('18054a31-a700-40ef-8d59-b926e6c23ef9');
});
it('preserves entries and idempotency on retry, accepts only confirmed save',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'unavailable'})}).mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('seller');(form.elements.namedItem('name') as HTMLInputElement).value='Test';(form.elements.namedItem('email') as HTMLInputElement).value='test@example.com';
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(document.querySelector('[role=alert]')).not.toBeNull();expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Test');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);expect(document.querySelector('[role=status]')?.textContent).toContain('recorded');
});
it('validates public payloads, permits blank optional fields, rejects malformed data',()=>{
  const minimal={requestId:crypto.randomUUID(),kind:'buyer',language:'fr',name:' Test ',email:'test@example.com'};
  expect(parseEnquiry(minimal).name).toBe('Test');
  for(const extra of [{name:' '},{email:'bad'},{budgetMin:'300',budgetMax:'200'},{website:'spam'},{kind:'admin'},{requirements:'x'.repeat(3001)}]) expect(()=>parseEnquiry({...minimal,...extra})).toThrow();
});
it('exports Unicode CSV without executable spreadsheet formulas',()=>{
  const csv=enquiriesCsv([{name:'李, "Test"',requirements:'=HYPERLINK("bad")',phone:'+15145550000'}]);
  expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain('李, ""Test""');expect(csv).toContain("'=HYPERLINK");expect(csv).toContain("'+15145550000");
});

it('offers exactly two selling paths, preserves contact entries when changing and submits the selected mode',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('seller',false);
  expect(form.hidden).toBe(true);expect(document.querySelectorAll('.selling-option')).toHaveLength(2);
  await act(async()=>document.querySelector<HTMLButtonElement>('.selling-option')!.click());
  expect(form.hidden).toBe(false);
  (form.elements.namedItem('name') as HTMLInputElement).value='Seller';(form.elements.namedItem('email') as HTMLInputElement).value='seller@example.com';
  await act(async()=>document.querySelector<HTMLButtonElement>('.selling-selection button')!.click());
  await act(async()=>document.querySelectorAll<HTMLButtonElement>('.selling-option')[1].click());
  expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Seller');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(JSON.parse(send.mock.calls[0][1].body).service).toBe('hybrid');
});
it('requires a supported selling mode in server validation',()=>{
  const payload={requestId:crypto.randomUUID(),kind:'seller',language:'fr',name:'Seller',email:'seller@example.com'};
  for (const service of ['broker','hybrid']) expect(parseEnquiry({...payload,service}).service).toBe(service);
  for (const service of ['','self','staff']) expect(()=>parseEnquiry({...payload,service})).toThrow();
});
it('collects multiple services and contact preferences through validation and CSV export',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('seller',false);
  await act(async()=>document.querySelectorAll<HTMLButtonElement>('.selling-option')[1].click());
  for (const id of ['photos','video']) await act(async()=>document.querySelector<HTMLInputElement>(`input[value="${id}"]`)!.click());
  (form.elements.namedItem('name') as HTMLInputElement).value='Seller';(form.elements.namedItem('email') as HTMLInputElement).value='seller@example.com';
  (form.elements.namedItem('contactLanguage') as HTMLSelectElement).value='zh';
  (form.elements.namedItem('contactMethod') as HTMLSelectElement).value='email';
  (form.elements.namedItem('contactTime') as HTMLInputElement).value='工作日晚上';
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const parsed=parseEnquiry(JSON.parse(send.mock.calls[0][1].body));
  expect(parsed.assistance).toBe('photos,video');expect(parsed.contactLanguage).toBe('zh');expect(parsed.contactMethod).toBe('email');
  const csv=enquiriesCsv([parsed]);expect(csv).toContain('photos,video');expect(csv).toContain('工作日晚上');expect(csv).toContain('contactLanguage');
});
it('makes unsure exclusive and preserves service choices across a mode change',async()=>{
  await render('seller',false);
  await act(async()=>document.querySelectorAll<HTMLButtonElement>('.selling-option')[1].click());
  const click=async(id:string)=>act(async()=>document.querySelector<HTMLInputElement>(`input[value="${id}"]`)!.click());
  await click('photos');await click('unsure');
  expect(document.querySelector<HTMLInputElement>('input[value="photos"]')!.checked).toBe(false);
  await click('video');expect(document.querySelector<HTMLInputElement>('input[value="unsure"]')!.checked).toBe(false);
  await act(async()=>document.querySelector<HTMLButtonElement>('.selling-selection button')!.click());
  await act(async()=>document.querySelectorAll<HTMLButtonElement>('.selling-option')[0].click());
  expect(document.querySelector('.enquiry-services')).toBeNull();
  await act(async()=>document.querySelector<HTMLButtonElement>('.selling-selection button')!.click());
  await act(async()=>document.querySelectorAll<HTMLButtonElement>('.selling-option')[1].click());
  expect(document.querySelector<HTMLInputElement>('input[value="video"]')!.checked).toBe(true);
});
it('rejects unsupported preference values and clears inapplicable services',()=>{
  const p={requestId:crypto.randomUUID(),kind:'seller',service:'hybrid',language:'en',name:'Test',email:'test@example.com'};
  for(const extra of [{assistance:'unknown'},{assistance:'photos,photos'},{assistance:'unsure,photos'},{contactLanguage:'xx'},{contactMethod:'sms'},{contactTime:'x'.repeat(201)}]) expect(()=>parseEnquiry({...p,...extra})).toThrow();
  expect(parseEnquiry({...p,service:'broker',assistance:'photos'}).assistance).toBe('');
  expect(parseEnquiry({...p,kind:'buyer',assistance:'photos'}).assistance).toBe('');
});
