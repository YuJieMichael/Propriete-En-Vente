import {useEffect,useState} from 'react';
import type {Language} from './seller-copy';

export function entryScript(html:string,base:string){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const src=doc.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
  if(!src)return null;
  try{const url=new URL(src,base);return url.origin===new URL(base).origin&&/\/assets\/index-[\w-]+\.js$/.test(url.pathname)?url.href:null;}catch{return null;}
}

export function SiteUpdate({lang}:{lang:Language}){
  const [available,setAvailable]=useState(false);
  useEffect(()=>{
    if(!import.meta.env.PROD)return;
    const base=new URL(window.location.pathname,window.location.origin).href;
    const current=entryScript(document.documentElement.outerHTML,base);
    if(!current)return;
    let active=true,busy=false;
    const controller=new AbortController();
    const check=async()=>{
      if(busy||document.visibilityState==='hidden')return;
      busy=true;
      try{
        const response=await fetch(base,{cache:'no-store',signal:controller.signal});
        if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))return;
        const next=entryScript(await response.text(),base);
        if(active&&next&&next!==current)setAvailable(true);
      }catch{/* Offline visits keep their current page and all unsaved entries. */}
      finally{busy=false;}
    };
    const timer=window.setInterval(()=>void check(),90000);
    const visible=()=>{if(document.visibilityState==='visible')void check();};
    document.addEventListener('visibilitychange',visible);
    void check();
    return()=>{active=false;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[]);
  if(!available)return null;
  const t={fr:{text:'Une mise à jour du site est disponible. Enregistrez vos modifications avant de recharger.',action:'Afficher la nouvelle version'},en:{text:'A site update is available. Save your changes before reloading.',action:'Load the updated site'},zh:{text:'网站已有更新，请先保存正在填写的内容，再刷新查看。',action:'查看新版'}}[lang];
  return <div className="site-update-notice" role="status"><span>{t.text}</span><button type="button" onClick={()=>window.location.reload()}>{t.action}</button></div>;
}
