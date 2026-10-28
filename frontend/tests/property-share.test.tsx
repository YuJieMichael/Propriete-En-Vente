// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ShareProperty} from '../src/property-share';

let root:Root;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();Reflect.deleteProperty(navigator,'share');Reflect.deleteProperty(navigator,'clipboard');});
const url='https://proprieteenvente.ca/fr/proprietes/100029/';

it('uses the device share sheet with the property title and link',async()=>{
  const share=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'share',{value:share,configurable:true});
  await act(async()=>root.render(<ShareProperty url={url} title="Maison à vendre" lang="fr"/>));
  await act(async()=>document.querySelector<HTMLButtonElement>('.share-property button')!.click());
  expect(share).toHaveBeenCalledWith({title:'Maison à vendre',url});
  expect(document.querySelector('[role=status]')!.textContent).toBe('');
});

it('copies the link when sharing is unavailable, and explains a failed copy',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'clipboard',{value:{writeText},configurable:true});
  await act(async()=>root.render(<ShareProperty url={url} title="Condo" lang="en"/>));
  await act(async()=>document.querySelector<HTMLButtonElement>('.share-property button')!.click());
  expect(writeText).toHaveBeenCalledWith(url);
  expect(document.querySelector('[role=status]')!.textContent).toBe('Link copied');
  writeText.mockRejectedValueOnce(new Error('denied'));
  await act(async()=>document.querySelector<HTMLButtonElement>('.share-property button')!.click());
  expect(document.querySelector('[role=status]')!.textContent).toBe('Copy the page address to share it.');
});

it('does nothing more when the visitor closes the share sheet',async()=>{
  Object.defineProperty(navigator,'share',{value:vi.fn().mockRejectedValue(new DOMException('cancel','AbortError')),configurable:true});
  const writeText=vi.fn();
  Object.defineProperty(navigator,'clipboard',{value:{writeText},configurable:true});
  await act(async()=>root.render(<ShareProperty url={url} title="Terrain" lang="zh"/>));
  await act(async()=>document.querySelector<HTMLButtonElement>('.share-property button')!.click());
  expect(writeText).not.toHaveBeenCalled();
});
