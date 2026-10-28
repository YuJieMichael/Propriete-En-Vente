import {describe,it,expect} from 'vitest';
import {readEnquiryPreset} from '../src/lib/enquiry-route';
import {hotelAcquisitionHref} from '../src/hotel-acquisition-copy';

describe('hotel enquiry route',()=>{
  it.each(['en','fr','zh'] as const)('keeps a public %s intent across a full page reload',lang=>{
    const url=new URL(hotelAcquisitionHref(lang),'https://proprieteenvente.ca');
    expect(readEnquiryPreset(url.hash)).toBe('hotel-motel');
    expect(readEnquiryPreset(url.hash)).toBe('hotel-motel');
  });
  it('does not override a property enquiry or interpret unrecognized intent',()=>{
    for(const hash of ['#acheter','#vendre?propertyType=hotel-motel&intent=hotel-acquisition','#acheter?propertyType=land&intent=hotel-acquisition','#acheter?propertyType=hotel-motel&intent=hotel-acquisition&listing=100001','#acheter?propertyType=hotel-motel&propertyType=house&intent=hotel-acquisition','#acheter?propertyType=hotel-motel&intent=hotel-acquisition&intent=other'])expect(readEnquiryPreset(hash)).toBe('');
  });
});
