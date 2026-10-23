// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {SmartSearch} from '../src/smart-search-panel';
import {listings} from '../src/listings-data';

let root:ReturnType<typeof createRoot>;
afterEach(async()=>{if(root)await act(async()=>root.unmount());document.body.innerHTML='';});
async function mount(element:React.ReactNode){Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);await act(async()=>root.render(element));}
it('requires a separate confirmation after parsing, with no automatic network call',async()=>{
  const onApply=vi.fn();
  await mount(<SmartSearch lang="en" items={listings} onApply={onApply}/>);
  await act(async()=>document.querySelector<HTMLButtonElement>('.smart-search-example')!.click());
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(onApply).not.toHaveBeenCalled();
  expect(document.querySelector('.smart-search-preview')?.textContent).toContain('Maximum budget');
  await act(async()=>document.querySelector<HTMLButtonElement>('.smart-search-confirm')!.click());
  expect(onApply).toHaveBeenCalledTimes(1);expect(onApply.mock.calls[0][0]).toMatchObject({type:'condo',max:'700000',beds:'2',parking:true});
});
it('previews a home-page sentence again once the real locations arrive, without applying filters',async()=>{
  const onApply=vi.fn();const initialText='Montréal condo under 700k';
  await mount(<SmartSearch lang="en" items={[]} initialText={initialText} onApply={onApply}/>);
  expect(document.querySelector('textarea')?.value).toBe(initialText);
  expect(document.querySelector('.smart-search-unhandled')?.textContent).toContain('montreal');
  await act(async()=>root.render(<SmartSearch lang="en" items={listings} initialText={initialText} onApply={onApply}/>));
  expect(document.querySelector('.smart-search-preview dl')?.textContent).toContain('Location');
  expect(onApply).not.toHaveBeenCalled();
});
it('fills the visible sentence and prepares a preview when a handoff arrives after the panel mounts',async()=>{
  const onApply=vi.fn();const initialText='Montréal condo under 700k';
  await mount(<SmartSearch lang="en" items={listings} onApply={onApply}/>);
  expect(document.querySelector('textarea')?.value).toBe('');
  expect(document.querySelector('.smart-search-preview')).toBeNull();
  await act(async()=>root.render(<SmartSearch lang="en" items={listings} initialText={initialText} onApply={onApply}/>));
  expect(document.querySelector('textarea')?.value).toBe(initialText);
  expect(document.querySelector('.smart-search-preview dl')?.textContent).toContain('Maximum budget');
  expect(document.querySelector<HTMLButtonElement>('.smart-search-confirm')?.disabled).toBe(false);
  expect(onApply).not.toHaveBeenCalled();
});
it('does not replace a sentence the user has started editing with a late handoff or catalogue refresh',async()=>{
  const onApply=vi.fn();
  await mount(<SmartSearch lang="en" items={listings} onApply={onApply}/>);
  await act(async()=>document.querySelector<HTMLButtonElement>('.smart-search-example')!.click());
  const chosenText=document.querySelector('textarea')!.value;
  await act(async()=>root.render(<SmartSearch lang="en" items={[...listings]} initialText="Laval house over 800k" onApply={onApply}/>));
  expect(document.querySelector('textarea')!.value).toBe(chosenText);
  expect(document.querySelector('.smart-search-preview')).toBeNull();
  expect(onApply).not.toHaveBeenCalled();
});
