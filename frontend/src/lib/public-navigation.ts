import {flushSync} from 'react-dom';

// Public pages are one app: in-site links swap the page without a reload,
// and Back returns to the list where the visitor left it.
const publicRoute=/^\/(en|fr|zh)\/(?:proprietes\/(?:[^/]+\/)?|taxe-de-bienvenue\/)?$/;

/** The in-site address a click should open without reloading, or null to let the browser handle it. */
export function inSiteHref(event:MouseEvent):string|null {
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return null;
  const anchor=(event.target as Element|null)?.closest?.('a[href]') as HTMLAnchorElement|null;
  if(!anchor||(anchor.target&&anchor.target!=='_self')||anchor.hasAttribute('download'))return null;
  const url=new URL(anchor.href,location.href);
  if(url.origin!==location.origin||!publicRoute.test(url.pathname))return null;
  // A fragment on the current page is already handled without a reload.
  if(url.pathname===location.pathname&&url.search===location.search&&url.hash)return null;
  return url.pathname+url.search+url.hash;
}

type ViewTransition={ready?:Promise<void>;finished?:Promise<void>;updateCallbackDone?:Promise<void>};
type ViewTransitionDocument=Document&{startViewTransition?:(update:()=>void)=>ViewTransition|undefined};

/**
 * Remembers the current scroll position, then shows the new address in place.
 * Where the browser supports view transitions, the page cross-fades and a
 * clicked listing photo grows into the property page's main photo.
 */
export function openInSite(href:string,photo?:HTMLElement|null){
  history.replaceState({...(history.state??{}),scrollY:window.scrollY},'');
  const show=()=>{
    history.pushState(null,'',href);
    // Render synchronously so the transition captures the new page.
    flushSync(()=>dispatchEvent(new PopStateEvent('popstate',{state:null})));
  };
  const doc=document as ViewTransitionDocument;
  if(typeof doc.startViewTransition!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches){show();return;}
  if(photo)photo.style.viewTransitionName='property-photo';
  const transition=doc.startViewTransition(()=>{if(photo)photo.style.viewTransitionName='';show();});
  // A skipped animation (hidden tab, quick second click) still shows the page; it is not an error.
  for(const done of [transition?.ready,transition?.finished,transition?.updateCallbackDone])done?.catch(()=>{});
}

/** The scroll position saved for the history entry being returned to. */
export function savedScroll(event:Event):number|null {
  const value=(event as PopStateEvent).state?.scrollY;
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}
