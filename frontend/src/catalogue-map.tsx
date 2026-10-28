import {useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {Language} from './seller-copy';

export type MapPoint={id:string;latitude:number;longitude:number;price:string;title:string;href:string;image:string;approximate:boolean};

const copy={
  fr:{label:'Carte des propriétés',approximate:'Emplacement indicatif',open:'Voir la propriété'},
  en:{label:'Property map',approximate:'Approximate location',open:'View property'},
  zh:{label:'房源地图',approximate:'位置仅供参考',open:'查看房源'},
} as const;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Price pins on OpenStreetMap; popups link to the property page. Loaded only in map view. */
export default function CatalogueMap({points,lang}:{points:MapPoint[];lang:Language}){
  const element=useRef<HTMLDivElement>(null);
  const c=copy[lang];
  useEffect(()=>{
    if(!element.current)return;
    const map=L.map(element.current,{scrollWheelZoom:false,zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
    const markers=points.map(point=>L.marker([point.latitude,point.longitude],{
      icon:L.divIcon({className:'map-price-pin',html:`<span>${escape(point.price)}</span>`,iconSize:undefined}),
      title:point.title,keyboard:true,
    }).bindPopup(`<a class="map-popup" href="${escape(point.href)}"><img src="${escape(point.image)}" alt="" loading="lazy"><strong>${escape(point.price)}</strong><span>${escape(point.title)}</span>${point.approximate?`<small>${escape(c.approximate)}</small>`:''}<em>${escape(c.open)} →</em></a>`,{maxWidth:240,minWidth:200}).addTo(map));
    if(markers.length)map.fitBounds(L.latLngBounds(markers.map(marker=>marker.getLatLng())).pad(.15),{maxZoom:13});
    else map.setView([46.8,-71.8],6);
    // Wheel zoom only after the visitor engages with the map, so page scrolling is not captured.
    map.once('focus click',()=>map.scrollWheelZoom.enable());
    return ()=>{map.remove();};
  },[points,c]);
  return <div className="catalogue-map" ref={element} role="region" aria-label={c.label}/>;
}
