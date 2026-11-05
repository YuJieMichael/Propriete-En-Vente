// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {propertyModels} from '../src/lib/property-models';
import {PropertyModels} from '../src/property-models';
import {demoModels} from '../src/property-model-demo';
import {parseImportedProperty} from '../src/lib/imported-listings';
import imports from '../../data/centris-import-20260928.json';
const loader=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/model-viewer-loader',()=>({ensureModelViewer:loader}));
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});loader.mockReset().mockResolvedValue(undefined);HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1;});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.useRealTimers();});
it('accepts only bounded translated scenes and safe same-origin GLB files',()=>{
 const sample=demoModels[0];
 expect(propertyModels([sample,sample])).toHaveLength(1);
 for(const src of ['https://example.org/model.glb','//evil.test/model.glb','/models/../secret.glb','/models/%2e%2e/secret.glb','/models/demo/file.gltf','/models/demo/file.glb?redirect=x','javascript:alert(1)'])expect(propertyModels([{...sample,src}])).toEqual([]);
 expect(propertyModels([{...sample,area:'attic'}])).toEqual([]);
 expect(propertyModels([{...sample,label:{fr:'Extérieur'}}])).toEqual([]);
 expect(propertyModels([{...sample,illustrative:undefined}])[0].illustrative).toBe(true);
 expect(propertyModels([{...sample,illustrative:false}])[0].illustrative).toBe(false);
 expect(propertyModels(Array.from({length:20},(_,i)=>({...sample,src:`/models/demo/scene-${i}.glb`})))).toHaveLength(8);
});
it('preserves reviewed models while bad optional media cannot break a property',()=>{
 expect(parseImportedProperty({...imports[0].property,models:demoModels}).models).toEqual(demoModels);
 expect(parseImportedProperty({...imports[0].property,models:[{src:'https://evil.test/a.glb'}]}).models).toEqual([]);
});
it('keeps valid photo points while rejecting unsafe images, non-finite coordinates and malformed optional data',()=>{
 const scene=demoModels[0],point=scene.hotspots![0];
 const badPhotos=['https://example.org/private.jpg','//example.org/a.png','/models/../private.jpg','/models/demo/a.png?x=1','/models/demo/a.svg','javascript:alert(1)'];
 for(const photos of badPhotos.map(src=>[src]))expect(propertyModels([{...scene,hotspots:[{...point,photos}]}])[0].hotspots).toBeUndefined();
 for(const overrides of [{position:[NaN,0,0]},{position:[0,Infinity,0]},{position:[0,0]},{position:[0,0,10001]},{normal:[0,0,0]},{normal:[0,2,0]},{id:'bad id'},{label:{en:'Room'}},{photos:[]}]){
  expect(propertyModels([{...scene,hotspots:[{...point,...overrides},point]}])[0].hotspots).toEqual([point]);
 }
 expect(propertyModels([{...scene,hotspots:[point,point]}])[0].hotspots).toHaveLength(1);
 expect(propertyModels([{...scene,hotspots:Array.from({length:20},(_,i)=>({...point,id:`point-${i}`}))}])[0].hotspots).toHaveLength(12);
 expect(propertyModels([{...scene,hotspots:[{...point,illustrative:false}]}])[0].hotspots![0].illustrative).toBe(true);
 expect(propertyModels([{...scene,illustrative:false,hotspots:[{...point,illustrative:false,photos:['/centris/12345678/001.webp']}]}])[0].hotspots![0].illustrative).toBe(false);
});
it('opens the selected model location in the shared photo viewer and restores focus without replacing the model',async()=>{
 await act(async()=>root.render(<PropertyModels lang="en" models={demoModels}/>));
 expect(document.querySelector('.gallery-dialog')).toBeNull();
 await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
 const model=host.querySelector('model-viewer')!;
 await act(async()=>model.dispatchEvent(new Event('load')));
 const point=host.querySelector<HTMLButtonElement>('[slot=hotspot-entrance]')!;
 expect(point.getAttribute('data-position')).toBe('0m 1.6m 1.9m');expect(point.disabled).toBe(false);
 point.focus();await act(async()=>point.click());
 const dialog=document.querySelector<HTMLDialogElement>('.gallery-dialog')!;
 expect(dialog.open).toBe(true);expect(dialog.textContent).toContain('Entrance and terrace');
 expect(dialog.querySelector('.gallery-image img')?.getAttribute('src')).toBe('/models/demo/photos/exterior-v1.webp');
 expect(dialog.textContent).toContain('Illustrative image');expect(dialog.parentElement).toBe(host.querySelector('.property-model-stage'));
 await act(async()=>dialog.querySelector<HTMLButtonElement>('header button')!.click());
 expect(document.querySelector('.gallery-dialog')).toBeNull();expect(document.activeElement).toBe(point);expect(host.querySelector('model-viewer')).toBe(model);
 await act(async()=>host.querySelectorAll<HTMLButtonElement>('.property-model-scenes button')[1].click());
 await act(async()=>host.querySelector('model-viewer')!.dispatchEvent(new Event('load')));
 await act(async()=>host.querySelector<HTMLButtonElement>('.property-model-photos button')!.click());
 expect(document.querySelector('.gallery-image img')?.getAttribute('src')).toBe('/models/demo/photos/interior-v1.webp');
 await act(async()=>document.querySelector<HTMLDialogElement>('.gallery-dialog')!.dispatchEvent(new Event('cancel',{cancelable:true})));
 expect(document.querySelector('.gallery-dialog')).toBeNull();
});
it('keeps scenes without photo points usable without an empty photo list',async()=>{
 await act(async()=>root.render(<PropertyModels lang="fr" models={[{...demoModels[0],hotspots:undefined}]}/>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
 await act(async()=>host.querySelector('model-viewer')!.dispatchEvent(new Event('load')));
 expect(host.querySelector('.property-model-photos')).toBeNull();expect(host.querySelector('.property-model-controls')?.textContent).toContain('Recentrer');
});
it('hides unavailable models and does not load the engine or geometry before a click',async()=>{
 await act(async()=>root.render(<PropertyModels lang="fr"/>));expect(host.innerHTML).toBe('');
 await act(async()=>root.render(<PropertyModels lang="fr" models={demoModels}/>));
 expect(host.querySelectorAll('.property-model-scenes button')).toHaveLength(2);
 expect(host.querySelector('model-viewer')).toBeNull();expect(loader).not.toHaveBeenCalled();
 expect(host.textContent).toContain('ne représente pas une propriété réelle');
});
it('loads on request, switches interior and exterior, recovers failed scenes and returns focus on close',async()=>{
 let resolve!:()=>void;loader.mockImplementationOnce(()=>new Promise<void>(done=>{resolve=done;}));
 await act(async()=>root.render(<PropertyModels lang="en" models={demoModels}/>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
 expect(host.querySelector('[role=status]')?.textContent).toContain('Loading');expect(document.activeElement).toBe(host.querySelector('.property-models-heading button'));
 await act(async()=>resolve());expect(host.querySelector('model-viewer')?.getAttribute('src')).toBe(demoModels[0].src);
 await act(async()=>host.querySelector('model-viewer')!.dispatchEvent(new Event('load')));
 expect(host.querySelector('.property-model-controls')?.textContent).toContain('Reset view');
 await act(async()=>host.querySelectorAll<HTMLButtonElement>('.property-model-scenes button')[1].click());
 expect(host.querySelector('model-viewer')?.getAttribute('src')).toBe(demoModels[1].src);
 await act(async()=>host.querySelector('model-viewer')!.dispatchEvent(new Event('error')));
 expect(host.querySelector('[role=alert]')?.textContent).toContain('cannot be displayed');expect(host.querySelectorAll('.property-model-scenes button')).toHaveLength(2);
 await act(async()=>host.querySelector<HTMLButtonElement>('[role=alert] button')!.click());
 expect(host.querySelector('model-viewer')?.getAttribute('src')).toBe(demoModels[1].src);
 await act(async()=>host.querySelector('model-viewer')!.dispatchEvent(new Event('load')));
 await act(async()=>host.querySelector<HTMLButtonElement>('.property-models-heading button')!.click());
 expect(host.querySelector('model-viewer')).toBeNull();expect(document.activeElement).toBe(host.querySelector('.catalogue-cta'));
});
it('recovers an engine load error without hiding scene choices',async()=>{
 loader.mockRejectedValueOnce(Error('offline'));
 await act(async()=>root.render(<PropertyModels lang="zh" models={demoModels}/>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
 expect(host.querySelector('[role=alert]')?.textContent).toContain('暂时无法');
 await act(async()=>host.querySelector<HTMLButtonElement>('[role=alert] button')!.click());expect(loader).toHaveBeenCalledTimes(2);expect(host.querySelector('model-viewer')).not.toBeNull();
});
it('ends a stalled load with an actionable retry and a working close button',async()=>{
 vi.useFakeTimers();
 await act(async()=>root.render(<PropertyModels lang="en" models={demoModels}/>));
 await act(async()=>host.querySelector<HTMLButtonElement>('.catalogue-cta')!.click());
 await act(async()=>vi.advanceTimersByTime(30000));expect(host.querySelector('[role=alert] button')?.textContent).toBe('Try again');
 await act(async()=>host.querySelector<HTMLButtonElement>('.property-models-heading button')!.click());expect(host.querySelector('[role=alert]')).toBeNull();
});
it('ships self-contained original GLB demonstration scenes with explicit fictional attribution',()=>{
 for(const scene of demoModels){
  const file=readFileSync(new URL('../public'+scene.src,import.meta.url));
  expect(file.toString('ascii',0,4)).toBe('glTF');expect(file.readUInt32LE(4)).toBe(2);expect(file.readUInt32LE(8)).toBe(file.length);
  const json=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
  expect(json.asset.generator).toContain('fictional');expect(json.nodes.length).toBeGreaterThan(10);expect(json.buffers.every((buffer:any)=>!buffer.uri)).toBe(true);expect(scene.illustrative).toBe(true);
  for(const point of scene.hotspots||[])for(const src of point.photos){const photo=readFileSync(new URL('../public'+src,import.meta.url));expect(photo.toString('ascii',0,4)).toBe('RIFF');expect(photo.toString('ascii',8,12)).toBe('WEBP');expect(point.illustrative).toBe(true);}
 }
});
