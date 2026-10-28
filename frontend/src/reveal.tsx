import {useEffect,useRef,type ComponentPropsWithoutRef} from 'react';

// One entrance per section per app visit; content is always visible without JS,
// IntersectionObserver, or the Web Animations API.
const revealed=new Set<string>();
export function Reveal({revealKey,children,...props}:ComponentPropsWithoutRef<'section'>&{revealKey:string}) {
  const element=useRef<HTMLElement>(null);
  useEffect(()=>{
    const target=element.current;
    const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!target||!target.animate||!window.IntersectionObserver||preference?.matches||revealed.has(revealKey))return;
    let animation:Animation|undefined;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      if(preference?.matches||revealed.has(revealKey))return;
      revealed.add(revealKey);
      animation=target.animate([{opacity:.45,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});
    },{threshold:.08});
    const stop=()=>{if(preference?.matches){animation?.cancel();observer.disconnect();}};
    observer.observe(target);
    preference?.addEventListener('change',stop);
    return()=>{observer.disconnect();animation?.cancel();preference?.removeEventListener('change',stop);};
  },[revealKey]);
  return <section {...props} ref={element}>{children}</section>;
}
