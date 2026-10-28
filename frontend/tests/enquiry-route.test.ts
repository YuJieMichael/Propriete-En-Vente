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

describe('confidential property request route',()=>{
 it('requires one real-format property reference and one explicit NDA intent',async()=>{
  const {readConfidentialRequest}=await import('../src/lib/enquiry-route');
  expect(readConfidentialRequest('#acheter?listing=100024&intent=nda')).toBe(true);
  expect(readConfidentialRequest('#acheter?listing=00000000-0000-5000-8000-000000000024&intent=nda')).toBe(true);
  for(const hash of ['#acheter?intent=nda','#vendre?listing=100024&intent=nda','#acheter?listing=100024','#acheter?listing=100024&intent=nda&intent=other','#acheter?listing=100024&listing=100025&intent=nda','#acheter?listing=bad&intent=nda'])expect(readConfidentialRequest(hash)).toBe(false);
 });
});
