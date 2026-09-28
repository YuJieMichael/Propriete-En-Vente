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
it('preserves the source facts, translations and property-level coordinates',()=>{
 const byId=(id:string)=>parseImportedProperty(imports.find((r:any)=>r.property.source.id===id).property);
 for(const row of imports){const p=parseImportedProperty(row.property);for(const lang of ['fr','en','zh'] as const){expect(p.descriptionTranslations?.[lang]).toBeTruthy();expect(p.features?.every(f=>f.label[lang]&&f.value[lang])).toBe(true);}}
 const tupper=byId('19489343');
 expect(tupper.features?.find(f=>f.key==='Piscine')?.value.zh).toBe('室内泳池');
 expect(tupper.features?.find(f=>f.key==='Date d’emménagement')?.value.zh).toBe('依据现有租约');
 expect(byId('23484515').coordinates).toMatchObject({latitude:45.51891143,longitude:-73.71244573});
 expect(byId('19869401').postal).toBe('H3A 0A1');
 for(const id of ['27396478','15067975','28358241','15603395'])expect(byId(id).coordinates).toBeUndefined();
 expect(byId('25164738').beds).toBeNull();
 expect(byId('19078347').baths).toBe(4);
 expect(byId('19078347').features?.find(f=>f.key==='halfBath')?.value.en).toContain('1, in addition to 4');
});
it('rejects invalid coordinates and incomplete translated features',()=>{
 expect(()=>parseImportedProperty({...imports[0].property,coordinates:{source:'centris',latitude:Infinity,longitude:-73}})).toThrow();
 expect(()=>parseImportedProperty({...imports[0].property,coordinates:{source:'centris',latitude:45,longitude:181}})).toThrow();
 expect(()=>parseImportedProperty({...imports[0].property,features:[{key:'pool',label:{fr:'Piscine'},value:{fr:'Intérieure'}}]})).toThrow();
});
