import type {Language} from './seller-copy';

export function googleMapsEmbedUrl(latitude:number,longitude:number,lang:Language){
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180)throw Error('invalid coordinates');
  const language=lang==='zh'?'zh-CN':lang;
  // Google Maps' Share > Embed a map format. The pin uses the exact coordinates,
  // so the query cannot resolve to the borough or a similarly named street.
  const pin=btoa(`${latitude}, ${longitude}`).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d2795.561188807261!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2z${pin}!5e0!3m2!1s${language}!2sca!4v1790608813979!5m2!1s${language}!2sca`;
}

export function PropertyMap({latitude,longitude,address,lang}:{latitude:number;longitude:number;address:string;lang:Language}){
  const title=`Google Maps — ${address}`;
  return <div className="property-map" role="region" aria-label={title} data-latitude={latitude} data-longitude={longitude}>
    <iframe src={googleMapsEmbedUrl(latitude,longitude,lang)} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
  </div>;
}
