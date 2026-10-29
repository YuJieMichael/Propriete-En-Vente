// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {taxScaleForCity,welcomeTax} from '../src/lib/welcome-tax';
import {WelcomeTaxCard,WelcomeTaxPage} from '../src/welcome-tax';
import {languageHref,routeHash} from '../src/seo';
import type {Listing} from '../src/listings-data';

const listing=(extra:Partial<Listing>={}):Listing=>({id:'id-1',reference:'100001',type:'condo',district:'',city:'Montréal (Ville-Marie)',postal:'',aliases:'',price:700000,beds:2,baths:1,area:800,date:'2026-10-28',mode:'broker',parking:null,outdoor:null,image:'/x.webp',real:true,transaction:'sale',...extra});
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});

describe('transfer duty scales',()=>{
  it('matches the worked example published by the City of Montréal',()=>{
    expect(welcomeTax(700000,'montreal').total).toBe(9349);
  });
  it('applies the Québec City and provincial brackets',()=>{
    // 314.50 + 2521 + 2775 + 6250 + 7500
    expect(welcomeTax(1000000,'quebec').total).toBe(19360.5);
    expect(welcomeTax(1000000,'provincial').total).toBe(13110.5);
    expect(welcomeTax(50000,'montreal')).toEqual({lines:[{from:0,to:50000,rate:0.005,amount:250}],total:250});
    expect(welcomeTax(0,'montreal').total).toBe(0);
  });
  it('treats only the cities themselves as Montréal or Québec',()=>{
    expect(taxScaleForCity('Montréal (Ville-Marie)')).toBe('montreal');
    expect(taxScaleForCity('Québec (La Cité-Limoilou)')).toBe('quebec');
    expect(taxScaleForCity('Montréal-Est')).toBe('provincial');
    expect(taxScaleForCity('Brossard')).toBe('provincial');
  });
});

describe('welcome tax pages',()=>{
  it('maps the public path to its route and back in every language',()=>{
    expect(routeHash('/fr/taxe-de-bienvenue/','?prix=500000')).toBe('#taxe-de-bienvenue?prix=500000');
    expect(languageHref('zh','/fr/taxe-de-bienvenue/','?prix=500000')).toBe('/zh/taxe-de-bienvenue/?prix=500000');
  });
  it('estimates the duties on a sale listing and links to the calculator',async()=>{
    await act(async()=>root.render(<WelcomeTaxCard item={listing()} lang="fr"/>));
    expect(host.querySelector('.welcome-tax-total')?.textContent?.replace(/\s/g,'')).toBe('9349$');
    expect(host.querySelector('.welcome-tax-link')?.getAttribute('href')).toBe('/fr/taxe-de-bienvenue/?prix=700000&ville=montreal');
  });
  it('is not shown for rentals',async()=>{
    await act(async()=>root.render(<WelcomeTaxCard item={listing({transaction:'rent',price:2000})} lang="en"/>));
    expect(host.innerHTML).toBe('');
  });
  it('recalculates when the price or municipality changes',async()=>{
    await act(async()=>root.render(<WelcomeTaxPage lang="en" hash="#taxe-de-bienvenue?prix=700000&ville=montreal"/>));
    const result=()=>host.querySelector('.welcome-tax-result strong')?.textContent?.replace(/\s/g,'');
    expect(result()).toBe('$9,349.00');
    const input=host.querySelector('input[inputmode]') as HTMLInputElement;
    const setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
    await act(async()=>{setValue.call(input,'1,000,000');input.dispatchEvent(new Event('input',{bubbles:true}));});
    expect(input.value.replace(/\D/g,'')).toBe('1000000');
    await act(async()=>{(host.querySelectorAll('input[type=radio]')[1] as HTMLInputElement).click();});
    expect(result()).toBe('$19,360.50');
  });
});
