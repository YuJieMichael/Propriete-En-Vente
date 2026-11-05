import {useEffect,useRef} from 'react';
import {ArrowLeft} from 'lucide-react';
import {PropertyModels} from './property-models';
import type {PropertyModel} from './lib/property-models';
import type {Language} from './seller-copy';
import {cataloguePath} from './seo';
export const demoModels:PropertyModel[]=[
  {src:'/models/demo/exterior.glb',area:'exterior',label:{fr:'Bâtiment et terrasse',en:'Building and terrace',zh:'建筑与露台'},illustrative:true,hotspots:[{id:'entrance',label:{fr:'Entrée et terrasse',en:'Entrance and terrace',zh:'入口与露台'},position:[0,1.6,1.9],normal:[0,0,1],photos:['/models/demo/photos/exterior-v1.webp'],illustrative:true}]},
  {src:'/models/demo/interior.glb',area:'interior',label:{fr:'Chambre et coin salon',en:'Bedroom and sitting area',zh:'客房与休息区'},illustrative:true,hotspots:[{id:'room',label:{fr:'Chambre et salon',en:'Bedroom and sitting area',zh:'客房与休息区'},position:[-.5,1.05,.1],normal:[0,1,0],photos:['/models/demo/photos/interior-v1.webp'],illustrative:true}]},
];
const copy={
 fr:{back:'Voir les propriétés',eyebrow:'EXPÉRIENCE 3D',title:'Visite 3D intérieur et extérieur',description:'Modèles fictifs et illustrations générées par IA, sans lien avec une annonce réelle.',note:'Sur une annonce, seuls les espaces disposant d’un modèle vérifié sont proposés.'},
 en:{back:'Browse properties',eyebrow:'3D VIEWING',title:'Interior and exterior in 3D',description:'Fictional models and AI-generated illustrations, unrelated to any actual property listing.',note:'Property listings offer only spaces with a verified model.'},
 zh:{back:'浏览房源',eyebrow:'3D看房体验',title:'室内室外，3D看房',description:'模型为虚构演示，图片由AI生成，不对应真实房源。',note:'真实房源只展示已有核实模型的空间。'},
};
export function PropertyModelDemo({lang}:{lang:Language}){
 const heading=useRef<HTMLHeadingElement>(null),c=copy[lang];
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[lang]);
 return <div className="property-model-demo"><a href={cataloguePath(lang)}><ArrowLeft aria-hidden="true"/>{c.back}</a><p className="eyebrow">{c.eyebrow}</p><h1 ref={heading} tabIndex={-1}>{c.title}</h1><p>{c.description}</p><PropertyModels models={demoModels} lang={lang}/><p>{c.note}</p></div>;
}
