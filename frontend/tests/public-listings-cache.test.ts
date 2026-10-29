import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import records from '../../data/centris-import-20260928.json';
const mock=vi.hoisted(()=>({query:vi.fn(),sign:vi.fn()}));
vi.mock('../src/lib/backend-config',()=>({backendConfigured:true}));
vi.mock('../src/lib/supabase',()=>({supabase:{from:()=>({select:()=>({order:()=>({limit:mock.query})})}),storage:{from:()=>({createSignedUrls:mock.sign})}}}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_LISTING_PUBLICATION_ENABLED','true');mock.query.mockReset();mock.sign.mockReset();});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('shares an in-flight catalogue request and reuses public results until refresh time',async()=>{
 let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);
 let finish!:(value:unknown)=>void;
 mock.query.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const {loadPublicListings}=await import('../src/lib/public-listings');
 const first=loadPublicListings(),second=loadPublicListings();
 // The SDK loads on first use, so the request starts after that import resolves.
 await vi.waitFor(()=>expect(mock.query).toHaveBeenCalled());
 expect(mock.query).toHaveBeenCalledTimes(1);
 const keyword={id:'46000000-0000-4000-8000-000000000001',labels:{en:'Lakefront',fr:'Au bord du lac',zh:'湖畔'},synonyms:['waterfront']};
 const row={...records[0],listing_number:100001,published_at:'2026-09-28T00:00:00Z',search_keywords:[keyword]};
 finish({data:[row],error:null});
 const result=await first;
 expect(await second).toBe(result);expect(await loadPublicListings()).toBe(result);
 expect(result[0].reference).toBe('100001');expect(result[0].aliases).not.toContain(records[0].property.source.id);
 expect(result[0].keywords).toEqual([keyword]);expect(result[0].aliases).not.toContain('waterfront');
 expect(mock.sign).not.toHaveBeenCalled();
 now+=240001;mock.query.mockResolvedValue({data:[],error:null});
 expect(await loadPublicListings()).toEqual([]);expect(mock.query).toHaveBeenCalledTimes(2);
});
it('does not cache failed loads and signs stored photos in one batch',async()=>{
 mock.query.mockResolvedValueOnce({data:null,error:Error('offline')});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 await expect(loadPublicListings()).rejects.toThrow('offline');
 const row={...records[0],listing_number:100002,published_at:'2026-09-28T00:00:00Z',photo_paths:['private/one.webp','private/two.webp']};
 mock.query.mockResolvedValue({data:[row],error:null});
 mock.sign.mockResolvedValue({data:row.photo_paths.map(path=>({path,signedUrl:`https://photos.test/${path}`})),error:null});
 expect((await loadPublicListings())[0].photos).toHaveLength(2);
 expect(mock.sign).toHaveBeenCalledExactlyOnceWith(row.photo_paths,300);
});
it('invalidates keyword snapshots after staff saves without letting an older in-flight load refill the cache',async()=>{
 let finish!:(value:unknown)=>void;
 mock.query.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const {loadPublicListings,invalidatePublicListings}=await import('../src/lib/public-listings');
 const old=loadPublicListings();invalidatePublicListings();
 const row={...records[0],listing_number:100024,published_at:'2026-09-28T00:00:00Z'};
 mock.query.mockResolvedValue({data:[row],error:null});
 const current=await loadPublicListings();finish({data:[],error:null});await old;
 expect(await loadPublicListings()).toBe(current);expect(current[0].reference).toBe('100024');expect(mock.query).toHaveBeenCalledTimes(2);
});
it('orders listings with equal publication times by id',async()=>{
 const tied=['c','a','b'].map(id=>({...records[0],id,listing_number:100001,published_at:'2026-10-27T15:01:01.268552'}));
 mock.query.mockResolvedValue({data:tied,error:null});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 expect((await loadPublicListings()).map(item=>item.id)).toEqual(['a','b','c']);
});
