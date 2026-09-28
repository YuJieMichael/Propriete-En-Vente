import {expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {parseImportedProperty,isImportedPhotoPath} from '../src/lib/imported-listings';
import {parseListingInput} from '../../supabase/functions/_shared/listing-input';
const imports=JSON.parse(readFileSync(new URL('../../data/centris-import-20260928.json',import.meta.url),'utf8'));
it('validates every imported record, all 493 photo paths and their local files',()=>{
 expect(imports).toHaveLength(28);expect(new Set(imports.map((r:any)=>r.property.source.id)).size).toBe(28);
 expect(imports.reduce((n:number,r:any)=>n+r.photo_paths.length,0)).toBe(493);
 for(const row of imports){
  expect(()=>parseImportedProperty(row.property)).not.toThrow();
  for(const path of row.photo_paths){expect(isImportedPhotoPath(path)).toBe(true);expect(existsSync(new URL(`../public${path}`,import.meta.url))).toBe(true);}
 }
});
it('keeps rental prices, land area and undisclosed facts distinct',()=>{
 const byId=(id:string)=>parseImportedProperty(imports.find((r:any)=>r.property.source.id===id).property);
 expect(byId('11203229')).toMatchObject({transaction:'rent',price:2690,postal:'',area:null});
 expect(byId('28725722')).toMatchObject({transaction:'sale-rent',price:739000,rentPrice:1880});
 expect(byId('12076073')).toMatchObject({type:'land',area:null,lotArea:97117,taxExtra:true});
 expect(byId('27396478')).toMatchObject({district:'Adresse non publiée',area:null,source:{placeholder:true}});
});
it('does not accept arbitrary image URLs or relax public submission rules',()=>{
 expect(isImportedPhotoPath('https://example.org/photo.webp')).toBe(false);
 expect(isImportedPhotoPath('/centris/19489343/../../secret')).toBe(false);
 expect(()=>parseImportedProperty({...imports[0].property,source:{provider:'centris',id:'bad',url:'https://example.org'}})).toThrow();
 expect(()=>parseListingInput({requestId:'bad',property:imports[0].property})).toThrow();
});
