// Public pages are one app: in-site links swap the page without a reload,
// and Back returns to the list where the visitor left it.
const publicRoute=/^\/(en|fr|zh)\/(?:proprietes\/(?:[^/]+\/)?)?$/;

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

/** Remembers the current scroll position, then shows the new address in place. */
export function openInSite(href:string){
  history.replaceState({...(history.state??{}),scrollY:window.scrollY},'');
  history.pushState(null,'',href);
  dispatchEvent(new PopStateEvent('popstate',{state:null}));
}

/** The scroll position saved for the history entry being returned to. */
export function savedScroll(event:Event):number|null {
  const value=(event as PopStateEvent).state?.scrollY;
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}
