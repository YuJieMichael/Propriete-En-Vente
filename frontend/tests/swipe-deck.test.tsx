// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import SwipeDeck,{type SwipeCard} from '../src/swipe-deck';
import {readLibrary,toggleSaved} from '../src/property-library';

const card=(n:number):SwipeCard=>({id:`id-${n}`,saveId:String(100000+n),href:`/fr/proprietes/${100000+n}/`,image:`/centris/${n}/001.webp`,type:'Condo',title:`Propriété ${n}`,place:'Montréal',price:'500 000 $',facts:'2 chambres'});
let root:Root,host:HTMLDivElement;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  // Reduced motion skips the 220 ms fly-out, so each decision lands at once.
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  localStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const press=(label:string)=>act(async()=>{(host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();});
const title=()=>host.querySelector('.swipe-card:not(.is-next) h3')?.textContent;

it('saves on right, skips on left, undoes and offers to compare the picks',async()=>{
  const onCompare=vi.fn();
  await act(async()=>root.render(<SwipeDeck cards={[card(1),card(2),card(3)]} lang="fr" onCompare={onCompare}/>));
  expect(title()).toBe('Propriété 1');
  expect(host.querySelector('.swipe-progress')?.textContent).toBe('1 sur 3');
  await press('Enregistrer');
  expect(readLibrary().saved).toEqual(['100001']);
  await press('Passer');
  expect(title()).toBe('Propriété 3');
  await press('Annuler');
  expect(title()).toBe('Propriété 2');
  await press('Enregistrer');
  await press('Passer');
  expect(host.querySelector('.swipe-done p')?.textContent).toBe('Vous avez enregistré 2 propriétés dans cette ronde.');
  await act(async()=>{(host.querySelector('.swipe-primary') as HTMLButtonElement).click();});
  expect(onCompare).toHaveBeenCalledWith(['id-1','id-2']);
});

it('keeps earlier favourites when a saved card is undone',async()=>{
  toggleSaved('100001');
  await act(async()=>root.render(<SwipeDeck cards={[card(1),card(2)]} lang="en" onCompare={()=>{}}/>));
  await press('Save');
  await press('Undo');
  expect(readLibrary().saved).toEqual(['100001']);
});

it('follows the arrow keys',async()=>{
  await act(async()=>root.render(<SwipeDeck cards={[card(1),card(2)]} lang="zh" onCompare={()=>{}}/>));
  const deck=host.querySelector('.swipe-deck') as HTMLElement;
  await act(async()=>{deck.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
  await act(async()=>{deck.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));});
  expect(readLibrary().saved).toEqual(['100001']);
  expect(host.querySelector('.swipe-done h3')?.textContent).toBe('已经看完了');
});
