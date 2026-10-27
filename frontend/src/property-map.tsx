import type {Language} from './seller-copy';

export function googleMapsEmbedUrl(latitude:number,longitude:number,lang:Language){
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180)throw Error('invalid coordinates');
  const language=lang==='zh'?'zh-CN':lang;
  // Let Google resolve the coordinate query into its embed format. Fabricating
  // a Share payload can render the tiles while failing to load the place pin.
  const query=new URLSearchParams({q:`${latitude},${longitude}`,z:'16',hl:language,output:'embed'});
  return `https://www.google.com/maps?${query}`;
}

export function PropertyMap({latitude,longitude,address,lang}:{latitude:number;longitude:number;address:string;lang:Language}){
  const title=`Google Maps — ${address}`;
  return <div className="property-map" role="region" aria-label={title} data-latitude={latitude} data-longitude={longitude}>
    <iframe src={googleMapsEmbedUrl(latitude,longitude,lang)} title={title} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
  </div>;
}
