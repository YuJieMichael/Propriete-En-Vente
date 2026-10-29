// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {catalogueHref,cityPages,cityPath,citySlug,languageHref,routeHash,structuredData,structuredDataTags,updateSeo,type StructuredListing} from '../src/seo';

describe('city pages',()=>{
  it('builds stable addresses from listing cities, without districts or accents',()=>{
    expect(citySlug('Montréal (Ville-Marie)')).toBe('montreal');
    expect(citySlug('Saint-Jean-sur-Richelieu')).toBe('saint-jean-sur-richelieu');
    expect(cityPath('fr','brossard')).toBe('/fr/proprietes/ville/brossard/');
  });
  it('only creates pages for cities with at least three listings',()=>{
    const pages=cityPages([{city:'Brossard',type:'house'},{city:'Brossard',type:'land'},{city:'Brossard',type:'house'},{city:'Laval',type:'condo'},{city:'Montréal (LaSalle)',type:'house'},{city:'Montréal (Ville-Marie)',type:'condo'},{city:'Montréal',type:'plex'},{city:'Montréal (Verdun)',type:'condo'}]);
    expect(pages.map(page=>[page.slug,page.name,page.count])).toEqual([['montreal','Montréal',4],['brossard','Brossard',3]]);
    expect(pages[1].types).toEqual(['house','land']);
  });
  it('round-trips city addresses and keeps the city through other filters and language switches',()=>{
    expect(routeHash('/fr/proprietes/ville/brossard/')).toBe('#proprietes?ville=brossard');
    expect(catalogueHref('fr','?ville=brossard')).toBe('/fr/proprietes/ville/brossard/');
    expect(catalogueHref('en','?ville=brossard&type=land')).toBe('/en/proprietes/ville/brossard/?type=land');
    expect(catalogueHref('fr','?ville=../admin')).toBe('/fr/proprietes/');
    expect(languageHref('zh','/fr/proprietes/ville/brossard/')).toBe('/zh/proprietes/ville/brossard/');
    expect(routeHash('/fr/proprietes/100029/')).toBe('#propriete/100029');
  });
  it('indexes a city page under its own address, but not with extra filters',()=>{
    const city={slug:'brossard',name:'Brossard',count:4,types:['house','land']};
    updateSeo('fr','#proprietes?ville=brossard',undefined,false,city);
    expect(document.title).toBe('Propriétés à vendre et à louer à Brossard | Propriété En Vente');
    expect(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href).toBe('https://proprieteenvente.ca/fr/proprietes/ville/brossard/');
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('index,follow');
    expect(document.querySelector<HTMLLinkElement>('link[hreflang="en"]')!.href).toBe('https://proprieteenvente.ca/en/proprietes/ville/brossard/');
    updateSeo('fr','#proprietes?ville=brossard&type=land',undefined,false,city);
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
  });
});

describe('structured data',()=>{
  const item:StructuredListing={id:'uuid',reference:'100029',type:'house',transaction:'sale',title:'1898, Rue du Bois-des-Caryers',city:'Montréal (LaSalle)',beds:5,baths:4,area:2146,price:1059000,image:'/centris/12345678/001.webp',publishedAt:'2026-09-28T12:00:00Z',real:true};
  it('describes a property with published facts, breadcrumbs and no street address',()=>{
    const [crumbs,listing]=structuredData('fr',{kind:'property',item}) as Record<string,any>[];
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs.itemListElement.map((entry:{name:string})=>entry.name)).toEqual(['Accueil','Propriétés à vendre et à louer au Québec','Maison à vendre — 1898, Rue du Bois-des-Caryers, Montréal (LaSalle)']);
    expect(listing).toMatchObject({'@type':'RealEstateListing',url:'https://proprieteenvente.ca/fr/proprietes/100029/',datePosted:'2026-09-28',image:['https://proprieteenvente.ca/centris/12345678/001.webp'],offers:{price:1059000,priceCurrency:'CAD'}});
    expect(listing.contentLocation.address).toEqual({'@type':'PostalAddress',addressLocality:'Montréal',addressRegion:'QC',addressCountry:'CA'});
    expect(JSON.stringify(listing)).not.toContain('streetAddress');
  });
  it('omits unknown prices and images, and marks rentals as leases',()=>{
    const [,unpriced]=structuredData('en',{kind:'property',item:{...item,price:null,image:undefined}}) as Record<string,unknown>[];
    expect(unpriced.offers).toBeUndefined();expect(unpriced.image).toBeUndefined();
    const [,rental]=structuredData('en',{kind:'property',item:{...item,transaction:'rent',price:null,rentPrice:2400}}) as Record<string,any>[];
    expect(rental.offers).toMatchObject({price:2400,businessFunction:'http://purl.org/goodrelations/v1#LeaseOut'});
  });
  it('escapes markup so listing text cannot close the script tag',()=>{
    const tags=structuredDataTags([{name:'</script><script>alert(1)</script>'}],'/fr/');
    expect(tags).not.toContain('</script><script>');
    expect(JSON.parse(tags.replace(/^<script[^>]*>|<\/script>$/g,'')).name).toBe('</script><script>alert(1)</script>');
  });
  it('removes structured data left from another page after in-site navigation',()=>{
    document.head.insertAdjacentHTML('beforeend','<script type="application/ld+json" data-path="/fr/proprietes/100029/">{}</script>');
    window.history.replaceState(null,'','/fr/proprietes/');
    updateSeo('fr','#proprietes');
    expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
