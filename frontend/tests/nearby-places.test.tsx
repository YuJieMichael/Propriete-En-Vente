// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {category,distance,overpassQuery,summarize,walkingMinutes} from '../src/lib/nearby';

const origin={lat:45.4893,lon:-73.5851};
// Roughly 111 m per 0.001° of latitude.
const north=(metres:number)=>origin.lat+metres/111_195;

describe('nearby summary',()=>{
  it('measures distance and walking time',()=>{
    expect(distance(origin.lat,origin.lon,north(1000),origin.lon)).toBeCloseTo(1000,0);
    expect(walkingMinutes(400)).toBe(5);
    expect(walkingMinutes(10)).toBe(1);
  });
  it('keeps the closest named place per category and counts close bus stops',()=>{
    const result=summarize(origin.lat,origin.lon,[
      {lat:north(900),lon:origin.lon,tags:{railway:'station',name:'Atwater'}},
      {lat:north(300),lon:origin.lon,tags:{railway:'station',name:'Guy-Concordia'}},
      {center:{lat:north(200),lon:origin.lon},tags:{shop:'supermarket',name:'Marché'}},
      {lat:north(100),lon:origin.lon,tags:{amenity:'pharmacy'}},
      {lat:north(2000),lon:origin.lon,tags:{amenity:'school',name:'Too far'}},
      {lat:north(100),lon:origin.lon,tags:{highway:'bus_stop'}},
      {lat:north(450),lon:origin.lon,tags:{highway:'bus_stop'}},
      {lat:north(700),lon:origin.lon,tags:{highway:'bus_stop'}},
    ]);
    expect(result.places.transit).toEqual({name:'Guy-Concordia',distance:300});
    expect(result.places.grocery?.name).toBe('Marché');
    expect(result.places.pharmacy).toBeUndefined();
    expect(result.places.school).toBeUndefined();
    expect(result.busStops).toBe(2);
  });
  it('classifies tags and builds one query around the point',()=>{
    expect(category({amenity:'clinic'})).toBe('health');
    expect(category({leisure:'park'})).toBe('park');
    expect(category({amenity:'bank'})).toBeNull();
    expect(overpassQuery(45.5,-73.6)).toContain('(around:1500,45.5,-73.6)');
  });
});

describe('nearby places section',()=>{
  let root:Root,host:HTMLDivElement;
  beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.resetModules();});
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
  async function show(response:Response){
    const fetch=vi.fn(async()=>response);vi.stubGlobal('fetch',fetch);
    const {NearbyPlaces}=await import('../src/nearby-places');
    await act(async()=>root.render(<NearbyPlaces reference="100001" approximate={false} lang="fr"/>));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    return fetch;
  }
  it('shows the saved places with distances and the OpenStreetMap credit',async()=>{
    const fetch=await show(new Response(JSON.stringify({checked:'2026-10-29',places:{transit:{name:'Guy-Concordia',distance:320}},busStops:3})));
    expect(fetch).toHaveBeenCalledWith('/nearby/100001.json');
    expect(host.querySelector('.nearby-list li')?.textContent).toBe('Métro, REM ou trainGuy-Concordia320 m · environ 4 min à pied');
    expect(host.textContent).toContain('3 arrêts d’autobus à moins de 500 m');
    expect(host.textContent).toContain('1,5 km');
    expect(host.querySelector('.nearby-credit')?.textContent).toContain('OpenStreetMap, vérifiées le 2026-10-29');
  });
  it('stays hidden when the listing has no saved file',async()=>{
    await show(new Response('',{status:404}));
    expect(host.innerHTML).toBe('');
  });
});
