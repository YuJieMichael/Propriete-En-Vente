// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {languages,categories,categoryPath,catalogueHref,routeHash,languageHref,normalizePublicLocation,updateSeo,pageSeo,propertyHeading,propertySummary,propertyDescription,type SeoListing} from '../src/seo';
import {readFilters} from '../src/listings-data';

describe('public search routes',()=>{
  it('keeps campaign-only category URLs indexable with a clean canonical, while real filters remain noindex',()=>{
    const path='/fr/proprietes/hotels-motels/';
    updateSeo('fr',routeHash(path,'?utm_source=facebook&utm_medium=social&utm_campaign=hotel-20261028'));
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('index,follow');
    expect(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href).toBe(`https://proprieteenvente.ca${path}`);
    updateSeo('fr',routeHash(path,'?utm_source=facebook&q=Montréal'));
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
  });
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
  it('updates shared previews across languages and clears them on private or unavailable routes',()=>{
    const content=(selector:string)=>document.querySelector<HTMLMetaElement>(selector)?.content;
    for(const lang of languages){
      updateSeo(lang,'#propriete/legacy-uuid',{id:'legacy-uuid',reference:'100031',city:'Mont-Tremblant',title:'Motel',real:true});
      expect(content('meta[property="og:url"]')).toBe(`https://proprieteenvente.ca/${lang}/proprietes/100031/`);
      expect(content('meta[property="og:title"]')).toBe(document.title);
      expect(content('meta[name="twitter:title"]')).toBe(document.title);
      expect(content('meta[property="og:image"]')).toBe(`https://proprieteenvente.ca/social/og-${lang}.png`);
      expect(content('meta[name="twitter:image"]')).toBe(`https://proprieteenvente.ca/social/og-${lang}.png`);
      expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    }
    updateSeo('en','#projects');
    expect(document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')).toHaveLength(0);
    expect(content('meta[name="robots"]')).toBe('noindex,follow');
    updateSeo('en','#propriete/100031',{id:'100031',city:'Mont-Tremblant',real:true});
    updateSeo('en','#propriete/missing',undefined,true);
    expect(document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')).toHaveLength(0);
  });
});

describe('truthful property search content',()=>{
  const condo:SeoListing={id:'listing-uuid',reference:'100001',type:'condo',transaction:'sale',title:'2320, Rue Tupper, app. 1602',city:'Montréal',beds:2,baths:1,area:743,real:true};
  it('leads with localized property type and sale intent while retaining the actual address',()=>{
    expect(propertyHeading('en',condo)).toBe('Condo for sale — 2320, Rue Tupper, app. 1602, Montréal');
    expect(propertyHeading('fr',condo)).toBe('Condo à vendre — 2320, Rue Tupper, app. 1602, Montréal');
    expect(propertyHeading('zh',condo)).toBe('公寓出售 — 2320, Rue Tupper, app. 1602, Montréal');
    for(const lang of languages){
      const meta=pageSeo(lang,'property',condo);
      expect(meta.title.startsWith(propertyHeading(lang,condo))).toBe(true);
      expect(meta.title).toContain('100001');
      expect(meta.title.endsWith(' | Propriété En Vente')).toBe(true);
      expect(meta.description).toContain('2320, Rue Tupper');
    }
  });
  it('distinguishes rent and sale/rent without advertising a rental as a sale',()=>{
    for(const lang of languages){
      const rental={...condo,transaction:'rent'};
      const combined={...condo,transaction:'sale-rent'};
      const rentLabel={en:'for rent',fr:'à louer',zh:'出租'}[lang];
      const saleLabel={en:'for sale',fr:'à vendre',zh:'出售'}[lang];
      expect(pageSeo(lang,'property',rental).title).toContain(rentLabel);
      expect(pageSeo(lang,'property',rental).title).not.toContain(saleLabel);
      expect(pageSeo(lang,'property',combined).title).toContain({en:'for sale or rent',fr:'à vendre ou à louer',zh:'出售或出租'}[lang]);
    }
    expect(propertyHeading('fr',{...condo,transaction:undefined})).toContain('à vendre');
  });
  it('uses a neutral heading for unknown type/transaction and omits missing locations',()=>{
    const unknown:SeoListing={id:'100099',type:'not-a-known-type',transaction:'unknown'};
    expect(propertyHeading('en',unknown)).toBe('Property');
    expect(propertyHeading('fr',unknown)).toBe('Propriété');
    expect(propertyHeading('zh',unknown)).toBe('物业');
    const meta=pageSeo('en','property',unknown);
    expect(meta.title).toBe('Property · Ref. 100099 | Propriété En Vente');
    expect(meta.description).not.toMatch(/undefined|null|NaN/);
    expect(propertyHeading('en',{...unknown,title:'Montréal',city:'Montréal'})).toBe('Property — Montréal');
  });
  it('summarizes only supplied valid facts without guessing missing beds or area',()=>{
    expect(propertySummary('en',condo)).toBe('2 bedrooms · 1 bathroom · 743 sq ft');
    expect(propertySummary('fr',condo)).toBe('2 chambres · 1 salle de bain · 743 pi²');
    expect(propertySummary('zh',condo)).toBe('2间卧室 · 1间浴室 · 743平方英尺');
    const sparse={...condo,beds:null,baths:undefined,area:null,lotArea:0};
    expect(propertySummary('en',sparse)).toBe(propertyHeading('en',sparse));
    expect(propertyDescription('en',sparse)).not.toMatch(/bedroom|bathroom|sq ft/);
    expect(propertySummary('en',{...sparse,beds:0,area:NaN,lotArea:10000})).toBe('0 bedrooms · 10,000 sq ft lot');
    for(const type of ['business','daycare','hotel-motel','land','commercial','unknown']){
      const nonResidential={...sparse,type,beds:0,baths:0};
      expect(propertyDescription('en',nonResidential)).not.toMatch(/bedroom|bathroom/);
      expect(propertySummary('en',nonResidential)).toBe(propertyHeading('en',nonResidential));
    }
  });
  it('uses available localized source text and falls back to the actual source description',()=>{
    const item:SeoListing={id:'100088',type:'land',city:'Laval',transaction:'sale',description:'Texte original du terrain.',descriptionTranslations:{en:'Public lot description.',fr:'   '}};
    expect(propertyDescription('en',item)).toContain('Public lot description.');
    expect(propertyDescription('en',item)).not.toContain('Texte original');
    expect(propertyDescription('fr',item)).toContain('Texte original du terrain.');
    expect(propertyDescription('zh',item)).toContain('Texte original du terrain.');
  });
  it('retains unique references after shortening long shared descriptions and Unicode addresses',()=>{
    const shared={...condo,title:'🏡'.repeat(80),description:'A supplied description with a common introduction. '.repeat(20)};
    const first=pageSeo('en','property',{...shared,reference:'100001'});
    const second=pageSeo('en','property',{...shared,reference:'100002'});
    expect(first.description).not.toBe(second.description);
    expect(first.description.endsWith(' · Ref. 100001')).toBe(true);
    expect(second.description.endsWith(' · Ref. 100002')).toBe(true);
    expect(Array.from(first.description).length).toBeLessThanOrEqual(170);
    expect(first.description).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
  it('keeps new search copy consistent with public previews and existing crawl controls',()=>{
    const rental={...condo,transaction:'rent'};
    updateSeo('fr','#propriete/listing-uuid',rental);
    expect(document.title).toBe(pageSeo('fr','property',rental).title);
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:description"]')!.content).toBe(pageSeo('fr','property',rental).description);
    expect(document.querySelector<HTMLLinkElement>('link[rel=canonical]')!.href).toBe('https://proprieteenvente.ca/fr/proprietes/100001/');
    expect(document.querySelector('link[hreflang="x-default"]')).not.toBeNull();
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('index,follow');
    updateSeo('fr','#propriete/demo-01',{...rental,id:'demo-01',reference:undefined,real:false});
    expect(document.querySelector<HTMLMetaElement>('meta[name=robots]')!.content).toBe('noindex,follow');
    expect(document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]')).toHaveLength(0);
  });
});
