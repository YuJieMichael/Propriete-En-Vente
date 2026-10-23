// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),auth:{user:null as null|{id:string;email_confirmed_at:string|null},loading:false,adminVerified:false}}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
vi.mock('../src/auth',()=>({useAuth:()=>mock.auth}));
import {WantedBoard,WantedReview} from '../src/wanted-board';
import {validWantedCriteria} from '../src/lib/wanted-board';

const card={id:'request-1',propertyType:'condo',city:'Montréal',budgetMin:300000,budgetMax:600000,beds:2,parking:true,transaction:'sale',timeline:'3-months',createdAt:'2026-10-23T12:00:00Z',expiresAt:'2027-01-21T12:00:00Z'};
let root:Root,el:HTMLDivElement;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});el=document.createElement('div');document.body.append(el);root=createRoot(el);
  mock.auth={user:null,loading:false,adminVerified:false};mock.rpc.mockReset();mock.rpc.mockImplementation(async(name:string)=>({data:name==='list_wanted_requests'?[{...card,owner_id:'hidden-account',email:'hidden@example.test',privateNote:'not public'}]:[],error:null}));
});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();});
const click=async(text:string)=>{const button=[...el.querySelectorAll('button')].find(node=>node.textContent===text);expect(button,`button ${text}`).toBeTruthy();await act(async()=>button!.click());};
const render=async()=>{await act(async()=>root.render(<WantedBoard lang="en"/>));};
function signIn(id='buyer'){mock.auth.user={id,email_confirmed_at:'2026-10-23T12:00:00Z'};}

it('shows an anonymous board with only the public criteria and requires sign-in for a response',async()=>{
  await render();expect(el.textContent).toContain('Condo · Montréal');expect(el.textContent).not.toContain('hidden@example.test');expect(el.textContent).not.toContain('hidden-account');expect(el.textContent).not.toContain('not public');
  expect(el.textContent).toContain('Sign in with a verified email');expect(el.textContent).not.toContain('Respond privately');
  expect(el.querySelector('main')).toBeNull();expect(mock.rpc).toHaveBeenCalledWith('list_wanted_requests',{p_offset:0,p_city:null,p_type:null});
  expect(mock.rpc.mock.calls.some(([name])=>name==='get_my_wanted_requests')).toBe(false);
});
it('keeps consent unchecked, previews only structured criteria and submits for moderation with an idempotency key',async()=>{
  signIn();let own:any[]=[];mock.rpc.mockImplementation(async(name:string,args:any)=>{
    if(name==='create_wanted_request'){own=[{...card,...args.p_card,id:args.p_id,status:'pending',revision:0,reviewNote:'',replyCount:0}];return {data:args.p_id,error:null};}
    return {data:name==='list_wanted_requests'?[card]:name==='get_my_wanted_requests'?own:[],error:null};
  });
  await render();await click('Create my request');
  const consent=el.querySelector<HTMLInputElement>('.wanted-consent input')!;expect(consent.checked).toBe(false);
  expect(el.querySelector<HTMLButtonElement>('.wanted-create button[type=submit]')!.disabled).toBe(true);
  expect(el.querySelector('.wanted-create')?.textContent).toContain('Public card preview');
  expect(el.querySelectorAll('.wanted-create textarea')).toHaveLength(0);
  await act(async()=>consent.click());
  await act(async()=>el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  const call=mock.rpc.mock.calls.find(([name])=>name==='create_wanted_request')!;
  expect(call[1].p_consent).toBe(true);expect(call[1].p_id).toMatch(/^[0-9a-f-]{36}$/);expect(Object.keys(call[1].p_card)).toHaveLength(8);
  expect(el.textContent).toContain('It is not public yet');expect(el.textContent).toContain('Awaiting review');expect(el.textContent).toContain('Responses are not emailed');
});
it('blocks unverified users and validates strict criteria',async()=>{
  mock.auth.user={id:'unverified',email_confirmed_at:null};await render();expect(el.textContent).toContain('Please verify your email');expect(el.textContent).not.toContain('Create my request');
  expect(validWantedCriteria(card as any)).toBe(true);
  for(const patch of [{city:'Personal phone 555'},{budgetMin:900000},{budgetMax:1e12},{beds:-1},{parking:'sometimes'},{timeline:'some day'}])expect(validWantedCriteria({...card,...patch} as any)).toBe(false);
});
it('requires confirmation to withdraw and keeps private responses behind the buyer view',async()=>{
  signIn();let status='published';mock.rpc.mockImplementation(async(name:string)=>{
    if(name==='withdraw_wanted_request'){status='withdrawn';return {data:null,error:null};}
    if(name==='get_my_wanted_requests')return {data:[{...card,status,revision:1,reviewNote:'',replyCount:1}],error:null};
    if(name==='list_wanted_replies')return {data:[{id:'response',requestId:card.id,message:'Private seller message',listingNumber:'100001',createdAt:card.createdAt,card}],error:null};
    return {data:[card],error:null};
  });
  await render();await click('My requests');expect(el.textContent).not.toContain('Private seller message');
  await click('View private responses (1)');expect(el.textContent).toContain('Private seller message');expect(el.querySelector('a[href="/en/proprietes/100001/"]')).not.toBeNull();
  await click('Withdraw request');expect(mock.rpc.mock.calls.some(([name])=>name==='withdraw_wanted_request')).toBe(false);await click('Confirm withdrawal');expect(el.textContent).toContain('Withdrawn');
  expect(mock.rpc).toHaveBeenCalledWith('withdraw_wanted_request',{p_id:card.id});
});
it('clears an old account form and ignores its late submission result after an account switch',async()=>{
  signIn('old-buyer');let resolveCreate!:(value:any)=>void;
  mock.rpc.mockImplementation((name:string)=>name==='create_wanted_request'?new Promise(resolve=>{resolveCreate=resolve;}):Promise.resolve({data:[],error:null}));
  await render();await click('Create my request');await act(async()=>el.querySelector<HTMLInputElement>('.wanted-consent input')!.click());
  await act(async()=>el.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  signIn('new-buyer');await render();expect(el.querySelector('.wanted-create')).toBeNull();
  await act(async()=>resolveCreate({data:'old-request',error:null}));expect(el.textContent).not.toContain('Your request is saved');expect(el.querySelector('.wanted-create')).toBeNull();
});
it('does not call staff RPCs until verified staff access exists',async()=>{
  signIn();await act(async()=>root.render(<WantedReview lang="en"/>));expect(el.textContent).toContain('Staff verification is required');expect(mock.rpc).not.toHaveBeenCalled();
  mock.auth.adminVerified=true;mock.rpc.mockImplementation(async(name:string)=>({data:name==='list_wanted_review'?[{...card,status:'pending',revision:3,replyCount:0,reviewNote:''}]:null,error:null}));
  await act(async()=>root.render(<WantedReview lang="en"/>));await click('Publish');expect(mock.rpc).toHaveBeenCalledWith('review_wanted_request',{p_id:card.id,p_revision:3,p_decision:'published',p_note:''});
});
