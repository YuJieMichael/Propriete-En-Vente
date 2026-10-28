// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {inSiteHref,openInSite,savedScroll} from '../src/lib/public-navigation';

function click(href:string,init:MouseEventInit={},attributes:Record<string,string>={}){
  document.body.innerHTML='';
  const anchor=document.createElement('a');anchor.href=href;
  for(const [name,value] of Object.entries(attributes))anchor.setAttribute(name,value);
  const inner=document.createElement('span');anchor.append(inner);document.body.append(anchor);
  const event=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,...init});
  Object.defineProperty(event,'target',{value:inner});
  return event;
}

describe('in-site navigation',()=>{
  afterEach(()=>{document.body.innerHTML='';window.history.replaceState(null,'','/fr/proprietes/');vi.unstubAllGlobals();});
  it('follows public pages without a reload and keeps their query and fragment',()=>{
    window.history.replaceState(null,'','/fr/proprietes/');
    expect(inSiteHref(click('/fr/proprietes/100029/?transaction=rent'))).toBe('/fr/proprietes/100029/?transaction=rent');
    expect(inSiteHref(click('/en/proprietes/garderies/'))).toBe('/en/proprietes/garderies/');
    expect(inSiteHref(click('/zh/#recherches'))).toBe('/zh/#recherches');
  });
  it('leaves new tabs, downloads, other sites, private paths and same-page fragments to the browser',()=>{
    window.history.replaceState(null,'','/fr/proprietes/100029/');
    expect(inSiteHref(click('/fr/proprietes/',{ctrlKey:true}))).toBeNull();
    expect(inSiteHref(click('/fr/proprietes/',{button:1}))).toBeNull();
    expect(inSiteHref(click('/fr/proprietes/',{},{target:'_blank'}))).toBeNull();
    expect(inSiteHref(click('/fr/proprietes/',{},{download:''}))).toBeNull();
    expect(inSiteHref(click('https://example.com/fr/proprietes/'))).toBeNull();
    expect(inSiteHref(click('/admin/'))).toBeNull();
    expect(inSiteHref(click('/fr/proprietes/100029/#acheter?listing=100029'))).toBeNull();
    const handled=click('/fr/proprietes/');handled.preventDefault();
    expect(inSiteHref(handled)).toBeNull();
  });
  it('saves the scroll position on the page being left and restores only saved positions',()=>{
    window.history.replaceState(null,'','/fr/proprietes/');
    vi.stubGlobal('scrollY',840);
    const events:PopStateEvent[]=[];const listen=(event:PopStateEvent)=>events.push(event);
    addEventListener('popstate',listen);
    openInSite('/fr/proprietes/100029/');
    removeEventListener('popstate',listen);
    expect(location.pathname).toBe('/fr/proprietes/100029/');
    expect(events).toHaveLength(1);expect(savedScroll(events[0])).toBeNull();
    expect(savedScroll(new PopStateEvent('popstate',{state:{scrollY:840}}))).toBe(840);
    expect(savedScroll(new PopStateEvent('popstate',{state:{scrollY:'840'}}))).toBeNull();
    expect(savedScroll(new Event('hashchange'))).toBeNull();
  });
});
