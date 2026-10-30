import {describe,expect,it} from 'vitest';
import {checkListing} from '../src/listing-checkup-data';
import type {PublicProperty} from '../../supabase/functions/_shared/listing-input';

const property:PublicProperty={title:'Condo lumineux à Montréal',type:'condo',city:'Montréal',district:'Ville-Marie',postal:'H3H 0B1',price:500000,beds:2,baths:1,area:743,description:'A detailed description of the property layout, current condition, inclusions and availability for buyers to review before they enquire.',mode:'owner',parking:true,parkingSpaces:1,outdoor:false};
const photos=['data:image/jpeg;base64,A','data:image/jpeg;base64,B'];

describe('local seller listing checkup',()=>{
  it('reports only image problems supported by actual dimensions and fingerprints',()=>{
    const known=checkListing(property,photos,[{width:500,height:400,hash:'same'},{width:1600,height:1200,hash:'same'}],'en');
    expect(known.attention.find(finding=>finding.key==='small')?.text).toContain('1.');
    expect(known.attention.find(finding=>finding.key==='duplicate')?.text).toContain('1, 2');
    const unknown=checkListing(property,photos,[{},{}],'en');
    expect(unknown.attention.some(finding=>['small','duplicate','unreadable'].includes(finding.key))).toBe(false);
    const distinct=checkListing(property,photos,[{width:800,height:1200,hash:'a'},{width:1600,height:1200,hash:'b'}],'en');
    expect(distinct.attention.some(finding=>['small','duplicate'].includes(finding.key))).toBe(false);
  });

  it('offers changes for actual missing data and preserves parsed zero counts',()=>{
    const result=checkListing({...property,beds:0,baths:0,district:'',description:'Short'},[photos[0]],[],'en');
    expect(result.attention.map(finding=>finding.key)).toEqual(['brief','district','fewPhotos']);
    expect(result.attention.some(finding=>finding.key==='beds'||finding.key==='baths')).toBe(false);
    expect(checkListing({...property,parking:true,parkingSpaces:0},photos,[],'en').attention.some(finding=>finding.key==='parking')).toBe(true);
    expect(checkListing({...property,parking:false,parkingSpaces:0,streetParking:true},photos,[],'en').attention.some(finding=>finding.key==='parking')).toBe(false);
  });

  it('uses type-specific seller questions without treating commercial zero beds as missing',()=>{
    const business=checkListing({...property,type:'business',beds:0,baths:0},photos,[],'en');
    expect(business.confirm.map(finding=>finding.key)).toEqual(['business']);
    expect(business.confirm[0].text).toContain('shares or assets');
    expect(business.attention).toHaveLength(0);
    const land=checkListing({...property,type:'land',beds:0,baths:0},photos,[],'fr');
    expect(land.confirm[0].text).toContain('superficie saisie correspond au terrain');
    const daycare=checkListing({...property,type:'daycare',daycareSubsidy:'subsidized'},photos,[],'zh');
    expect(daycare.confirm[0].text).toContain('许可名额');
  });
});
