import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, ArrowRight, Grid2X2, LoaderCircle, X} from 'lucide-react';
import type {Language} from './seller-copy';
import {listingFallback} from './listings-data';

const copy = {
  fr: {photos:'Photos',open:'Voir les photos',close:'Fermer les photos',previous:'Photo précédente',next:'Photo suivante',illustration:'Illustration — photo réelle non publiée'},
  en: {photos:'Photos',open:'View photos',close:'Close photos',previous:'Previous photo',next:'Next photo',illustration:'Illustration — property photo not published'},
  zh: {photos:'照片',open:'查看全部照片',close:'关闭相册',previous:'上一张照片',next:'下一张照片',illustration:'示意图 · 未公开实拍照片'},
};

function GalleryImage({src,alt,lang}:{src:string;alt:string;lang:Language}) {
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const photo=useRef<HTMLImageElement>(null);
  const text={fr:{loading:'Chargement de la photo…',failed:'Cette photo est indisponible. Essayez la suivante.'},en:{loading:'Loading photo…',failed:'This photo is unavailable. Try the next one.'},zh:{loading:'正在加载照片…',failed:'这张照片暂时无法显示，请尝试下一张。'}}[lang];
  useEffect(()=>{if(photo.current?.complete&&photo.current.naturalWidth>0)setReady(true);},[src]);
  return <div className="gallery-image" aria-busy={!ready&&!failed}>
    {!ready&&<p className="gallery-image-status" role="status">{!failed&&<LoaderCircle aria-hidden="true"/>}{failed?text.failed:text.loading}</p>}
    {!failed&&<img ref={photo} src={src} alt={alt} className={ready?'is-ready':''} decoding="async" onLoad={()=>setReady(true)} onError={()=>setFailed(true)}/>}
  </div>;
}

export function PropertyGallery({photos, title, lang, illustration=false}: {photos:string[];title:string;lang:Language;illustration?:boolean}) {
  const images = [...new Set(photos.filter(Boolean))];
  if (!images.length) images.push(listingFallback);
  const c=copy[lang];
  const [active,setActive]=useState<number|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const touch=useRef<{x:number;y:number}|null>(null);
  const opener=useRef<HTMLElement|null>(null);
  const thumbnails=useRef<HTMLDivElement>(null);
  const warmed=useRef(new Set<string>());
  const opened=active!==null;
  const move=(step:number)=>setActive(index=>index===null?null:(index+step+images.length)%images.length);
  useEffect(()=>{
    if (!opened) return;
    const modal=dialog.current;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    modal?.showModal();
    return ()=>{modal?.close();document.body.style.overflow=overflow;opener.current?.focus();};
  },[opened]);
  useEffect(()=>{
    if(opened) thumbnails.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
  },[active,opened]);
  const previous=active===null?null:images[(active-1+images.length)%images.length];
  const next=active===null?null:images[(active+1)%images.length];
  useEffect(()=>{
    const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
    if(connection?.saveData||connection?.effectiveType?.includes('2g'))return;
    for(const src of [previous,next]){
      if(!src||warmed.current.has(src))continue;
      warmed.current.add(src);
      const preload=new Image();preload.decoding='async';preload.src=src;
    }
  },[previous,next]);
  function open(index:number,button:HTMLElement){opener.current=button;setActive(index);}
  const photo=(src:string,index:number,eager=false)=><img src={src} alt={`${title} · ${c.photos} ${index+1}`} loading={eager?'eager':'lazy'} onError={event=>{if(!event.currentTarget.src.endsWith('/propriete-en-vente-hero.png'))event.currentTarget.src=listingFallback;}}/>;
  return <>
    <section className={`property-gallery gallery-count-${Math.min(images.length,5)}`} aria-label={c.photos}>
      {images.slice(0,5).map((src,index)=><button type="button" key={src} className={`gallery-tile gallery-tile-${index}`} aria-label={`${c.open} · ${index+1} / ${images.length}`} onClick={event=>open(index,event.currentTarget)}>
        {photo(src,index,index===0)}
        {index===0&&illustration&&<span className="gallery-disclosure">{c.illustration}</span>}
      </button>)}
      <button type="button" className="gallery-all" onClick={event=>open(0,event.currentTarget)}><Grid2X2 aria-hidden="true"/>{c.open}<span>{images.length}</span></button>
    </section>
    {opened&&createPortal(<dialog ref={dialog} className="gallery-dialog" aria-label={`${c.photos} · ${title}`} onCancel={event=>{event.preventDefault();setActive(null);}} onKeyDown={event=>{
      if(event.key==='ArrowRight'){event.preventDefault();move(1);}
      if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}
    }}>
      <header><div><span>{title}</span><strong aria-live="polite">{active+1} / {images.length}</strong></div><button type="button" autoFocus onClick={()=>setActive(null)} aria-label={c.close}><X/></button></header>
      <div className="gallery-stage" onTouchStart={event=>{const p=event.touches[0];touch.current={x:p.clientX,y:p.clientY};}} onTouchEnd={event=>{
        const p=event.changedTouches[0],start=touch.current;touch.current=null;
        if(start&&Math.abs(p.clientX-start.x)>50&&Math.abs(p.clientX-start.x)>Math.abs(p.clientY-start.y))move(p.clientX<start.x?1:-1);
      }}>
        {images.length>1&&<button type="button" className="gallery-prev" aria-label={c.previous} onClick={()=>move(-1)}><ArrowLeft/></button>}
        <GalleryImage key={images[active]} src={images[active]} alt={`${title} · ${c.photos} ${active+1}`} lang={lang}/>
        {images.length>1&&<button type="button" className="gallery-next" aria-label={c.next} onClick={()=>move(1)}><ArrowRight/></button>}
      </div>
      {illustration&&<p className="gallery-modal-disclosure">{c.illustration}</p>}
      <div className="gallery-thumbnails" ref={thumbnails}>{images.map((src,index)=><button key={src} type="button" aria-label={`${c.photos} ${index+1}`} aria-current={active===index?'true':undefined} onClick={()=>setActive(index)}>{photo(src,index)}</button>)}</div>
    </dialog>,document.body)}
  </>;
}
