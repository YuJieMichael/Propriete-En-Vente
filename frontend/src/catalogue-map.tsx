import {useEffect,useRef} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {Language} from './seller-copy';
import type {Anchor} from './lib/commute';

export type MapPoint={id:string;latitude:number;longitude:number;price:string;title:string;href:string;image:string;approximate:boolean};

const copy={
  fr:{label:'Carte des propriétés',approximate:'Emplacement indicatif',open:'Voir la propriété',anchor:'Votre point de départ'},
  en:{label:'Property map',approximate:'Approximate location',open:'View property',anchor:'Your starting point'},
  zh:{label:'房源地图',approximate:'位置仅供参考',open:'查看房源',anchor:'您的出发地点'},
} as const;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

type Props={points:MapPoint[];lang:Language;anchor?:Anchor|null;radiusKm?:number;picking?:boolean;onPick?:(anchor:Anchor)=>void};
/** Price pins on OpenStreetMap; popups link to the property page. Loaded only in map view. */
export default function CatalogueMap({points,lang,anchor=null,radiusKm=0,picking=false,onPick}:Props){
  const element=useRef<HTMLDivElement>(null);
  const map=useRef<L.Map|null>(null);
  const pins=useRef<L.LayerGroup|null>(null);
  const area=useRef<L.LayerGroup|null>(null);
  const fitted=useRef(false);
  const pick=useRef(onPick);pick.current=onPick;
  const picked=useRef(picking);picked.current=picking;
  const c=copy[lang];
  useEffect(()=>{
    if(!element.current)return;
    const instance=L.map(element.current,{scrollWheelZoom:false,zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(instance);
    instance.setView([46.8,-71.8],6);
    pins.current=L.layerGroup().addTo(instance);area.current=L.layerGroup().addTo(instance);
    // Wheel zoom only after the visitor engages with the map, so page scrolling is not captured.
    instance.once('focus click',()=>instance.scrollWheelZoom.enable());
    instance.on('click',event=>{if(picked.current)pick.current?.({latitude:event.latlng.lat,longitude:event.latlng.lng});});
    map.current=instance;
    return ()=>{instance.remove();map.current=null;fitted.current=false;};
  },[]);
  // Pins are redrawn in place, so filtering does not reset the visitor's view.
  useEffect(()=>{
    const instance=map.current,layer=pins.current;
    if(!instance||!layer)return;
    layer.clearLayers();
    const markers=points.map(point=>L.marker([point.latitude,point.longitude],{
      icon:L.divIcon({className:'map-price-pin',html:`<span>${escape(point.price)}</span>`,iconSize:undefined}),
      title:point.title,keyboard:true,
    }).bindPopup(`<a class="map-popup" href="${escape(point.href)}"><img src="${escape(point.image)}" alt="" loading="lazy"><strong>${escape(point.price)}</strong><span>${escape(point.title)}</span>${point.approximate?`<small>${escape(c.approximate)}</small>`:''}<em>${escape(c.open)} →</em></a>`,{maxWidth:240,minWidth:200}).addTo(layer));
    if(!fitted.current&&markers.length){instance.fitBounds(L.latLngBounds(markers.map(marker=>marker.getLatLng())).pad(.15),{maxZoom:13});fitted.current=true;}
  },[points,c]);
  useEffect(()=>{
    const instance=map.current,layer=area.current;
    if(!instance||!layer)return;
    layer.clearLayers();
    if(!anchor)return;
    const centre=L.latLng(anchor.latitude,anchor.longitude);
    L.circleMarker(centre,{radius:8,color:'#fff',weight:3,fillColor:'#c2410c',fillOpacity:1}).bindTooltip(c.anchor).addTo(layer);
    if(radiusKm>0){
      const circle=L.circle(centre,{radius:radiusKm*1000,color:'#1d6b5a',weight:2,fillColor:'#1d6b5a',fillOpacity:.08,interactive:false}).addTo(layer);
      instance.fitBounds(circle.getBounds().pad(.05));
    }
  },[anchor?.latitude,anchor?.longitude,radiusKm,c]);
  useEffect(()=>{element.current?.classList.toggle('is-picking',picking);},[picking]);
  return <div className="catalogue-map" ref={element} role="region" aria-label={c.label}/>;
}
