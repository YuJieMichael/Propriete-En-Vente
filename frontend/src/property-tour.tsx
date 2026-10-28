import {useEffect,useRef,useState} from 'react';
import {ExternalLink,Rotate3D,X} from 'lucide-react';
import {virtualTour} from './lib/virtual-tour';
import type {Language} from './seller-copy';
import './property-tour.css';

const copy={
  fr:{title:'Visite virtuelle 360°',start:'Commencer la visite',close:'Fermer la visite',external:'Ouvrir sur le site du fournisseur',hint:'Explorez la propriété à votre rythme. Le service externe se charge uniquement lorsque vous démarrez la visite.',loading:'Ouverture de la visite…',fallback:'Si la visite ne s’affiche pas, ouvrez-la sur le site du fournisseur.'},
  en:{title:'360° virtual tour',start:'Start the tour',close:'Close the tour',external:'Open on the provider’s website',hint:'Explore the property at your own pace. The external service loads only when you start the tour.',loading:'Opening the tour…',fallback:'If the tour does not appear, open it on the provider’s website.'},
  zh:{title:'360° 实景看房',start:'开始看房',close:'关闭看房',external:'在服务商网站打开',hint:'按自己的节奏探索房源，点击开始后才会加载外部看房服务。',loading:'正在打开看房…',fallback:'如无法显示，请在服务商网站打开。'},
};
export function PropertyTour({url,lang}:{url?:string;lang:Language}) {
  const tour=virtualTour(url),c=copy[lang];
  const [started,setStarted]=useState(false),[loaded,setLoaded]=useState(false);
  const start=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{setStarted(false);setLoaded(false);},[url]);
  useEffect(()=>{if(started)close.current?.focus({preventScroll:true});},[started]);
  if(!tour)return null;
  return <section className="property-tour" aria-label={c.title}>
    <div className="property-tour-heading"><div><span className="eyebrow">{tour.provider}</span><h2><Rotate3D aria-hidden="true"/>{c.title}</h2></div>
      {started&&<button ref={close} type="button" onClick={()=>{setStarted(false);setLoaded(false);requestAnimationFrame(()=>start.current?.focus({preventScroll:true}));}}><X aria-hidden="true"/>{c.close}</button>}</div>
    {started?<><div className="property-tour-frame">{!loaded&&<p role="status">{c.loading}</p>}<iframe src={tour.url} title={c.title} onLoad={()=>setLoaded(true)} allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" allowFullScreen referrerPolicy="no-referrer"/></div><p>{c.fallback}</p></>:<><p>{c.hint}</p><button className="catalogue-cta" ref={start} type="button" onClick={()=>setStarted(true)}><Rotate3D aria-hidden="true"/>{c.start}</button></>}
    <a href={tour.url} target="_blank" rel="noopener noreferrer">{c.external}<ExternalLink aria-hidden="true"/></a>
  </section>;
}
