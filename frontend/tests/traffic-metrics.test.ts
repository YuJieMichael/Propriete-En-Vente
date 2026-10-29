// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const controls=vi.hoisted(()=>({configured:true,source:vi.fn(()=>({source:'facebook',medium:'social',campaign:'hotel-20261028'}))}));
vi.mock('../src/lib/backend-config',()=>({get backendConfigured(){return controls.configured;}}));
vi.mock('../src/lib/acquisition-source',()=>({readSourceForEvent:controls.source}));
const ledgerKey='propriete-en-vente:metric-window:v1';
const windowMs=30*60*1000;
const successful=()=>({ok:true,json:async()=>({ok:true})});
let send:ReturnType<typeof vi.fn>;
function at(origin='https://proprieteenvente.ca'){vi.stubGlobal('location',new URL(`${origin}/fr/?email=private%40example.com&q=private-search#access_token=private-token`));}
function privacy(doNotTrack:string|null='0',globalPrivacyControl=false){vi.stubGlobal('navigator',{doNotTrack,globalPrivacyControl});}
async function api(){return import('../src/lib/traffic-metrics');}
function ledger(){return JSON.parse(sessionStorage.getItem(ledgerKey)||'null') as {started:number;visit:boolean;properties:string[]}|null;}

beforeEach(()=>{
  vi.restoreAllMocks();vi.resetModules();sessionStorage.clear();controls.configured=true;
  controls.source.mockClear();at();privacy();
  vi.stubEnv('VITE_SUPABASE_URL','https://project.example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY','sb_publishable_test_public_key');
  send=vi.fn(async()=>successful());vi.stubGlobal('fetch',send);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();sessionStorage.clear();});

describe('production-only aggregate traffic events',()=>{
  it.each(['http://proprieteenvente.ca','https://www.proprieteenvente.ca','http://localhost:4173','http://127.0.0.1:4173','https://preview.workers.dev','https://proprieteenvente.ca.evil.example'])('does not record on a non-production origin: %s',async(origin)=>{
    at(origin);const metrics=await api();
    expect(metrics.automaticMetricsAllowed()).toBe(false);
    await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    expect(send).not.toHaveBeenCalled();expect(controls.source).not.toHaveBeenCalled();
    expect(metrics.enquiryAnalyticsSource()).toBe('unknown');
  });
  it('requires the configured public backend as well as the production origin',async()=>{
    controls.configured=false;const metrics=await api();await metrics.trackSiteVisit();
    expect(metrics.automaticMetricsAllowed()).toBe(false);expect(send).not.toHaveBeenCalled();
  });
  it.each([['1',false],['yes',false],['0',true],[null,true]] as const)('honours DNT/GPC without reading source or creating a ledger: %s / %s',async(dnt,gpc)=>{
    privacy(dnt,gpc);const metrics=await api();
    await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    expect(metrics.enquiryAnalyticsSource()).toBe('unknown');
    expect(send).not.toHaveBeenCalled();expect(controls.source).not.toHaveBeenCalled();expect(ledger()).toBeNull();
  });
  it('posts only event, finite channel source and numeric property reference, without account or URL context',async()=>{
    const metrics=await api();await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);
    const bodies=send.mock.calls.map(call=>JSON.parse((call[1] as RequestInit).body as string));
    expect(bodies).toEqual([{event:'site_visit',source:'facebook',reference:''},{event:'property_view',source:'facebook',reference:'100001'}]);
    for(const [url,request] of send.mock.calls as unknown as [string,RequestInit][]) {
      expect(url).toBe('https://project.example.supabase.co/functions/v1/record-traffic');
      expect(request.method).toBe('POST');expect(request.keepalive).toBe(true);
      expect(request.headers).toEqual({'Content-Type':'application/json',apikey:'sb_publishable_test_public_key'});
      expect(request.body).not.toMatch(/private|@|access_token|account|user|campaign|medium|https|referrer/);
    }
    expect(metrics.enquiryAnalyticsSource()).toBe('facebook');
    // This function supplies server-side enquiry context; it does not count a client enquiry event.
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('rejects demo identifiers, UUIDs and malformed property references before reading source or sending',async()=>{
    const metrics=await api();
    for(const ref of ['', 'demo-01','d396b72a-9d50-4ced-b15e-af3d723539ac','100001 ','-100001','1.5','<script>','1'.repeat(37)])await metrics.trackPropertyView(ref);
    expect(send).not.toHaveBeenCalled();expect(controls.source).not.toHaveBeenCalled();expect(ledger()).toBeNull();
    await metrics.trackPropertyView('100001');expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('bounded tab-window event deduplication',()=>{
  it('suppresses concurrent calls and rerenders without blocking different real property references',async()=>{
    let release:((value:ReturnType<typeof successful>)=>void)|undefined;
    send.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
    const metrics=await api();
    const first=metrics.trackPropertyView('100001');const duplicate=metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(1);release!(successful());await Promise.all([first,duplicate]);
    await metrics.trackPropertyView('100001');expect(send).toHaveBeenCalledTimes(1);
    send.mockImplementation(async()=>successful());await metrics.trackPropertyView('100002');
    expect(send).toHaveBeenCalledTimes(2);expect(ledger()?.properties).toEqual(['100001','100002']);
  });
  it('deduplicates site visits concurrently and after a full module reload in the same tab',async()=>{
    const metrics=await api();await Promise.all([metrics.trackSiteVisit(),metrics.trackSiteVisit()]);
    await metrics.trackPropertyView('100001');expect(send).toHaveBeenCalledTimes(2);
    vi.resetModules();const reloaded=await api();await reloaded.trackSiteVisit();await reloaded.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('uses a fixed thirty-minute window that reads and deduplicated calls do not renew',async()=>{
    const started=Date.now();vi.spyOn(Date,'now').mockReturnValue(started);
    const metrics=await api();await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    vi.mocked(Date.now).mockReturnValue(started+20*60*1000);await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);expect(ledger()?.started).toBe(started);
    vi.mocked(Date.now).mockReturnValue(started+windowMs);await metrics.trackSiteVisit();await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(4);expect(ledger()?.started).toBe(started+windowMs);
  });
  it.each(['network','http','body','json'] as const)('releases a failed event marker so a later interaction can retry: %s',async(kind)=>{
    if(kind==='network')send.mockRejectedValueOnce(Error('offline'));
    if(kind==='http')send.mockResolvedValueOnce({ok:false,json:async()=>({ok:true})});
    if(kind==='body')send.mockResolvedValueOnce({ok:true,json:async()=>({ok:false})});
    if(kind==='json')send.mockResolvedValueOnce({ok:true,json:async()=>{throw Error('invalid JSON');}});
    const metrics=await api();await metrics.trackPropertyView('100001');
    expect(ledger()?.properties).toEqual([]);
    await metrics.trackPropertyView('100001');await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);expect(ledger()?.properties).toEqual(['100001']);
  });
  it('also releases the separate site-visit flag after a failed request',async()=>{
    send.mockRejectedValueOnce(Error('offline'));
    const metrics=await api();await metrics.trackSiteVisit();expect(ledger()?.visit).toBe(false);
    await metrics.trackSiteVisit();await metrics.trackSiteVisit();
    expect(send).toHaveBeenCalledTimes(2);expect(ledger()?.visit).toBe(true);
  });
  it('does not let a late failure erase a newer window’s successful property event',async()=>{
    const start=Date.now();vi.spyOn(Date,'now').mockReturnValue(start);
    let reject:((error:Error)=>void)|undefined;
    send.mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
    const metrics=await api();const old=metrics.trackPropertyView('100001');
    vi.mocked(Date.now).mockReturnValue(start+windowMs+1);await metrics.trackPropertyView('100002');
    reject!(Error('offline'));await old;
    expect(ledger()?.properties).toEqual(['100002']);expect(ledger()?.started).toBe(start+windowMs+1);
  });
  it('caps the property ledger at one hundred without evicting earlier references or adding a person identifier',async()=>{
    const metrics=await api();
    for(let i=0;i<102;i++)await metrics.trackPropertyView(String(100001+i));
    expect(send).toHaveBeenCalledTimes(100);expect(ledger()?.properties).toHaveLength(100);
    expect(ledger()?.properties[0]).toBe('100001');expect(ledger()?.properties[99]).toBe('100100');
    expect(Object.keys(ledger()!).sort()).toEqual(['properties','started','visit']);
    await metrics.trackSiteVisit();expect(send).toHaveBeenCalledTimes(101);
  });
  it('safely deduplicates in memory if browser storage is entirely unavailable',async()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
    const metrics=await api();await metrics.trackSiteVisit();await metrics.trackSiteVisit();
    await metrics.trackPropertyView('100001');await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('does not overwrite newer memory deduplication with stale storage when a later write fails',async()=>{
    const metrics=await api();await metrics.trackSiteVisit();
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
    await metrics.trackPropertyView('100001');await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('starts a clean window for corrupt or implausibly future-dated storage',async()=>{
    const metrics=await api();
    sessionStorage.setItem(ledgerKey,'not JSON');await metrics.trackPropertyView('100001');
    expect(send).toHaveBeenCalledTimes(1);
    sessionStorage.setItem(ledgerKey,JSON.stringify({started:Date.now()+60000,visit:true,properties:['100002']}));
    await metrics.trackPropertyView('100002');expect(send).toHaveBeenCalledTimes(2);
  });
});
