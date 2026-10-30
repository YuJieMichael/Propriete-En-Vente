// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {daycareRevenue,hotelRevenue,payback,publishedCount} from '../src/lib/payback';
import {PaybackEstimator} from '../src/payback-estimator';
import type {Listing} from '../src/listings-data';

const text=(value:string)=>({en:value,fr:value,zh:value});
const listing=(extra:Partial<Listing>={}):Listing=>({id:'id-1',reference:'100028',type:'hotel-motel',district:'',city:'Sherbrooke',postal:'',aliases:'',price:1490000,beds:null,baths:null,area:null,date:'2026-10-28',mode:'broker',parking:null,outdoor:null,image:'/x.webp',real:true,transaction:'sale',features:[{key:'guestRooms',label:text('Motel guest rooms'),value:text('18')}],...extra});
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const value=(label:string)=>[...host.querySelectorAll('.payback-results > div')].find(row=>row.querySelector('dt')?.textContent===label)?.querySelector('dd')?.textContent?.replace(/\s/g,'');

describe('payback model',()=>{
  it('derives revenue, net income, cap rate and years',()=>{
    expect(hotelRevenue(18,120,0.6)).toBeCloseTo(473040);
    expect(daycareRevenue(80,60,0.95)).toBeCloseTo(1185600);
    const result=payback({price:1_000_000,revenue:400_000,expenseRatio:0.75});
    expect(result).toMatchObject({expenses:300000,net:100000,capRate:0.1,years:10});
    expect(payback({price:1_000_000,revenue:0,expenseRatio:0.5})).toMatchObject({capRate:null,years:null});
  });
  it('reads counts from published facts',()=>{
    expect(publishedCount('Approximately 17')).toBe(17);
    expect(publishedCount('80 subsidized places')).toBe(80);
    expect(publishedCount('Not published; confirm with the broker')).toBeNull();
  });
});

describe('payback estimator',()=>{
  it('starts from the published room count and updates when a slider moves',async()=>{
    await act(async()=>root.render(<PaybackEstimator item={listing()} lang="en"/>));
    const disclosure=host.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    await act(async()=>host.querySelector('summary')!.click());
    expect(disclosure.open).toBe(true);
    const rooms=host.querySelector('input[type=range]') as HTMLInputElement;
    expect(rooms.value).toBe('18');
    expect(host.querySelector('.payback-slider small')?.textContent).toBe('published');
    // 18 × 120 × 60% × 365 = 473,040; 35% kept = 165,564; 1,490,000 / 165,564 ≈ 9 years
    expect(value('Net operating income / year')).toBe('$165,564');
    expect(value('Payback')).toBe('9years');
    const setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
    await act(async()=>{setValue.call(rooms,'36');rooms.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(value('Payback')).toBe('4.5years');
    expect(host.querySelector('.payback-slider small')?.textContent).toBe('assumed');
    await act(async()=>host.querySelector('summary')!.click());
    expect(disclosure.open).toBe(false);
    await act(async()=>host.querySelector('summary')!.click());
    expect(rooms.value).toBe('36');
  });
  it('only appears on business listings for sale',async()=>{
    await act(async()=>root.render(<><PaybackEstimator item={listing({type:'condo'})} lang="fr"/><PaybackEstimator item={listing({transaction:'rent'})} lang="fr"/></>));
    expect(host.innerHTML).toBe('');
  });
});
