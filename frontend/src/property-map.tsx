import {useEffect,useRef,useState} from 'react';
import type {Language} from './seller-copy';
import 'leaflet/dist/leaflet.css';

export function PropertyMap({latitude,longitude,address,lang}:{latitude:number;longitude:number;address:string;lang:Language}){
  const host=useRef<HTMLDivElement>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let disposed=false,remove:undefined|(()=>void);
    setFailed(false);
    void import('leaflet').then(L=>{
      if(disposed||!host.current)return;
      const map=L.map(host.current,{scrollWheelZoom:false}).setView([latitude,longitude],17);
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      }).addTo(map);
      let loaded=false;
      tiles.on('tileload',()=>{loaded=true;if(!disposed)setFailed(false);});
      tiles.on('tileerror',()=>{if(!disposed&&!loaded)setFailed(true);});
      const popup=document.createElement('span');popup.textContent=address;
      L.marker([latitude,longitude],{title:address,alt:address,icon:L.divIcon({className:'property-map-pin',html:'<span aria-hidden="true">●</span>',iconSize:[32,40],iconAnchor:[16,40],popupAnchor:[0,-40]})}).addTo(map).bindPopup(popup).openPopup();
      const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>map.invalidateSize({pan:false}));
      observer?.observe(host.current);
      remove=()=>{observer?.disconnect();map.remove();};
    }).catch(()=>{if(!disposed)setFailed(true);});
    return()=>{disposed=true;remove?.();};
  },[latitude,longitude,address]);
  return <><div ref={host} className="property-map" role="region" aria-label={`${{fr:'Carte interactive',en:'Interactive map',zh:'可交互地图'}[lang]} — ${address}`} data-latitude={latitude} data-longitude={longitude}/>{failed&&<p role="status">{{fr:'Les fonds de carte sont temporairement indisponibles. Le lien Google Maps ci-dessous ouvre la même position.',en:'Map tiles are temporarily unavailable. The Google Maps link below opens the same location.',zh:'地图底图暂时无法加载，可使用下方 Google Maps 链接查看同一位置。'}[lang]}</p>}</>;
}
