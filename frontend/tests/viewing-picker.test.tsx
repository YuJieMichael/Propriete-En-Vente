// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Dashboard} from '../src/dashboard';
import {ProjectProvider,useProject} from '../src/project';
import type {Language} from '../src/seller-copy';

vi.mock('../src/auth',()=>({useAuth:()=>({user:null})}));
let root:Root;
let project:ReturnType<typeof useProject>;
function Probe(){project=useProject();return null;}
const findButton=(scope:Element,label:string)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!;
const click=async(element:HTMLElement)=>act(async()=>element.click());
const form=()=>document.querySelector<HTMLFormElement>('.visit-form')!;
const dayButtons=()=>[...document.querySelectorAll<HTMLButtonElement>('.calendar-days button:not([disabled])')];
const slots=()=>[...document.querySelectorAll<HTMLButtonElement>('.appointment-times button')];
async function open(lang:Language='en'){
 await act(async()=>root.render(<ProjectProvider mode="demo"><Dashboard lang={lang}/><Probe/></ProjectProvider>));
 await click(findButton(document.body,lang==='fr'?'Ajouter':lang==='zh'?'添加安排':'Add'));
}
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('scrollTo',vi.fn());
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-28T16:00:00Z'));
 history.replaceState(null,'','/#demo/visits');
 document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
});
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();});

it.each([['en','Change date and time'],['fr','Modifier la date et l’heure'],['zh','修改日期和时间']] as const)('collapses the time grid after choosing a slot and keeps an accessible edit action in %s',async(lang,label)=>{
 await open(lang);
 await click(dayButtons()[0]);
 const slot=slots()[0];const time=slot.textContent!;
 await click(slot);
 expect(document.querySelector('.appointment-picker')).toBeNull();
 const summary=document.querySelector('.visit-time-summary')!;
 expect(summary).toBeTruthy();expect(summary.textContent).toContain(time);expect(summary.textContent).toContain('America/Toronto');
 const edit=findButton(summary,label);
 expect(edit.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(edit);
 expect(project.visits).toHaveLength(0);
 expect(form().querySelector<HTMLButtonElement>(':scope > button:last-child')!.disabled).toBe(false);
 await click(edit);
 expect(document.querySelector('.appointment-picker')).toBeTruthy();
 expect(document.querySelector('.calendar-days [aria-selected="true"]')).toBeTruthy();
 expect(document.querySelector('.appointment-times [aria-pressed="true"]')?.textContent).toBe(time);
});

it('requires a new time after changing the date, allows clearing, and only saves on explicit submission',async()=>{
 await open();
 await act(async()=>project.setSample(false));
 await click(dayButtons()[0]);await click(slots()[0]);
 await click(findButton(document.querySelector('.visit-time-summary')!,'Change date and time'));
 await click(dayButtons()[1]);
 expect(document.querySelector('.visit-time-summary')).toBeNull();
 expect(form().querySelector<HTMLButtonElement>(':scope > button:last-child')!.disabled).toBe(true);
 expect(document.querySelector('.appointment-times [aria-pressed="true"]')).toBeNull();
 await click(findButton(document.querySelector('.calendar-heading')!,'Clear'));
 expect(document.querySelector('.calendar-days [aria-selected="true"]')).toBeNull();
 expect(slots().every(b=>b.disabled)).toBe(true);
 await click(dayButtons()[1]);await click(slots()[1]);
 const input=form().querySelector<HTMLInputElement>('input[name=visitor]')!;
 input.value='Synthetic viewing';
 expect(project.visits).toHaveLength(0);
 await act(async()=>form().dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(project.visits).toEqual([{name:'Synthetic viewing',date:'2026-10-29',time:'10:30'}]);
 expect(document.querySelector('.visit-form')).toBeNull();
 expect(document.body.textContent).toContain('No invitation sent');
 await click(findButton(document.body,'Add'));
 expect(document.querySelector('.appointment-picker')).toBeTruthy();
 expect(document.querySelector('.visit-time-summary')).toBeNull();
});

it('keeps occupied slots disabled when reopening the picker',async()=>{
 await open();
 await act(async()=>{project.setSample(false);project.setVisits([{name:'Synthetic existing note',date:'2026-10-28',time:'09:00'}]);});
 await click(dayButtons()[0]);
 expect(slots()[0].disabled).toBe(true);
 await click(slots()[1]);
 await click(findButton(document.querySelector('.visit-time-summary')!,'Change date and time'));
 expect(slots()[0].disabled).toBe(true);expect(slots()[1].getAttribute('aria-pressed')).toBe('true');
 expect(project.visits).toHaveLength(1);
});
