import {describe,expect,it} from 'vitest';
import {defaultFilters,listings,selectListings} from '../src/listings-data';
import {parseSearchSentence} from '../src/smart-search';

describe('local sentence search',()=>{
  it('recognizes the Chinese example and applies only existing catalogue filters',()=>{
    const parsed=parseSearchSentence('想找蒙特利尔70万以内、两间卧室、有车位的公寓','zh',listings);
    expect(parsed.filters).toMatchObject({q:'Montréal',max:'700000',beds:'2',parking:true,type:'condo'});
    expect(parsed.canApply).toBe(true);
    expect(parsed.unhandled).toEqual([]);
    // The existing catalogue genuinely has no matching 2-bedroom condo with parking.
    expect(selectListings(listings,{...defaultFilters,...parsed.filters})).toEqual([]);
  });
  it.each([
    ['A condo in Montreal under $700,000, 2 bedrooms, with parking','en'],
    ['Un condo à Montréal, moins de 700 000 $, 2 chambres, avec stationnement','fr'],
    ['Montreal 公寓 under 0.7 million, 2 bedrooms with parking','zh'],
    ['condo budget 700k','en'],
    ['condo budget 0,7 million','fr'],
    ['公寓70万元以内','zh'],
  ] as const)('understands a real budget without sending the input anywhere: %s',(text,lang)=>{
    const parsed=parseSearchSentence(text,lang,listings);
    expect(parsed.filters.max).toBe('700000');expect(parsed.filters.type).toBe('condo');
  });
  it('supports both price bounds and refuses a reversed range',()=>{
    expect(parseSearchSentence('house between 500k and 900k','en',listings).filters).toMatchObject({min:'500000',max:'900000'});
    expect(parseSearchSentence('土地50万到70万','zh',listings).filters).toMatchObject({type:'land',min:'500000',max:'700000'});
    expect(parseSearchSentence('over 800000 under 500000 condo','en',listings).filters).toEqual({type:'condo'});
  });
  it('does not invert a negated price comparison or mistake the start of a word for a million suffix',()=>{
    expect(parseSearchSentence('no more than 700k condo','en',listings).filters.max).toBe('700000');
    expect(parseSearchSentence('no less than 500k house','en',listings).filters.min).toBe('500000');
    expect(parseSearchSentence('maximum 700000 maison','fr',listings).filters.max).toBe('700000');
  });
  it('does not turn an exclusion into a positive requirement',()=>{
    for(const text of ['a condo without parking','un condo sans stationnement','公寓不要车位',"a condo, don't need parking",'a condo, parking not required']) {
      const parsed=parseSearchSentence(text,'en',listings);
      expect(parsed.filters.parking).toBeUndefined();expect(parsed.unhandled.join(' ')).toContain('Exclusions');
    }
    expect(parseSearchSentence('not hotel but a condo','en',listings).filters.type).toBe('condo');
    expect(parseSearchSentence('a condo with parking but no garage','en',listings).filters.parking).toBeUndefined();
    expect(parseSearchSentence('condo not in Montreal','en',listings).filters.q).toBeUndefined();
    expect(parseSearchSentence('condo not under 700k','en',listings).filters.max).toBeUndefined();
  });
  it('does not invent a location or silently accept unsupported travel constraints',()=>{
    const parsed=parseSearchSentence('condo in Atlantis, near metro, under 700k','en',listings);
    expect(parsed.filters.q).toBeUndefined();expect(parsed.filters.max).toBe('700000');
    expect(parsed.unhandled.join(' ')).toMatch(/atlantis.*near metro/);
    expect(parseSearchSentence('Montréal or Laval house','en',listings).filters.q).toBeUndefined();
    expect(parseSearchSentence('Griffintown condo','en',listings).filters.q).toBe('Griffintown');
  });
  it('uses actual city bases for translated place names even when live aliases contain only French addresses',()=>{
    const live=[{...listings[0],city:'Montréal (Ville-Marie)',district:'2000, rue Tupper, app. 1202',aliases:'2000, rue Tupper, app. 1202 Montréal (Ville-Marie) 100001'}];
    const parsed=parseSearchSentence('想找蒙特利尔70万以内、两间卧室、有车位的公寓','zh',live);
    expect(parsed.filters).toMatchObject({q:'Montréal',max:'700000',beds:'2',parking:true,type:'condo'});
    expect(parsed.unhandled).toEqual([]);
    const rental=parseSearchSentence('Montréal condo for rent under 2000','en',live);
    expect(rental.filters).toMatchObject({q:'Montréal',transaction:'rent',max:'2000',type:'condo'});
    expect(rental.conditions.find(condition=>condition.key==='q')?.value).not.toContain('2000');
    expect(parseSearchSentence('魁北克市公寓70万以内','zh',live).filters.q).toBeUndefined();
    expect(parseSearchSentence('拉瓦尔的独立屋','zh',listings).filters.q).toBe('Laval');
  });
  it('checks bedroom semantics against the existing exact / five-plus filters',()=>{
    expect(parseSearchSentence('at least 2 bedrooms condo','en',listings).filters.beds).toBeUndefined();
    expect(parseSearchSentence('condo 2 chambres minimum','fr',listings).filters.beds).toBeUndefined();
    expect(parseSearchSentence('6 bedrooms house','en',listings).filters.beds).toBeUndefined();
    expect(parseSearchSentence('house 5+ bedrooms','en',listings).filters.beds).toBe('5');
  });
  it.each([
    ['condo with at most 2 bathrooms','en'],
    ['condo with no more than 2 bathrooms','en'],
    ['condo with exactly 2 bathrooms','en'],
    ['condo 2 salles de bain maximum','fr'],
    ['condo avec au plus 2 salles de bain','fr'],
    ['condo avec exactement 2 salles de bain','fr'],
    ['公寓最多2个浴室','zh'],
    ['公寓2间浴室以下','zh'],
    ['公寓恰好2个卫生间','zh'],
    ['公寓只有2间浴室','zh'],
  ] as const)('never turns a bathroom maximum or exact count into the existing minimum: %s',(text,lang)=>{
    const parsed=parseSearchSentence(text,lang,listings);
    expect(parsed.filters.type).toBe('condo');expect(parsed.filters.baths).toBeUndefined();
    expect(parsed.conditions.some(condition=>condition.key==='baths')).toBe(false);
    expect(parsed.unhandled.join(' ')).toMatch(/maximum or exact|maximale ou un nombre exact|最多数量或精确数量/);
  });
  it.each([['condo 2 bathrooms','en'],['condo 2 salles de bain','fr'],['公寓2个浴室','zh']] as const)('previews a plain bathroom count explicitly as the supported minimum: %s',(text,lang)=>{
    const parsed=parseSearchSentence(text,lang,listings);
    expect(parsed.filters.baths).toBe('2');
    expect(parsed.conditions.find(condition=>condition.key==='baths')?.value).toBe('≥ 2');
  });
  it.each([
    ['condo under 30 minutes from metro','en'],
    ['condo under 2 km from a station','en'],
    ['condo under 900 sqft','en'],
    ['condo less than 80 m²','en'],
    ['condo no more than 2 full bathrooms','en'],
    ['condo with at most 2 half bathrooms','en'],
    ['condo with at most 2.5 bathrooms','en'],
    ['condo moins de 30 minutes du métro','fr'],
    ['公寓不超过30分钟到地铁','zh'],
    ['公寓不超过80平方米','zh'],
  ] as const)('never reinterprets an unsupported quantity as a price: %s',(text,lang)=>{
    const parsed=parseSearchSentence(text,lang,listings);
    expect(parsed.filters).toEqual({type:'condo'});
    expect(parsed.unhandled.length).toBeGreaterThan(0);
  });
  it('still accepts a genuine monetary amount and a bare monthly rental budget',()=>{
    expect(parseSearchSentence('condo under $700000','en',listings).filters.max).toBe('700000');
    expect(parseSearchSentence('condo for rent under 2000','en',listings).filters).toMatchObject({transaction:'rent',max:'2000'});
  });
  it('recognizes transaction and catalogue business types',()=>{
    expect(parseSearchSentence('hotel for sale under 3m','en',listings).filters).toMatchObject({type:'hotel-motel',transaction:'sale',max:'3000000'});
    expect(parseSearchSentence('garderie à louer budget 3000','fr',listings).filters).toMatchObject({type:'daycare',transaction:'rent',max:'3000'});
    expect(parseSearchSentence('land or condo under 700k','en',listings).filters.type).toBeUndefined();
  });
  it('handles empty and unrecognized input explicitly and caps text length',()=>{
    expect(parseSearchSentence('','en',listings).canApply).toBe(false);
    expect(parseSearchSentence('something nice','en',listings).unhandled.join(' ')).toContain('something nice');
    const parsed=parseSearchSentence('condo '+ 'x'.repeat(400),'en',listings);
    expect(parsed.truncated).toBe(true);expect(parsed.input.length).toBeLessThanOrEqual(300);
    expect(parseSearchSentence('under 700k condo','en',[]).filters).toMatchObject({max:'700000',type:'condo'});
  });
});
