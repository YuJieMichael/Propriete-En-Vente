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
it('keeps editorial listings in the public catalogue with their labelled public cover',async()=>{
 const id='e7fd914a-466a-4108-8fa9-5c69855aba77';
 const row={...records[0],id,listing_number:100100,published_at:'2026-11-05T12:00:00Z',photo_paths:[`/editorial/${id}/001.webp`],property:{...records[0].property,title:'Adresse non publiée',postal:'',beds:null,baths:null,area:null,coordinates:undefined,mode:'owner',source:{provider:'editorial',id,url:'https://entreprisesavendre.quebec/entreprises/confidential-mont-tremblant',placeholder:true}}};
 mock.query.mockResolvedValue({data:[row],error:null});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 expect((await loadPublicListings())[0]).toMatchObject({reference:'100100',image:row.photo_paths[0],area:null,source:{placeholder:true}});
 expect(mock.sign).not.toHaveBeenCalled();
});
it('uses reviewed Centris photos on a submitted listing while signing its private uploads',async()=>{
 const property={title:'1227, boulevard Rome',city:'Brossard',district:'',postal:'J4W 3K4',price:569000,type:'condo',beds:3,baths:1,area:1351,description:'Reviewed property listing.',mode:'broker',parking:true,outdoor:false};
 const photos=['/centris/15262438/001.webp','/centris/15262438/002.webp','private/original.jpg'];
 mock.query.mockResolvedValue({data:[{id:'rome',listing_number:100046,published_at:'2026-11-17T12:00:00Z',property,photo_paths:photos}],error:null});
 mock.sign.mockResolvedValue({data:[{path:photos[2],signedUrl:'https://photos.test/original.jpg'}],error:null});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 const [listing]=await loadPublicListings();
 expect(listing).toMatchObject({reference:'100046',image:photos[0],photos:[photos[0],photos[1],'https://photos.test/original.jpg'],title:property.title});
 expect(mock.sign).toHaveBeenCalledExactlyOnceWith([photos[2]],300);
});
it('refreshes a cached blurry gallery photo without changing its identity, order or private signed URLs',async()=>{
 const paths=['/centris/27686261/001.webp','/centris/27686261/005.webp','private/original.jpg'];
 const row={...records[0],listing_number:100043,published_at:'2026-11-19T12:00:00Z',photo_paths:[...paths]};
 mock.query.mockResolvedValue({data:[row],error:null});
 mock.sign.mockResolvedValue({data:[{path:paths[2],signedUrl:'https://photos.test/original.jpg?token=private'}],error:null});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 const [listing]=await loadPublicListings();
 expect(listing.photos?.[0]).toBe(paths[0]);
 const refreshed=new URL(listing.photos![1],'https://proprieteenvente.ca');
 expect(refreshed.pathname).toBe(paths[1]);expect(refreshed.searchParams.get('v')).toMatch(/^[a-f0-9]{12}$/);
 expect(listing.photos?.[1]).not.toBe(paths[1]);
 expect(listing.photos?.[2]).toBe('https://photos.test/original.jpg?token=private');
 expect(row.photo_paths).toEqual(paths);
 expect(mock.sign).toHaveBeenCalledExactlyOnceWith([paths[2]],300);
});

it('refreshes an enhanced public cover while keeping its gallery position',async()=>{
 const paths=['/centris/24397299/001.webp','/centris/24397299/002.webp'];
 mock.query.mockResolvedValue({data:[{...records[0],listing_number:100021,published_at:'2026-11-19T12:00:00Z',photo_paths:paths}],error:null});
 const {loadPublicListings}=await import('../src/lib/public-listings');
 const [listing]=await loadPublicListings();
 expect(listing.image).toBe(listing.photos?.[0]);
 expect(listing.image).toMatch(/^\/centris\/24397299\/001\.webp\?v=[a-f0-9]{12}$/);
 expect(listing.photos).toHaveLength(2);
 expect(listing.photos?.[1]).toBe(paths[1]);
 expect(mock.sign).not.toHaveBeenCalled();
});
