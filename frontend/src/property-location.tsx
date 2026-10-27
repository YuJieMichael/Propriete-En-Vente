import {ExternalLink} from 'lucide-react';
import type {Listing} from './listings-data';
import type {Language} from './seller-copy';
import {PropertyMap} from './property-map';

export function propertyMapLinks(item:Listing){
  // Keep the embedded map on the precise coordinates, but open Google Maps
  // with the published street address so its place card is readable.
  const coordinateQuery=item.coordinates
    ? `${item.coordinates.latitude},${item.coordinates.longitude}`
    : [item.neighbourhood||item.district,item.city,item.postal,'Québec'].filter(Boolean).join(', ');
  const addressQuery=item.source?.locationStatus==='approximate'?coordinateQuery:item.coordinates
    ? [item.title||item.district,item.city,item.postal,'Québec','Canada'].filter(Boolean).join(', ')
    : coordinateQuery;
  return {google:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`,apple:`https://maps.apple.com/?q=${encodeURIComponent(coordinateQuery)}`};
}

export function PropertyLocation({item,lang}:{item:Listing;lang:Language}){
  const t={fr:{title:'Emplacement de la propriété',missing:'L’adresse précise n’est pas publiée. L’emplacement exact doit être confirmé auprès du courtier.',google:'Ouvrir dans Google Maps',apple:'Plans Apple'},en:{title:'Property location',missing:'The precise address is not published. Confirm the exact location with the broker.',google:'Open in Google Maps',apple:'Apple Maps'},zh:{title:'物业位置',missing:'未公开具体地址，请向经纪确认准确位置。',google:'在 Google Maps 中打开',apple:'Apple 地图'}}[lang];
  const links=propertyMapLinks(item);
  const notice={fr:{approximate:'Emplacement indicatif uniquement. La portion à vendre et ses limites doivent être confirmées auprès du courtier après subdivision cadastrale.',unverified:'L’adresse précise reste à confirmer auprès du courtier. La carte est masquée jusqu’à vérification.'},en:{approximate:'Approximate location only. Confirm the portion for sale and its boundaries with the broker after cadastral subdivision.',unverified:'The precise address requires confirmation from the broker. The map is hidden until verified.'},zh:{approximate:'地图位置仅供参考。出售部分及具体边界须在地籍分割后向经纪确认。',unverified:'具体地址待经纪核实，确认前暂不显示精确地图。'}}[lang];
  const unverified=item.source?.locationStatus==='unverified';
  return <section className="detail-section property-location" aria-labelledby="property-location-title">
    <h2 id="property-location-title">{t.title}</h2>
    {item.coordinates&&!unverified?<>
      <p>{item.title||item.district}, {item.city}</p>
      {item.source?.locationStatus==='approximate'&&<p className="location-notice">{notice.approximate}</p>}
      <PropertyMap latitude={item.coordinates.latitude} longitude={item.coordinates.longitude} address={`${item.title||item.district}, ${item.city}`} lang={lang}/>
      <nav className="detail-map-links"><a href={links.google} target="_blank" rel="noopener noreferrer">{t.google}<ExternalLink aria-hidden="true"/></a><a href={links.apple} target="_blank" rel="noopener noreferrer">{t.apple}<ExternalLink aria-hidden="true"/></a></nav>
    </>:<p>{unverified?notice.unverified:t.missing}</p>}
  </section>;
}
