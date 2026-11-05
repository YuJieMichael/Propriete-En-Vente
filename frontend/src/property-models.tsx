import {createElement,useCallback,useEffect,useRef,useState} from 'react';
import type {ModelViewerElement} from '@google/model-viewer';
import {ArrowUpRight,Building2,Camera,House,Maximize,Rotate3D,RotateCcw,X} from 'lucide-react';
import {propertyModels,type ModelHotspot} from './lib/property-models';
import {ensureModelViewer} from './lib/model-viewer-loader';
import {PhotoViewer} from './property-gallery';
import type {Language} from './seller-copy';
import './property-models.css';

const copy={
  fr:{title:'Explorez en 3D',interior:'Intérieur',exterior:'Extérieur',scenes:'Choisir un espace',start:'Ouvrir le modèle 3D',close:'Fermer le modèle',loading:'Chargement du modèle…',error:'Ce modèle ne peut pas être affiché pour le moment.',retry:'Réessayer',hint:'Choisissez un espace, puis ouvrez son modèle.',controls:'Faites glisser pour tourner, pincez ou utilisez la molette pour zoomer.',reset:'Recentrer',expand:'Plein écran',expandError:'Le plein écran est indisponible. Vous pouvez continuer ici.',illustration:'Modèle illustratif — ne représente pas une propriété réelle.'},
  en:{title:'Explore in 3D',interior:'Interior',exterior:'Exterior',scenes:'Choose a space',start:'Open the 3D model',close:'Close the model',loading:'Loading the model…',error:'This model cannot be displayed right now.',retry:'Try again',hint:'Choose a space, then open its model.',controls:'Drag to rotate. Pinch or use the scroll wheel to zoom.',reset:'Reset view',expand:'Full screen',expandError:'Full screen is unavailable. You can keep exploring here.',illustration:'Illustrative model — does not depict a real property.'},
  zh:{title:'探索3D空间',interior:'室内',exterior:'室外',scenes:'选择空间',start:'打开3D模型',close:'关闭模型',loading:'正在加载模型…',error:'暂时无法显示这个模型。',retry:'重试',hint:'选择空间后，点击打开模型。',controls:'拖动旋转，双指或滚轮缩放。',reset:'恢复视角',expand:'全屏',expandError:'暂时无法进入全屏，可继续在这里浏览。',illustration:'示意模型，不代表真实房源。'},
};
const defaultOrbit='30deg 65deg 85%';
const exitFullscreenCopy={fr:'Quitter le plein écran',en:'Exit full screen',zh:'退出全屏'};
const schematicCopy={fr:'Modèle schématique d’après photos. Dimensions, positions des pièces et liaisons non vérifiées.',en:'Photo-based schematic. Dimensions, room locations and connections are unverified.',zh:'根据照片制作的示意模型。尺寸、房间位置和连接关系未核实。'};
const photoCopy={
  fr:{locations:'Photos de cet espace',open:'Voir les photos',hint:'Cliquez sur un point numéroté pour voir ses photos.',illustration:'Image illustrative — ne représente pas une propriété réelle.'},
  en:{locations:'Photos in this space',open:'View photos',hint:'Select a numbered point to see its photos.',illustration:'Illustrative image — does not depict a real property.'},
  zh:{locations:'空间照片',open:'查看照片',hint:'点击模型上的编号，查看对应位置的图片。',illustration:'示意图片，不代表真实房源。'},
};

export function PropertyModels({models,lang,photoCredit}:{models?:unknown;lang:Language;photoCredit?:string}){
  const scenes=propertyModels(models),c=copy[lang];
  const [selected,setSelected]=useState(0),[started,setStarted]=useState(false),[runtime,setRuntime]=useState(false);
  const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0),[expandError,setExpandError]=useState(false);
  const [photo,setPhoto]=useState<{point:ModelHotspot;opener:HTMLButtonElement}|null>(null);
  const start=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null),stage=useRef<HTMLDivElement>(null),viewer=useRef<ModelViewerElement|null>(null);
  const previouslyStarted=useRef(false);
  const scene=scenes[selected]||scenes[0],signature=scenes.map(s=>s.src).join('|');
  useEffect(()=>{setSelected(0);setStarted(false);setRuntime(false);setExpandError(false);setPhoto(null);},[signature]);
  useEffect(()=>{
    if(!started)return;
    let active=true;setPhase('loading');
    ensureModelViewer().then(()=>{if(active)setRuntime(true);}).catch(()=>{if(active)setPhase('error');});
    return()=>{active=false;};
  },[started,attempt]);
  useEffect(()=>{if(started)close.current?.focus({preventScroll:true});else if(previouslyStarted.current)start.current?.focus({preventScroll:true});previouslyStarted.current=started;},[started]);
  useEffect(()=>{
    if(!started||phase!=='loading')return;
    const timeout=window.setTimeout(()=>setPhase('error'),30000);
    return()=>clearTimeout(timeout);
  },[started,phase,scene?.src,attempt]);
  const attach=useCallback((node:ModelViewerElement|null)=>{
    viewer.current=node;if(!node)return;
    const loaded=()=>setPhase('ready'),failed=()=>setPhase('error');
    node.addEventListener('load',loaded);node.addEventListener('error',failed);
    return()=>{node.removeEventListener('load',loaded);node.removeEventListener('error',failed);if(viewer.current===node)viewer.current=null;};
  },[]);
  if(!scene)return null;
  function choose(index:number){if(index===selected)return;setSelected(index);setPhase('loading');setExpandError(false);setPhoto(null);}
  function reset(){if(!viewer.current)return;viewer.current.cameraOrbit=defaultOrbit;viewer.current.cameraTarget='auto auto auto';viewer.current.jumpCameraToGoal();}
  return <section id="property-models" className="property-models" aria-label={c.title} tabIndex={-1}>
    <header className="property-models-heading"><div><span className="eyebrow">3D</span><h2><Rotate3D aria-hidden="true"/>{c.title}</h2></div>{started&&<button ref={close} type="button" onClick={()=>{setStarted(false);setRuntime(false);setPhase('loading');}}><X aria-hidden="true"/>{c.close}</button>}</header>
    <div className="property-model-scenes" role="group" aria-label={c.scenes}>{scenes.map((item,index)=><button key={item.src} type="button" aria-pressed={index===selected} onClick={()=>choose(index)}>{item.area==='exterior'?<Building2 aria-hidden="true"/>:<House aria-hidden="true"/>}<span><small>{item.area==='exterior'?c.exterior:c.interior}</small>{item.label[lang]}</span><ArrowUpRight aria-hidden="true"/></button>)}</div>
    <div className="property-model-stage" ref={stage} aria-busy={started&&phase==='loading'}>
      {!started?<div className="property-model-prompt"><Rotate3D aria-hidden="true"/><p>{c.hint}</p><button type="button" className="catalogue-cta" ref={start} onClick={()=>{setStarted(true);setPhase('loading');}}>{c.start}<ArrowUpRight aria-hidden="true"/></button></div>:<>
        {runtime&&phase!=='error'&&createElement('model-viewer',{key:scene.src+'-'+attempt,ref:attach,src:scene.src,alt:`${c.title} · ${scene.label[lang]}`,'camera-controls':true,'touch-action':'pan-y','interaction-prompt':'none','camera-orbit':defaultOrbit,loading:'eager','shadow-intensity':'0.4',tabIndex:0},
          scene.hotspots?.map((point,index)=><button key={point.id} className="property-model-hotspot" type="button" slot={`hotspot-${point.id}`} data-position={point.position.map(n=>`${n}m`).join(' ')} data-normal={point.normal.join(' ')} data-visibility-attribute="visible" disabled={phase!=='ready'} aria-label={`${photoCopy[lang].open} · ${point.label[lang]}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setPhoto({point,opener:event.currentTarget});}}><span className="property-model-point-number">{index+1}</span><span className="property-model-point-label"><Camera aria-hidden="true"/>{point.label[lang]}</span></button>)
        )}
        {phase==='loading'&&<div className="property-model-feedback" role="status"><span className="property-model-spinner" aria-hidden="true"/>{c.loading}</div>}
        {phase==='error'&&<div className="property-model-feedback" role="alert"><Rotate3D aria-hidden="true"/><p>{c.error}</p><button className="catalogue-cta" type="button" onClick={()=>{setPhase('loading');setRuntime(false);setAttempt(a=>a+1);}}>{c.retry}</button></div>}
      </>}
      {scene.illustrative&&<p className="property-model-notice">{scene.schematic?schematicCopy[lang]:c.illustration}</p>}
      <button className="property-model-exit-fullscreen" type="button" onClick={()=>{void document.exitFullscreen?.().catch(()=>{});}}><X aria-hidden="true"/>{exitFullscreenCopy[lang]}</button>
    </div>
    {started&&phase==='ready'&&!!scene.hotspots?.length&&<div className="property-model-photos"><p>{photoCopy[lang].hint}</p><div role="group" aria-label={photoCopy[lang].locations}>{scene.hotspots.map((point,index)=><button type="button" key={point.id} onClick={event=>setPhoto({point,opener:event.currentTarget})}><span className="property-model-point-number">{index+1}</span><Camera aria-hidden="true"/><span>{point.label[lang]}</span><ArrowUpRight aria-hidden="true"/></button>)}</div></div>}
    <div className="property-model-controls"><p>{c.controls}</p>{started&&phase==='ready'&&<div><button type="button" onClick={reset}><RotateCcw aria-hidden="true"/>{c.reset}</button><button type="button" onClick={()=>{setExpandError(false);const request=stage.current?.requestFullscreen?.();if(!request){setExpandError(true);return;}void request.catch(()=>setExpandError(true));}}><Maximize aria-hidden="true"/>{c.expand}</button></div>}</div>
    {expandError&&<p role="status">{c.expandError}</p>}
    {photo&&<PhotoViewer images={photo.point.photos} start={0} title={scene.label[lang]===photo.point.label[lang]?scene.label[lang]:`${scene.label[lang]} · ${photo.point.label[lang]}`} lang={lang} illustration={photo.point.illustrative} illustrationLabel={photoCopy[lang].illustration} photoCredit={photoCredit} portalTarget={stage.current} opener={photo.opener} onClose={()=>setPhoto(null)}/>}
  </section>;
}
