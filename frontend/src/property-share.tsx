import {useEffect,useRef,useState} from 'react';
import {Check,Share2} from 'lucide-react';
import type {Language} from './seller-copy';

const copy={
  fr:{share:'Partager',copied:'Lien copié',failed:'Copiez l’adresse de la page pour la partager.'},
  en:{share:'Share',copied:'Link copied',failed:'Copy the page address to share it.'},
  zh:{share:'分享',copied:'链接已复制',failed:'请复制页面地址进行分享。'},
} as const;

/** Opens the device share sheet when available; otherwise copies the property link. */
export function ShareProperty({url,title,lang}:{url:string;title:string;lang:Language}){
  const c=copy[lang];
  const [status,setStatus]=useState<'idle'|'copied'|'failed'>('idle');
  const timer=useRef<number|undefined>(undefined);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  function show(next:'copied'|'failed'){setStatus(next);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setStatus('idle'),2500);}
  async function share(){
    if(typeof navigator.share==='function'){
      try{await navigator.share({title,url});return;}
      catch(error){if((error as DOMException)?.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(url);show('copied');}
    catch{show('failed');}
  }
  return <span className="share-property">
    <button type="button" onClick={share}>{status==='copied'?<Check aria-hidden="true"/>:<Share2 aria-hidden="true"/>}{c.share}</button>
    <span role="status" aria-live="polite">{status==='copied'?c.copied:status==='failed'?c.failed:''}</span>
  </span>;
}
