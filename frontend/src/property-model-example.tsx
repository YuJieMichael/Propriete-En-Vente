import {useEffect,useRef} from 'react';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';
import {PropertyModels} from './property-models';
import {motelExample,motelExampleModels} from './property-model-example-data';
import {propertyPath} from './seo';
import type {Language} from './seller-copy';

const copy={
  en:{back:'View the original listing',eyebrow:'REAL PHOTO EXAMPLE · 100021',title:'A motel, explored in 3D',description:'Exterior, guest room and bathroom: choose a space, then select a numbered point to see its listing photos.',limitation:'The models are schematics based on the available photos. Dimensions and room connections are unverified. Interior examples are shown separately; their locations in the building are unspecified.',credit:'Real listing photos · Reference 100021 · Published property gallery',source:'Original photo source'},
  fr:{back:'Voir l’annonce d’origine',eyebrow:'EXEMPLE AVEC PHOTOS RÉELLES · 100021',title:'Un motel à explorer en 3D',description:'Extérieur, chambre et salle de bain : choisissez un espace, puis un point numéroté pour voir ses photos.',limitation:'Les modèles sont schématiques, d’après les photos disponibles. Les dimensions et les liaisons entre pièces ne sont pas vérifiées. Les intérieurs sont présentés séparément, sans emplacement attribué dans le bâtiment.',credit:'Photos réelles de l’annonce · Référence 100021 · Galerie publiée',source:'Source des photos'},
  zh:{back:'查看原房源',eyebrow:'实拍房源案例 · 100021',title:'用一套汽车旅馆体验3D看房',description:'选择外观、客房或浴室，点击模型上的编号，查看对应的房源实拍。',limitation:'模型根据现有照片制作，尺寸和房间连接关系未核实。室内空间分别展示，不指定它们在建筑中的位置。',credit:'房源实拍 · 编号100021 · 已发布房源图库',source:'照片原始来源'},
};
export function PropertyModelExample({lang}:{lang:Language}){
 const c=copy[lang],heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[lang]);
 return <div className="property-model-case">
   <a className="model-case-back" href={propertyPath(lang,motelExample.reference)}><ArrowLeft aria-hidden="true"/>{c.back}</a>
   <header className="model-case-intro"><img src="/centris/24397299/001.webp" alt={`${motelExample.title}, ${motelExample.city}`} width="180" height="120"/><div><p className="eyebrow">{c.eyebrow}</p><h1 ref={heading} tabIndex={-1}>{c.title}</h1><p>{motelExample.title} · {motelExample.city}</p></div></header>
   <p className="model-case-description">{c.description}</p><p className="model-case-limitation">{c.limitation}</p>
   <PropertyModels models={motelExampleModels} lang={lang} photoCredit={c.credit}/>
   <p className="model-case-source">{c.credit} · <a href={motelExample.sourceUrl} target="_blank" rel="noreferrer">{c.source}<ArrowUpRight aria-hidden="true"/></a></p>
 </div>;
}
