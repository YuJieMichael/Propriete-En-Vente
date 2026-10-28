import {useEffect,useState} from 'react';
import {Heart} from 'lucide-react';
import type {Language} from './seller-copy';

export type PropertyLibrary={saved:string[];recent:string[]};
const key='pev-property-library-v1';
const changeEvent='pev-property-library-change';
let memory:PropertyLibrary={saved:[],recent:[]};
let storageUnavailable=false;
function ids(value:unknown,max:number){return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<100))].slice(0,max):[];}
export function readLibrary():PropertyLibrary{
  if(storageUnavailable)return memory;
  try{const raw=localStorage.getItem(key);if(!raw)return {saved:[],recent:[]};const data=JSON.parse(raw);return {saved:ids(data?.saved,200),recent:ids(data?.recent,20)};}catch{return memory;}
}
function writeLibrary(value:PropertyLibrary){memory=value;try{localStorage.setItem(key,JSON.stringify(value));storageUnavailable=false;}catch{storageUnavailable=true;}window.dispatchEvent(new Event(changeEvent));}
export function rememberProperty(id:string){const current=readLibrary();if(current.recent[0]!==id)writeLibrary({...current,recent:[id,...current.recent.filter(value=>value!==id)].slice(0,20)});}
export function toggleSaved(id:string){const current=readLibrary();writeLibrary({...current,saved:current.saved.includes(id)?current.saved.filter(value=>value!==id):[id,...current.saved].slice(0,200)});}
export function clearRecent(){writeLibrary({...readLibrary(),recent:[]});}
export function usePropertyLibrary(){
  const [library,setLibrary]=useState<PropertyLibrary>(readLibrary);
  useEffect(()=>{const update=()=>setLibrary(readLibrary());window.addEventListener(changeEvent,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(changeEvent,update);window.removeEventListener('storage',update);};},[]);
  return library;
}
export function SaveProperty({id,lang,label=false}:{id:string;lang:Language;label?:boolean}){
  const library=usePropertyLibrary();const saved=library.saved.includes(id);
  const text={fr:{save:'Enregistrer',saved:'Enregistrée',remove:'Retirer des favoris'},en:{save:'Save property',saved:'Saved',remove:'Remove from saved properties'},zh:{save:'收藏房源',saved:'已收藏',remove:'取消收藏'}}[lang];
  return <button type="button" className={`save-property ${label?'with-label':''}`} aria-pressed={saved} aria-label={saved?text.remove:text.save} title={saved?text.remove:text.save} onClick={()=>toggleSaved(id)}><Heart aria-hidden="true" fill={saved?'currentColor':'none'}/>{label&&<span>{saved?text.saved:text.save}</span>}</button>;
}
