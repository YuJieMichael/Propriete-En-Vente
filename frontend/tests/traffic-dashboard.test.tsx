// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),auth:{user:{id:'staff-a'},staffRole:'owner' as string|null,adminVerified:true,loading:false}}));
vi.mock('../src/auth',()=>({useAuth:()=>mock.auth}));
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
import {TrafficDashboard,HotelCampaignLinks} from '../src/traffic-dashboard';
import {hotelCampaignChannels,hotelCampaignLink,parseTrafficSummary,trafficCoverage} from '../src/traffic-dashboard-data';

const summary=(days=28)=>({started_at:'2026-10-16T14:00:00Z',days,totals:{site_visit:31,property_view:12,enquiry_success:2},sources:[{source:'facebook',site_visit:20,property_view:8,enquiry_success:1},{source:'direct',site_visit:11,property_view:4,enquiry_success:1}],daily:[{day:'2026-10-18',site_visit:11,property_view:4,enquiry_success:1},{day:'2026-10-19',site_visit:20,property_view:8,enquiry_success:1},{day:'2026-10-28',site_visit:0,property_view:0,enquiry_success:0}],properties:[{reference:'100001',property_view:12,enquiry_success:2}]});
let root:ReturnType<typeof createRoot>|undefined;
let host:HTMLDivElement;
const clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  mock.auth={user:{id:'staff-a'},staffRole:'owner',adminVerified:true,loading:false};mock.rpc.mockReset();
  mock.rpc.mockImplementation(async(_name:string,args:{p_days:number})=>({data:summary(args.p_days),error:null}));
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;host.remove();if(clipboardDescriptor)Object.defineProperty(navigator,'clipboard',clipboardDescriptor);else Reflect.deleteProperty(navigator,'clipboard');vi.restoreAllMocks();});

describe('traffic reporting read contract',()=>{
  it('keeps padded zero days separate from the latest actual event date',()=>{
    const parsed=parseTrafficSummary(summary());
    expect(trafficCoverage(parsed)).toMatchObject({lastDay:'2026-10-28',lastRecordedDay:'2026-10-19',daysWithEvents:2,daysWithoutRecords:1,hasEvents:true});
    expect(parsed.daily.at(-1)?.site_visit).toBe(0);
    const empty={...summary(),totals:{site_visit:0,property_view:0,enquiry_success:0},daily:[{day:'2026-10-28',site_visit:0,property_view:0,enquiry_success:0}],sources:[],properties:[]};
    expect(trafficCoverage(parseTrafficSummary(empty))).toMatchObject({lastRecordedDay:null,hasEvents:false});
  });
  it('rejects missing, negative, invalid dates and malformed counts instead of inventing zeroes',()=>{
    const value=summary();
    for(const changed of [{...value,totals:{}},{...value,totals:{...value.totals,site_visit:-1}},{...value,totals:{...value.totals,site_visit:'31'}},{...value,daily:[{...value.daily[0],day:'2026-02-31'}]},{...value,daily:[value.daily[0],value.daily[0]]}])expect(()=>parseTrafficSummary(changed)).toThrow('invalid_traffic_summary');
  });
  it('uses the shared fixed link builder and the collector platform allowlist',()=>{
    for(const lang of ['en','fr','zh'] as const)for(const channel of hotelCampaignChannels){
      const url=new URL(hotelCampaignLink(lang,channel));
      expect(url.origin).toBe('https://proprieteenvente.ca');expect(url.pathname).toBe(`/${lang}/proprietes/hotels-motels/`);
      expect(url.searchParams.get('utm_source')).toBe(channel==='partner'?'other':channel);
      expect(url.searchParams.get('utm_medium')).toBe(channel==='partner'?'referral':'social');expect(url.searchParams.get('utm_campaign')).toBe('hotel-20261028');
      expect([...url.searchParams.keys()]).toEqual(['utm_source','utm_medium','utm_campaign']);
    }
  });
});

describe('private traffic dashboard',()=>{
  it('does not query or expose statistics without verified staff access',async()=>{
    mock.auth.adminVerified=false;
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));
    expect(mock.rpc).not.toHaveBeenCalled();expect(host.textContent).toContain('Verified staff access');expect(host.querySelector('.traffic-metrics')).toBeNull();
    mock.auth.adminVerified=true;mock.auth.staffRole=null;
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('shows recorded-event counts, coverage gaps and latest positive date without claiming unique visitors',async()=>{
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));
    expect(mock.rpc).toHaveBeenCalledWith('get_traffic_summary',{p_days:28});
    expect(host.querySelector('.traffic-metrics')?.textContent).toContain('31');
    expect(host.textContent).toContain('not unique visitors');expect(host.textContent).toContain('Missing records');expect(host.textContent).toContain('not a collection-health heartbeat');
    expect(host.querySelector('.traffic-coverage')?.textContent).toContain('Oct 19, 2026');
    expect(host.querySelector('.traffic-unrecorded')?.textContent).toContain('traffic unknown');
    expect(host.querySelector('a[href="/en/proprietes/100001/"]')).not.toBeNull();
    const select=host.querySelector<HTMLSelectElement>('.traffic-controls select')!;
    await act(async()=>{select.value='7';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(mock.rpc).toHaveBeenLastCalledWith('get_traffic_summary',{p_days:7});
  });
  it('treats an empty window and load failure as unknown visitor activity, not zero visitors',async()=>{
    mock.rpc.mockResolvedValue({data:{...summary(),totals:{site_visit:0,property_view:0,enquiry_success:0},sources:[],properties:[],daily:[]},error:null});
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));expect(host.textContent).toContain('not zero visitors');
    mock.rpc.mockResolvedValue({data:null,error:{code:'500',message:'failed'}});
    await act(async()=>host.querySelector<HTMLButtonElement>('.traffic-controls button')!.click());
    expect(host.querySelector('[role=alert]')?.textContent).toContain('No visitor count can be inferred');expect(host.querySelector('.traffic-metrics')).toBeNull();
  });
  it('discards a stale response after the account changes and hides old data when access is revoked',async()=>{
    let resolveOld:(value:unknown)=>void=()=>{};
    mock.rpc.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;}));
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));
    mock.auth={...mock.auth,user:{id:'staff-b'}};
    await act(async()=>root!.render(<TrafficDashboard lang="en"/>));
    expect(host.querySelector('.traffic-metrics')?.textContent).toContain('31');
    await act(async()=>resolveOld({data:{...summary(),totals:{site_visit:987654,property_view:0,enquiry_success:0}},error:null}));
    expect(host.textContent).not.toContain('987,654');
    mock.auth.adminVerified=false;await act(async()=>root!.render(<TrafficDashboard lang="en"/>));expect(host.querySelector('.traffic-metrics')).toBeNull();
  });
  it('leaves the complete generated URL available when automatic copy fails',async()=>{
    const writeText=vi.fn().mockRejectedValue(Error('blocked'));
    Object.defineProperty(navigator,'clipboard',{value:{writeText},configurable:true});
    await act(async()=>root!.render(<HotelCampaignLinks lang="zh"/>));
    await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());
    expect(host.querySelector('[role=status]')?.textContent).toContain('手动复制');
    const input=host.querySelector<HTMLInputElement>('.traffic-link-value input')!;
    expect(input.readOnly).toBe(true);expect(input.value).toContain('/zh/proprietes/hotels-motels/?utm_source=facebook');expect(input.value).toContain('utm_campaign=hotel-20261028');
    expect(writeText).toHaveBeenCalledWith(input.value);
  });
});
