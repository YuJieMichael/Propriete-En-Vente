import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {parseImportedProperty,isImportedPhotoPath} from '../src/lib/imported-listings';
const plan=JSON.parse(readFileSync(new URL('../../data/centris-sync-20261027.json',import.meta.url),'utf8'));
describe('Centris October catalogue reconciliation',()=>{
 it('has one record for every active source and disjoint withdrawals',()=>{
  const ids=[...plan.unchangedSourceIds,...plan.changes.map((r:any)=>r.property.source.id)];
  expect(ids.sort()).toEqual([...plan.activeSourceIds].sort());
  expect(new Set(ids).size).toBe(28);
  expect(plan.withdraw.every((r:any)=>!ids.includes(r.sourceId))).toBe(true);
 });
 it('preserves the existing public ID for the relisted Mance apartment',()=>{
  const row=plan.changes.find((r:any)=>r.replaceSourceId==='9964476');
  expect(row.id).toBe('dce62638-bf1c-561f-979a-9e3e99abb21f');
  expect(row.property.source.id).toBe('11809271');
  expect(row.property.transaction).toBe('rent');
  expect(row.property.price).toBe(1950);
  expect(row.property.rentPrice).toBe(1950);
 });
 it('validates translated records and every local photo before publication',()=>{
  for(const row of plan.changes){
   expect(()=>parseImportedProperty(row.property)).not.toThrow();
   expect(row.photo_paths.length).toBeGreaterThan(0);
   for(const photo of row.photo_paths){
    expect(isImportedPhotoPath(photo)).toBe(true);
    expect(existsSync(new URL('../public'+photo,import.meta.url))).toBe(true);
   }
  }
 });
});
