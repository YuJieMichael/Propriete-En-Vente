// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ user: null as { email: string } | null }));
const metrics = vi.hoisted(()=>({source:'facebook'}));
vi.mock('../src/auth', () => ({ useAuth: () => auth }));
vi.mock('../src/lib/traffic-metrics',()=>({enquiryAnalyticsSource:()=>metrics.source}));
import { EnquiryForm, PublicationEntry } from '../src/enquiry';
import { parseEnquiry, enquiriesCsv } from '../../supabase/functions/_shared/enquiry';
import { enquiriesSummaryCsv } from '../../supabase/functions/_shared/enquiry-csv';
vi.mock('../src/lib/supabase',()=>({backendConfigured:true}));
let root: ReturnType<typeof createRoot>;
afterEach(async()=>{if(root)await act(async()=>root.unmount());document.body.innerHTML='';localStorage.clear();auth.user=null;metrics.source='facebook';vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function render(kind:'buyer'|'seller', choose = true, initialAmount='', lang:'en'|'fr'|'zh'='en', listingReference='',initialPropertyType='',confidentialRequest=false){
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(<EnquiryForm kind={kind} lang={lang} initialAmount={initialAmount} listingReference={listingReference} initialPropertyType={initialPropertyType} confidentialRequest={confidentialRequest} />));
  if (kind === 'seller' && choose) await act(async()=>document.querySelector<HTMLButtonElement>('.selling-option')!.click());
  return document.querySelector('form')!;
}
async function fill(form:HTMLFormElement,name:string,value:string){
  const field=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement;
  const prototype=field instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
  await act(async()=>{setter?.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));});
}
it.each(['buyer','seller'] as const)('%s only requires name and email',async kind=>{
  const form=await render(kind);
  expect([...form.querySelectorAll<HTMLInputElement>('[required]')].map(x=>x.name)).toEqual(['name','email']);
  await fill(form,'name','Test Customer');
  await fill(form,'email','test@example.com');
  expect(form.checkValidity()).toBe(true);
});
it.each(['en','fr','zh'] as const)('prefills an editable hotel request in %s without automatic submission',async lang=>{
  const send=vi.fn();vi.stubGlobal('fetch',send);
  const form=await render('buyer',true,'',lang,'','hotel-motel');
  expect((form.elements.namedItem('propertyType') as HTMLSelectElement).value).toBe('hotel-motel');
  expect(document.querySelector('h1')?.textContent).toContain({en:'hotel or motel',fr:'hôtel ou de motel',zh:'酒店或汽车旅馆'}[lang]);
  expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('');
  await fill(form,'propertyType','land');
  expect(document.querySelector('h1')?.textContent).not.toContain({en:'hotel or motel',fr:'hôtel ou de motel',zh:'酒店或汽车旅馆'}[lang]);
  expect(send).not.toHaveBeenCalled();
});
it.each(['buyer','seller'] as const)('prefills the %s calculator amount and allows changes',async kind=>{
 const form=await render(kind,true,'825000');const name=kind==='buyer'?'budgetMax':'expectedPrice';
 expect((form.elements.namedItem(name) as HTMLInputElement).value).toBe('825000');
 await fill(form,name,'875000');expect((form.elements.namedItem(name) as HTMLInputElement).value).toBe('875000');
});
it('prefills account email but saves contact details only after opt-in',async()=>{
  auth.user={email:'account@example.com'};
  let form=await render('buyer');
  expect((form.elements.namedItem('email') as HTMLInputElement).value).toBe('account@example.com');
  const remember=form.elements.namedItem('rememberContact') as HTMLInputElement;
  expect(remember.checked).toBe(false);
  await fill(form,'name','Alex Buyer');
  expect(localStorage.getItem('propriete-en-vente:last-contact:v1')).toBeNull();
  await act(async()=>remember.click());
  expect(JSON.parse(localStorage.getItem('propriete-en-vente:last-contact:v1')||'{}').name).toBe('Alex Buyer');
  await act(async()=>root.unmount());
  auth.user=null;form=await render('seller');
  expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('');
  const sellerRemember=form.elements.namedItem('rememberContact') as HTMLInputElement;
  expect(sellerRemember.checked).toBe(false);
  expect(localStorage.getItem('propriete-en-vente:last-contact:v1')).toBeNull();
});
it('opens the preferred-date calendar from its dedicated button',async()=>{
  const form=await render('buyer');
  const input=form.elements.namedItem('timeline') as HTMLInputElement;
  const showPicker=vi.fn();
  Object.defineProperty(input,'showPicker',{configurable:true,value:showPicker});
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Choose a date"]')!.click());
  expect(showPicker).toHaveBeenCalledOnce();
});
it('retains the selected property-enquiry date when reopening the native picker without submitting',async()=>{
  const send=vi.fn();vi.stubGlobal('fetch',send);
  const form=await render('buyer',true,'','en','100024');
  const input=form.elements.namedItem('timeline') as HTMLInputElement;
  const showPicker=vi.fn();Object.defineProperty(input,'showPicker',{configurable:true,value:showPicker});
  await fill(form,'timeline',input.min);
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Choose a date"]')!.click());
  expect(input.value).toBe(input.min);
  expect(new FormData(form).get('timeline')).toBe(input.min);
  expect(new FormData(form).get('listingReference')).toBe('100024');
  expect(showPicker).toHaveBeenCalledOnce();expect(send).not.toHaveBeenCalled();
});
it('does not pretend to save while setup is pending',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','false');const send=vi.fn();vi.stubGlobal('fetch',send);
  const form=await render('buyer');await fill(form,'name','Test');
  await fill(form,'email','test@example.com');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(send).not.toHaveBeenCalled();expect(document.querySelector('[role=alert]')?.textContent).toContain('not been recorded');
});
it('preserves entries and idempotency on retry, accepts only confirmed save',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'unavailable'})}).mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('seller');await fill(form,'name','Test');await fill(form,'email','test@example.com');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(document.querySelector('[role=alert]')).not.toBeNull();expect((form.elements.namedItem('name') as HTMLInputElement).value).toBe('Test');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);expect(document.querySelector('[role=status]')?.textContent).toContain('recorded');
});
it('keeps the request UUID and source fixed when attribution expires before a retry',async()=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');
  const send=vi.fn().mockRejectedValueOnce(Error('timeout')).mockResolvedValueOnce({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('buyer');await fill(form,'name','Test');await fill(form,'email','test@example.test');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  metrics.source='unknown';
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(send.mock.calls[0][1].body).toBe(send.mock.calls[1][1].body);
  expect(JSON.parse(send.mock.calls[1][1].body).analyticsSource).toBe('facebook');
});
it('validates public payloads, permits blank optional fields, rejects malformed data',()=>{
  const minimal={requestId:crypto.randomUUID(),kind:'buyer',language:'fr',name:' Test ',email:'test@example.com'};
  expect(parseEnquiry(minimal).name).toBe('Test');
  for(const extra of [{name:' '},{email:'bad'},{budgetMin:'300',budgetMax:'200'},{website:'spam'},{kind:'admin'},{requirements:'x'.repeat(3001)},{timeline:'3111-01-01'},{timeline:'2026-02-30'}]) expect(()=>parseEnquiry({...minimal,...extra})).toThrow();
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
  await fill(form,'name','Seller');await fill(form,'email','seller@example.com');
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
  await fill(form,'name','Seller');await fill(form,'email','seller@example.com');
  await fill(form,'contactLanguage','zh');await fill(form,'contactMethod','email');await fill(form,'contactTime','工作日晚上');
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
it('offers additional buyer property types and daycare subsidy buttons in all languages',async()=>{
  for (const [lang, expected] of [['fr',['Terrain','Hôtel / Motel','Garderie','Entreprise','Subventionnée','Non subventionnée']],['en',['Land','Hotel / Motel','Daycare','Business','Subsidized','Non-subsidized']],['zh',['土地','酒店 / 汽车旅馆','托儿机构','企业','有政府补贴','无政府补贴']]] as const) {
    const form=await render('buyer',true,'',lang);
    const select=form.elements.namedItem('propertyType') as HTMLSelectElement;
    expect([...select.options].map(option=>option.textContent)).toEqual(expect.arrayContaining(expected.slice(0,4)));
    expect([...select.options].some(option=>option.value==='commercial')).toBe(false);
    await fill(form,'name','Buyer');await fill(form,'email','buyer@example.com');
    await fill(form,'propertyType','daycare');
    const choices=form.querySelectorAll<HTMLInputElement>('input[name="daycareSubsidy"]');
    expect(choices).toHaveLength(2);
    expect([...form.querySelectorAll('.enquiry-daycare-choices span')].map(x=>x.textContent)).toEqual(expected.slice(4));
    expect(form.checkValidity()).toBe(false);
    await act(async()=>choices[0].click());
    expect(form.checkValidity()).toBe(true);
    await act(async()=>root.unmount());
  }
});
it('validates expanded property types and requires daycare subsidy only for daycare',()=>{
  const p={requestId:crypto.randomUUID(),kind:'buyer',language:'fr',name:'Buyer',email:'buyer@example.com'};
  for (const propertyType of ['land','hotel-motel','daycare','business']) {
    expect(parseEnquiry({...p,propertyType,daycareSubsidy:propertyType==='daycare'?'subsidized':''}).propertyType).toBe(propertyType);
  }
  expect(()=>parseEnquiry({...p,propertyType:'daycare'})).toThrow();
  expect(()=>parseEnquiry({...p,propertyType:'house',daycareSubsidy:'subsidized'})).toThrow();
  expect(()=>parseEnquiry({...p,propertyType:'daycare',daycareSubsidy:'unknown'})).toThrow();
  expect(enquiriesCsv([{propertyType:'daycare',daycareSubsidy:'non-subsidized'}])).toContain('non-subsidized');
});
it('rejects unsupported preference values and clears inapplicable services',()=>{
  const p={requestId:crypto.randomUUID(),kind:'seller',service:'hybrid',language:'en',name:'Test',email:'test@example.com'};
  for(const extra of [{assistance:'unknown'},{assistance:'photos,photos'},{assistance:'unsure,photos'},{contactLanguage:'xx'},{contactMethod:'sms'},{contactTime:'x'.repeat(201)}]) expect(()=>parseEnquiry({...p,...extra})).toThrow();
  expect(parseEnquiry({...p,service:'broker',assistance:'photos'}).assistance).toBe('');
  expect(parseEnquiry({...p,kind:'buyer',assistance:'photos'}).assistance).toBe('');
});

it.each([['fr','Voir les propriétés'],['en','View properties'],['zh','查看房源']] as const)('shows a prominent buyer properties link in %s',async(lang,label)=>{
 const form=await render('buyer',true,'',lang);expect(form).toBeTruthy();const link=document.querySelector<HTMLAnchorElement>('.enquiry-browse');expect(link?.getAttribute('href')).toBe(`/${lang}/proprietes/`);expect(link?.textContent).toBe(label);expect(link?.className).toContain('wide-cta');
});

it.each([['en','Ask about this property'],['fr','Renseignez-vous sur cette propriété'],['zh','咨询这套房源']] as const)('keeps a specific property enquiry attached to its reference in %s',async(lang,title)=>{
  vi.stubEnv('VITE_ENQUIRY_ENABLED','true');
  const send=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
  const form=await render('buyer',true,'',lang,'100005');
  expect(document.querySelector('h1')?.textContent).toBe(title);
  const reference=form.elements.namedItem('listingReference') as HTMLInputElement;
  expect(reference.value).toBe('100005');expect(reference.readOnly).toBe(true);
  await fill(form,'name','Interested Buyer');await fill(form,'email','buyer@example.com');
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(parseEnquiry(JSON.parse(send.mock.calls[0][1].body)).listingReference).toBe('100005');
});

it.each(['fr','en','zh'] as const)('offers owners and brokers the publication route without choosing brokerage services in %s',async lang=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
  await act(async()=>root.render(<PublicationEntry lang={lang}/>));
  expect(document.querySelector('a.wide-cta')?.getAttribute('href')).toBe('#publier');
  expect(document.querySelector('.publication-intro-browse')?.getAttribute('href')).toBe(`/${lang}/proprietes/`);
  expect(document.querySelectorAll('ol li')).toHaveLength(3);
  expect(document.querySelector('form')).toBeNull();expect(document.querySelector('.selling-options')).toBeNull();
});

it.each(['en','fr','zh'] as const)('records an NDA request in %s without claiming a signed NDA or sharing files',async lang=>{
 vi.stubEnv('VITE_ENQUIRY_ENABLED','true');const send=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true})});vi.stubGlobal('fetch',send);
 const form=await render('buyer',true,'',lang,'100024','',true);
 expect(document.querySelector('h1')?.textContent).toContain({en:'confidential',fr:'confidentiels',zh:'保密资料'}[lang]);
 expect(document.body.textContent).toContain({en:'does not sign an NDA',fr:'ne signe aucune entente',zh:'不签署 NDA'}[lang]);
 expect(send).not.toHaveBeenCalled();
 expect(form.querySelector('button[type=submit]')?.textContent).toContain({en:'confidential information request',fr:'documents confidentiels',zh:'保密资料申请'}[lang]);
 await fill(form,'name','Synthetic NDA Buyer');await fill(form,'email','nda@example.test');
 const needs=form.elements.namedItem('requirements') as HTMLTextAreaElement;needs.value='Operating statements and occupancy';
 await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 const payload=JSON.parse(send.mock.calls[0][1].body);
 expect(payload.listingReference).toBe('100024');expect(payload.requirements).toMatch(/^\[NDA\]/);expect(payload.requirements).toContain('Operating statements and occupancy');
 expect(parseEnquiry(payload).requirements).toBe(payload.requirements);
 expect(payload).not.toHaveProperty('ndaSigned');
});
it('exports a compact staff CSV: contact, property of interest and budget',()=>{
 const rows=enquiriesSummaryCsv([
  {created_at:'2026-10-29T14:05:00Z',kind:'buyer',name:'=Lee',phone:'5145550000',email:'lee@example.com',contactMethod:'WeChat',contactTime:'Evenings',contactLanguage:'中文',budgetMin:'400000',budgetMax:'650000',requirements:'Two bedrooms',listingStatus:'linked',listingNumber:'100025',listingAddress:'12 Test Street',listingCity:'Québec',listingPrice:'500000',listingUrl:'https://proprieteenvente.ca/fr/proprietes/100025/',listingSnapshotSource:'internal'},
  {created_at:'2026-10-29T15:00:00Z',kind:'buyer',name:'Ana',email:'ana@example.com',budgetMax:'300000',listingReference:'100099',listingStatus:'unavailable'},
  {created_at:'2026-10-29T16:00:00Z',kind:'seller',name:'Sam',email:'sam@example.com',expectedPrice:'700000'},
 ],'en').replace(/^﻿/,'').trim().split('\r\n');
 expect(rows).toHaveLength(4);
 expect(rows[1]).toBe(`"2026-10-29 14:05","'=Lee","5145550000","lee@example.com","WeChat · Evenings · 中文","100025 · 12 Test Street · Québec","500000","https://proprieteenvente.ca/fr/proprietes/100025/","400000 – 650000","Two bedrooms"`);
 expect(rows[2]).toBe(`"2026-10-29 15:00","Ana","","ana@example.com","","100099","","","300000",""`);
 expect(rows[3]).toContain('"700000"');
 expect(rows.join('\n')).not.toContain('internal');
 expect(enquiriesSummaryCsv([],'zh').split('\r\n')[0]).toBe('﻿"日期","姓名","电话","邮箱","联系偏好","意向房源","挂牌价","房源链接","预算 / 报价","留言"');
});
