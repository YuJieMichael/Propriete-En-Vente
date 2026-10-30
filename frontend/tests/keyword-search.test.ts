import {describe,expect,it} from 'vitest';
import {defaultFilters,listings,selectListings,type Listing} from '../src/listings-data';
import {readListingKeywords} from '../src/keyword-search';
import {parseSearchSentence} from '../src/smart-search';

const waterfront={id:'46000000-0000-4000-8000-000000000001',labels:{en:'Waterfront',fr:'Bord de l’eau',zh:'临水'},synonyms:['lakefront','au bord du lac','湖畔']};
const renovated={id:'46000000-0000-4000-8000-000000000002',labels:{en:'Renovated',fr:'Rénové',zh:'已翻新'},synonyms:['refurbished','装修更新']};
const items:Listing[]=[
 {...listings[0],id:'one',reference:'100024',type:'hotel-motel',city:'Montréal',district:'Public location',aliases:'Montreal',keywords:[waterfront,renovated]},
 {...listings[1],id:'two',type:'daycare',city:'Brossard',aliases:'Brossard',keywords:[waterfront]},
 {...listings[2],id:'three',type:'hotel-motel',city:'Montréal',aliases:'Montreal',keywords:[]},
];
const search=(q:string,extra={})=>selectListings(items,{...defaultFilters,q,...extra}).map(x=>x.id).sort();

describe('public multilingual keyword matching',()=>{
 it.each(['motel','hôtel','HOTELS','汽车旅馆','酒店'])('matches real property types: %s',q=>expect(search(q)).toEqual(['one','three']));
 it.each(['garderie','daycare','托儿所'])('matches daycare synonyms: %s',q=>expect(search(q)).toEqual(['two']));
 it.each(['Waterfront','BORD DE L’EAU','lakefront','au bord du lac','湖畔','临水'])('matches assigned tags across languages: %s',q=>expect(search(q)).toEqual(['one','two']));
 it('combines city, type, multiple tags and reference without broadening',()=>{
  expect(search('Montréal motel lakefront')).toEqual(['one']);
  expect(search('蒙特利尔湖畔酒店')).toEqual(['one']);
  expect(search('waterfront rénové')).toEqual(['one']);
  expect(search('100024')).toEqual(['one']);
  expect(search('garderie Brossard')).toEqual(['two']);
  expect(search('lakefront',{max:'600000'})).toEqual(['one']);
  expect(search('Montréal Atlantis')).toEqual([]);
  expect(search('notamotel')).toEqual([]);
 });
 it('treats a shared synonym as alternatives rather than requiring every matching tag',()=>{
  const data=[{...items[0],keywords:[{...waterfront,synonyms:['scenic']}]},{...items[1],keywords:[{...renovated,synonyms:['scenic']}]}];
  expect(selectListings(data,{...defaultFilters,q:'scenic'})).toHaveLength(2);
 });
 it('safely decodes only bounded public keyword metadata',()=>{
  expect(readListingKeywords([waterfront,{id:'bad',labels:{en:'bad'}}])).toEqual([waterfront]);
  expect(readListingKeywords(null)).toEqual([]);
  expect(readListingKeywords({contact:'never-index'})).toEqual([]);
  expect(readListingKeywords([{...waterfront,labels:{en:'Waterfront',fr:12,zh:'临水'}}])).toEqual([]);
 });
 it('adds custom keywords to sentence review without interpreting them as locations',()=>{
  const parsed=parseSearchSentence('motel in Montreal with lakefront under 700k','en',items);
  expect(parsed.filters).toMatchObject({type:'hotel-motel',q:'Montréal lakefront',max:'700000'});
  expect(parsed.unhandled).toEqual([]);
  expect(selectListings(items,{...defaultFilters,...parsed.filters}).map(x=>x.id)).toEqual(['one']);
  const chinese=parseSearchSentence('想找蒙特利尔湖畔酒店','zh',items);
  expect(chinese.filters.q).toBe('Montréal 湖畔');
  expect(chinese.unhandled).toEqual([]);
 });
 it('supports exact references from the homepage and keeps negated tags unconfirmed',()=>{
  const reference=parseSearchSentence('100024','en',items);
  expect(reference.filters.q).toBe('100024');expect(reference.canApply).toBe(true);expect(reference.unhandled).toEqual([]);
  const negative=parseSearchSentence('motel without lakefront','en',items);
  expect(negative.filters.q).toBeUndefined();expect(negative.unhandled.join(' ')).toContain('Exclusions');
 });
});
