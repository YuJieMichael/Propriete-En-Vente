// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {commuteRadiusKm,distanceKm,estimatedMinutes,withinCommute} from '../src/lib/commute';
import {CommutePanel} from '../src/commute-panel';

const montreal={latitude:45.5017,longitude:-73.5673};
// About 111 km per degree of latitude.
const north=(km:number)=>({latitude:montreal.latitude+km/111.195,longitude:montreal.longitude});

describe('commute estimate',()=>{
  it('converts distance and minutes both ways',()=>{
    expect(distanceKm(montreal,north(10))).toBeCloseTo(10,1);
    expect(estimatedMinutes(0)).toBe(3);
    expect(estimatedMinutes(commuteRadiusKm(30))).toBe(30);
    expect(commuteRadiusKm(30)).toBeCloseTo(18.33,1);
  });
  it('keeps the points within the drive time, closest first',()=>{
    const points=[{id:'far',...north(40)},{id:'mid',...north(15)},{id:'near',...north(2)}];
    expect(withinCommute(points,montreal,30).map(entry=>entry.point.id)).toEqual(['near','mid']);
    expect(withinCommute(points,montreal,15).map(entry=>entry.point.id)).toEqual(['near']);
  });
});

describe('commute panel',()=>{
  let root:Root,host:HTMLDivElement;
  beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
  afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
  const button=(text:string)=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)!;
  it('starts picking, uses the browser location, and changes the drive time',async()=>{
    const onPicking=vi.fn(),onAnchor=vi.fn(),onMinutes=vi.fn();
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(ok:PositionCallback)=>ok({coords:{latitude:45.5,longitude:-73.6}} as GeolocationPosition)}});
    const show=(anchor:typeof montreal|null)=>act(async()=>root.render(<CommutePanel lang="en" anchor={anchor} minutes={30} picking={false} onPicking={onPicking} onAnchor={onAnchor} onMinutes={onMinutes}/>));
    await show(null);
    expect(host.querySelector('.commute-minutes')).toBeNull();
    await act(async()=>button('Pick on the map').click());
    expect(onPicking).toHaveBeenCalledWith(true);
    await act(async()=>button('Use my location').click());
    expect(onAnchor).toHaveBeenCalledWith({latitude:45.5,longitude:-73.6});
    await show(montreal);
    expect(button('30 min').getAttribute('aria-pressed')).toBe('true');
    await act(async()=>button('45 min').click());
    expect(onMinutes).toHaveBeenCalledWith(45);
    await act(async()=>button('Clear').click());
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });
  it('explains when the location is unavailable',async()=>{
    vi.stubGlobal('navigator',{geolocation:{getCurrentPosition:(_:PositionCallback,fail:PositionErrorCallback)=>fail({code:1} as GeolocationPositionError)}});
    await act(async()=>root.render(<CommutePanel lang="fr" anchor={null} minutes={30} picking={false} onPicking={()=>{}} onAnchor={()=>{}} onMinutes={()=>{}}/>));
    await act(async()=>button('Utiliser ma position').click());
    expect(host.querySelector('.commute-status')?.textContent).toBe('Votre position n’est pas disponible. Choisissez plutôt un point sur la carte.');
  });
});
