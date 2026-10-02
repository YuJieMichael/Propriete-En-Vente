// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {languages,categories,categoryPath,catalogueHref,routeHash,languageHref,normalizePublicLocation,updateSeo} from '../src/seo';
import {readFilters} from '../src/listings-data';

describe('public search routes',()=>{
  it('round trips every language/category with subsidy filters',()=>{
    for(const lang of languages)for(const type of categories){
      const url=new URL(catalogueHref(lang,`?type=${type}&q=Québec${type==='daycare'?'&daycareSubsidy=subsidized':''}`),'https://proprieteenvente.ca');
      expect(url.pathname).toBe(categoryPath(lang,type));
      const filters=readFilters(routeHash(url.pathname,url.search));
      expect(filters.type).toBe(type);expect(filters.q).toBe('Québec');
      if(type==='daycare')expect(filters.daycareSubsidy).toBe('subsidized');
      expect(languageHref('zh',url.pathname,url.search)).toBe(url.pathname.replace(`/${lang}/`,'/zh/')+url.search);
    }
  });
  it('retains old shared links and private forms without mixing catalogue state',()=>{
    history.replaceState(null,'','/fr/#proprietes?type=hotel-motel');
    expect(normalizePublicLocation()).toBe('#proprietes?type=hotel-motel');
    expect(location.pathname).toBe('/fr/proprietes/hotels-motels/');
    expect(routeHash(location.pathname,'','#acheter?listing=100031')).toBe('#acheter?listing=100031');
    expect(languageHref('en','/fr/proprietes/100031/')).toBe('/en/proprietes/100031/');
  });
  it('canonicalizes filters and legacy detail ids, and excludes private or missing pages',()=>{
    updateSeo('fr','#proprietes?type=daycare&daycareSubsidy=subsidized');
    expect(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href).toBe('https://proprieteenvente.ca/fr/proprietes/garderies/');
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
    updateSeo('en','#propriete/legacy-uuid',{id:'legacy-uuid',reference:'100031',city:'Mont-Tremblant',title:'Motel',real:true});
    expect(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href).toBe('https://proprieteenvente.ca/en/proprietes/100031/');
    expect(document.querySelectorAll('link[hreflang]')).toHaveLength(4);
    updateSeo('en','#propriete/missing',undefined,true);
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
    updateSeo('fr','#admin');expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
  });
});
