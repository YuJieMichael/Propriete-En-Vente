import {describe,expect,it} from 'vitest';
import {defaultFilters,filterQuery,readFilters,selectListings,listings,type Filters,type Listing} from '../src/listings-data';
const pool={id:'49000000-0000-4000-8000-000000000001',labels:{en:'Swimming pool',fr:'Piscine',zh:'泳池'},synonyms:['pool']};
const elevator={id:'49000000-0000-4000-8000-000000000002',labels:{en:'Elevator',fr:'Ascenseur',zh:'电梯'},synonyms:['lift']};
const feature=(key:string,en:string,fr=en,zh=en)=>({key,label:{en:key,fr:key,zh:key},value:{en,fr,zh}});
const both:Listing={...listings[0],id:'both',price:500000,parking:true,keywords:[pool,elevator]};
const items:Listing[]=[
 both,
 {...both,id:'pool-only',city:'Brossard',type:'house',price:700000,parking:false,keywords:[pool]},
 {...both,id:'street-lift',price:400000,parking:false,streetParking:true,keywords:[elevator]},
 {...both,id:'unknown',parking:null,keywords:[],features:[feature('Piscine','Not specified','Non précisée','未提供'),feature('Elevator','Not confirmed','À confirmer','待确认')]},
 {...both,id:'description-only',parking:false,keywords:[],description:'Ask whether the building has a pool or elevator.'},
];
const search=(extra:Partial<Filters>&{pool?:boolean;elevator?:boolean})=>selectListings(items,{...defaultFilters,...extra} as Filters).map(x=>x.id).sort();
describe('quick amenity filter contracts',()=>{
 it('requires affirmative public tags and combines independent amenities with AND',()=>{
  expect(search({pool:true})).toEqual(['both','pool-only']);
  expect(search({elevator:true})).toEqual(['both','street-lift']);
  expect(search({pool:true,elevator:true,parking:true})).toEqual(['both']);
 });
 it('keeps city, property type, price and the existing street-parking semantics',()=>{
  expect(search({q:'Montréal',type:'condo',max:'550000',pool:true,elevator:true,parking:true})).toEqual(['both']);
  expect(search({elevator:true,parking:true,max:'450000'})).toEqual(['street-lift']);
  expect(search({q:'Brossard',pool:true})).toEqual(['pool-only']);
 });
 it('recognizes affirmative published feature values without tags and rejects unknown or negative facts',()=>{
  const data=[
   {...both,id:'indoor',keywords:[],features:[feature('Piscine','Indoor','Intérieure','室内泳池'),feature('Amenities','Elevator, gym','Ascenseur, salle d’entraînement','电梯、健身房')]},
   {...both,id:'hotel',keywords:[],features:[feature('hotelAmenities','Indoor pool and banquet rooms','Piscine intérieure et salles de banquet','室内泳池和宴会厅')]},
   {...both,id:'negative',keywords:[],features:[feature('Piscine','No pool','Aucune piscine','无泳池'),feature('Amenities','No elevator','Sans ascenseur','无电梯')]},
   {...both,id:'unknown',keywords:[],features:[feature('Piscine','To be confirmed','À confirmer','待确认'),feature('Elevator','Unknown','Non précisé','未提供')]},
  ];
  expect(selectListings(data,{...defaultFilters,pool:true} as Filters).map(x=>x.id).sort()).toEqual(['hotel','indoor']);
  expect(selectListings(data,{...defaultFilters,elevator:true} as Filters).map(x=>x.id)).toEqual(['indoor']);
 });
 it('round-trips shareable amenities independently of translated query text and ignores invalid flags',()=>{
  const filters={...defaultFilters,q:'蒙特利尔',type:'condo',pool:true,elevator:true,parking:true,sort:'price-asc'} as Filters;
  expect(readFilters('#proprietes'+filterQuery(filters))).toEqual(filters);
  expect(readFilters('#proprietes?pool=true&elevator=unknown')).toEqual(defaultFilters);
  expect(readFilters('#propriete/100001?pool=1&elevator=1&parking=1')).toMatchObject({pool:true,elevator:true,parking:true});
 });
 it.each([
  ['pool','No indoor pool'],['pool','Pool not available'],['pool','Does not have a pool'],['pool','Pool table'],
  ['elevator',"Pas d’ascenseur"],['elevator','Ascenseur non disponible'],['elevator','未确认的电梯'],
 ] as const)('does not turn a negative or unrelated feature into an amenity: %s / %s',(amenity,value)=>{
  const data=[{...both,keywords:[],features:[feature('Amenities',value)]}];
  expect(selectListings(data,{...defaultFilters,[amenity]:true})).toEqual([]);
 });
 it.each([
  ['elevator','Amenities','Elevator not installed','Ascenseur absent','不设电梯'],
  ['pool','Piscine','Pool status pending','Piscine : statut en attente','泳池待定'],
  ['pool','Proximité','Near a public swimming pool','À proximité de la piscine municipale','靠近公共泳池'],
 ] as const)('requires an affirmative property amenity rather than a noun mention: %s / %s',(amenity,key,en,fr,zh)=>{
  const data=[{...both,keywords:[],features:[feature(key,en,fr,zh)]}];
  expect(selectListings(data,{...defaultFilters,[amenity]:true})).toEqual([]);
 });
});
