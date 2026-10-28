// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Listing} from '../src/listings-data';
const live=vi.hoisted(()=>({items:[] as Listing[],loading:false,error:false}));
vi.mock('../src/lib/public-listings',()=>({publicListingsEnabled:true,usePublicListings:()=>live}));
vi.mock('../src/catalogue-map',()=>({default:({points}:{points:{id:string;approximate:boolean}[]})=><ul className="map-points">{points.map(point=><li key={point.id} data-approximate={point.approximate||undefined}>{point.id}</li>)}</ul>}));
import {ListingsPage} from '../src/listings';

let root:Root;
const base:Listing={id:'a',reference:'100001',type:'house',district:'Rue A',city:'Montréal',postal:'',aliases:'',price:500000,beds:3,baths:2,area:1500,date:'2026-10-01',mode:'broker',parking:false,outdoor:false,image:'/a.png',real:true};
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal('scrollTo',vi.fn());
  live.items=[
    base,
    {...base,id:'b',reference:'100002',district:'Rue B',type:'land',beds:null,baths:null,area:null,lotArea:8000,coordinates:{latitude:45.5,longitude:-73.6,source:'centris'}},
    {...base,id:'c',reference:'100003',district:'Rue C',type:'hotel-motel',beds:null,baths:null,coordinates:{latitude:46.8,longitude:-71.2,source:'centris'},source:{locationStatus:'approximate'} as Listing['source']},
    {...base,id:'d',reference:'100004',district:'Rue D',coordinates:{latitude:45.4,longitude:-73.5,source:'centris'},source:{locationStatus:'unverified'} as Listing['source']},
  ];
  window.history.replaceState(null,'','/fr/proprietes/');
  document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
const toggles=()=>[...document.querySelectorAll<HTMLInputElement>('.compare-toggle input')];

it('compares up to three properties side by side, without guessing missing facts',async()=>{
  await act(async()=>root.render(<ListingsPage lang="fr" hash="#proprietes"/>));
  expect(document.querySelector('.compare-bar')).toBeNull();
  await act(async()=>toggles()[0].click());
  expect(document.querySelector('.compare-bar')?.textContent).toContain('1 propriété sélectionnée');
  expect(document.querySelector<HTMLButtonElement>('.compare-bar .catalogue-cta')!.disabled).toBe(true);
  await act(async()=>{toggles()[1].click();});
  await act(async()=>{toggles()[2].click();});
  expect(toggles()[3].disabled).toBe(true);
  await act(async()=>document.querySelector<HTMLButtonElement>('.compare-bar .catalogue-cta')!.click());
  const rows=Object.fromEntries([...document.querySelectorAll('.compare-table tbody tr')].map(row=>[row.querySelector('th')!.textContent,[...row.querySelectorAll('td')].map(cell=>cell.textContent!.replace(/[  ]/g,' '))]));
  expect(document.querySelectorAll('.compare-table thead th')).toHaveLength(4);
  expect(rows['Superficie du terrain']).toEqual(['—','8 000 pi²','—']);
  expect(rows['Chambres']).toEqual(['3','—','—']);
  expect(rows['Chambres d’hébergement']).toEqual(['—','—','À confirmer']);
  expect(rows['Type de propriété']).toEqual(['Maison','Terrain','Hôtel / Motel']);
  await act(async()=>document.querySelector<HTMLButtonElement>('.compare-bar-items button')!.click());
  expect(document.querySelector('.compare-bar')?.textContent).toContain('2 propriétés sélectionnées');
  await act(async()=>document.querySelector<HTMLButtonElement>('.compare-clear')!.click());
  expect(document.querySelector('.compare-bar')).toBeNull();
});

it('maps only locations the property page would publish, and says how many are missing',async()=>{
  await act(async()=>root.render(<ListingsPage lang="en" hash="#proprietes"/>));
  await act(async()=>document.querySelector<HTMLButtonElement>('.view-toggle button[aria-label="Map view"]')!.click());
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect([...document.querySelectorAll('.map-points li')].map(point=>point.textContent)).toEqual(['b','c']);
  expect(document.querySelector('.map-points [data-approximate]')?.textContent).toBe('c');
  expect(document.querySelector('.map-missing')?.textContent).toBe('2 listings have no published location and are not on the map.');
  expect(document.querySelectorAll('.property-card')).toHaveLength(0);
});
