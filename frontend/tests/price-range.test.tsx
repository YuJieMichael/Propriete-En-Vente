// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {PriceRange} from '../src/price-range';
import {defaultFilters} from '../src/listings-data';
it('synchronises price handles and numeric inputs, clamps crossed handles and allows unlimited maximum',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 function Example(){const [filters,setFilters]=useState({...defaultFilters,min:'200000',max:'800000'});return <PriceRange filters={filters} lang="fr" ceiling={1000000} invalid={false} onChange={patch=>setFilters(current=>({...current,...patch}))}/>;}
 const input=async(selector:string,value:string)=>{await act(async()=>{const node=el.querySelector(selector)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));});};
 try{
  await act(async()=>root.render(<Example/>));
  await input('.price-range-min','900000');expect(el.querySelector<HTMLInputElement>('.price-range-min')?.value).toBe('800000');
  await input('.price-range-max','100000');expect(el.querySelector<HTMLInputElement>('.price-range-max')?.value).toBe('800000');
  await input('.price-range-max','1000000');expect(el.querySelector<HTMLInputElement>('.price-range-inputs label:last-child input')?.value).toBe('');
  expect(el.querySelector('.price-range-max')?.getAttribute('aria-valuetext')).toBe('Sans limite');
  await input('.price-range-inputs label:first-child input','345678');expect(el.querySelector<HTMLInputElement>('.price-range-min')?.value).toBe('345678');
 }finally{await act(async()=>root.unmount());el.remove();}
});
