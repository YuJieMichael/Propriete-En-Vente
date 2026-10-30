import {describe,expect,it} from 'vitest';
import {relatedListings,type RelatedListing} from '../src/listing-navigation';

const item:RelatedListing={id:'current',reference:'100001',type:'condo',city:'Montréal (Ville-Marie)',neighbourhood:'Ville-Marie',real:true};

describe('related public properties',()=>{
  it('prioritizes property type and known location without treating an address as a neighbourhood',()=>{
    const candidates=[
      {...item,id:'same-address',reference:'100002',city:'Québec',district:'Ville-Marie'},
      {...item,id:'same-city',reference:'100003',city:'Montreal (Verdun)',neighbourhood:'Verdun'},
      {...item,id:'same-neighbourhood',reference:'100004',city:'Montréal',neighbourhood:'ville marie'},
      {...item,id:'different-type',reference:'100005',type:'house'},
    ];
    expect(relatedListings(item,candidates,4).map(value=>value.id)).toEqual(['same-neighbourhood','same-city','same-address','different-type']);
    expect(candidates.map(value=>value.id)).toEqual(['same-address','same-city','same-neighbourhood','different-type']);
  });

  it('excludes the current property, duplicate references and fictional examples from real details',()=>{
    const real={...item,id:'real',reference:'100002'};
    const candidates=[item,{...item,id:'legacy-current'},real,{...real,id:'duplicate'}, {...real,id:'demo-01',reference:'100003'},{...real,id:'fictional',reference:'100004',real:undefined}];
    expect(relatedListings(item,candidates).map(value=>value.id)).toEqual(['real']);
    expect(relatedListings({...item,id:'demo-current',real:undefined},candidates).map(value=>value.id)).toEqual(['demo-01','fictional']);
  });

  it('uses a deterministic fallback for unknown location and never mutates the input',()=>{
    const current={id:'current',city:'',real:true};
    const candidates=[{id:'b',city:'Québec',real:true},{id:'a',city:'Laval',real:true}];
    expect(relatedListings(current,candidates,1).map(value=>value.id)).toEqual(['a']);
    expect(candidates.map(value=>value.id)).toEqual(['b','a']);
    expect(relatedListings(current,candidates,0)).toEqual([]);
  });
});
