import {ExternalLink} from 'lucide-react';
import type {Listing} from './listings-data';
import type {Language} from './seller-copy';
import {PropertyMap} from './property-map';

export function propertyMapLinks(item:Listing){
  // Coordinates from the listing identify this property, never the city centre.
  // Non-imported listings retain their existing public-area navigation links.
  const query=item.coordinates
    ? `${item.coordinates.latitude},${item.coordinates.longitude}`
    : [item.neighbourhood||item.district,item.city,item.postal,'Québec'].filter(Boolean).join(', ');
  const encoded=encodeURIComponent(query);
  return {google:`https://www.google.com/maps/search/?api=1&query=${encoded}`,apple:`https://maps.apple.com/?q=${encoded}`};
}

export function PropertyLocation({item,lang}:{item:Listing;lang:Language}){
  const t={fr:{title:'Emplacement de la propriété',missing:'L’adresse précise n’est pas publiée. L’emplacement exact doit être confirmé auprès du courtier.',google:'Ouvrir dans Google Maps',apple:'Plans Apple'},en:{title:'Property location',missing:'The precise address is not published. Confirm the exact location with the broker.',google:'Open in Google Maps',apple:'Apple Maps'},zh:{title:'物业位置',missing:'未公开具体地址，请向经纪确认准确位置。',google:'在 Google Maps 中打开',apple:'Apple 地图'}}[lang];
  const links=propertyMapLinks(item);
  return <section className="detail-section property-location" aria-labelledby="property-location-title">
    <h2 id="property-location-title">{t.title}</h2>
    {item.coordinates?<>
      <p>{item.title||item.district}, {item.city}</p>
      <PropertyMap latitude={item.coordinates.latitude} longitude={item.coordinates.longitude} address={`${item.title||item.district}, ${item.city}`} lang={lang}/>
      <nav className="detail-map-links"><a href={links.google} target="_blank" rel="noopener noreferrer">{t.google}<ExternalLink aria-hidden="true"/></a><a href={links.apple} target="_blank" rel="noopener noreferrer">{t.apple}<ExternalLink aria-hidden="true"/></a></nav>
    </>:<p>{t.missing}</p>}
  </section>;
}
