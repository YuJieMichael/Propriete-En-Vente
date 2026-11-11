import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe,expect,it} from 'vitest';
import registry from '../src/generated-listing-models.json';
import {listingModels} from '../src/generated-listing-models';

const publicFile=(src:string)=>fileURLToPath(new URL(`../public${src}`,import.meta.url));

describe('generated listing models',()=>{
  it('attaches schematic models only when reference and source both match',()=>{
    const models=listingModels({real:true,reference:'100043',source:{id:'27686261'}});
    expect(models?.length).toBe(4);
    expect(models?.every(m=>m.illustrative&&m.schematic)).toBe(true);
    expect(listingModels({real:true,reference:'100043',source:{id:'99999999'}})).toBeUndefined();
    expect(listingModels({real:false,reference:'100043',source:{id:'27686261'}})).toBeUndefined();
    expect(listingModels({real:true,reference:'100099',source:{id:'27686261'}})).toBeUndefined();
  });
  it('prefers a model stored with the listing',()=>{
    const own=[{src:'/models/x/a.glb',area:'interior' as const,label:{fr:'a',en:'a',zh:'a'},illustrative:false}];
    expect(listingModels({real:true,reference:'100043',source:{id:'27686261'},models:own})).toBe(own);
  });
  it('only references files that exist and keeps every point',()=>{
    for(const [reference,entry] of Object.entries(registry)){
      const raw=entry.models;
      const models=listingModels({real:true,reference,source:{id:entry.sourceId}})!;
      expect(models.length).toBe(raw.length);
      for(const [i,model] of models.entries()){
        expect(existsSync(publicFile(model.src))).toBe(true);
        expect(model.hotspots?.length).toBe(raw[i].hotspots.length);
        for(const point of model.hotspots||[])for(const photo of point.photos)expect(existsSync(publicFile(photo))).toBe(true);
      }
    }
  });
});
