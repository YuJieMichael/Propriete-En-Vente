import type {Listing,ListingText,ListingFeature} from '../listings-data';

export function isImportedPhotoPath(path:string){
  return /^\/centris\/\d{7,8}\/\d{3}\.webp$/.test(path);
}

// Separate from the public submission validator: broker imports may omit facts
// that Centris does not disclose. Missing information is never fabricated.
export function parseImportedProperty(value:unknown):Listing {
  if(!value||typeof value!=='object')throw Error('invalid imported property');
  const v=value as Record<string,unknown>;
  const source=v.source as Record<string,unknown>|undefined;
  if(source?.provider!=='centris'||typeof source.id!=='string'||!/^\d{7,8}$/.test(source.id)
    ||typeof source.url!=='string'||!source.url.startsWith('https://www.centris.ca/fr/'))throw Error('invalid source');
  const str=(key:string,max=3000)=>{const x=v[key];if(typeof x!=='string'||x.length>max)throw Error('invalid text');return x;};
  const number=(key:string)=>{const x=v[key];if(x===null||x===undefined)return null;if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw Error('invalid number');return x;};
  const bool=(key:string)=>{const x=v[key];if(x===null||x===undefined)return null;if(typeof x!=='boolean')throw Error('invalid boolean');return x;};
  const type=str('type');if(!['house','condo','plex','commercial','land'].includes(type))throw Error('invalid type');
  const transaction=str('transaction');if(!['sale','rent','sale-rent'].includes(transaction))throw Error('invalid transaction');
  const price=number('price');if(!price)throw Error('invalid price');
  const translated=(value:unknown,max:number):ListingText=>{
    if(!value||typeof value!=='object')throw Error('invalid translations');
    const obj=value as Record<string,unknown>;
    for(const lang of ['fr','en','zh'])if(typeof obj[lang]!=='string'||!(obj[lang] as string).trim()||(obj[lang] as string).length>max)throw Error('invalid translations');
    return {fr:obj.fr as string,en:obj.en as string,zh:obj.zh as string};
  };
  let features:ListingFeature[]|undefined;
  if(v.features!==undefined){
    if(!Array.isArray(v.features)||v.features.length>60)throw Error('invalid features');
    features=v.features.map(f=>{
      if(!f||typeof f!=='object'||typeof f.key!=='string'||!f.key||f.key.length>100)throw Error('invalid feature');
      return {key:f.key,label:translated(f.label,150),value:translated(f.value,800)};
    });
    if(new Set(features.map(f=>f.key)).size!==features.length)throw Error('duplicate feature');
  }
  let coordinates:Listing['coordinates'];
  if(v.coordinates!=null){
    const geo=v.coordinates as Record<string,unknown>;
    if(geo.source!=='centris'||typeof geo.latitude!=='number'||!Number.isFinite(geo.latitude)||geo.latitude < -90||geo.latitude>90
      ||typeof geo.longitude!=='number'||!Number.isFinite(geo.longitude)||geo.longitude < -180||geo.longitude>180)throw Error('invalid coordinates');
    if(str('title',200)==='Adresse non publiée')throw Error('coordinates for undisclosed address');
    coordinates={latitude:geo.latitude,longitude:geo.longitude,source:'centris'};
  }
  return {id:'',date:'',image:'',aliases:'',real:true,mode:'broker',type:type as Listing['type'],
    district:str('title',200),title:str('title',200),city:str('city',120),postal:str('postal',7),
    neighbourhood:str('district',120),description:str('description',3000),price,beds:number('beds'),
    descriptionTranslations:v.descriptionTranslations===undefined?undefined:translated(v.descriptionTranslations,3000),features,coordinates,
    baths:number('baths'),area:number('area'),lotArea:number('lotArea'),parking:bool('parking'),outdoor:bool('outdoor'),
    transaction:transaction as Listing['transaction'],rentPrice:number('rentPrice'),taxExtra:v.taxExtra===true,
    source:{id:source.id,url:source.url,placeholder:source.placeholder===true},
    parkingSpaces:number('parkingSpaces')??undefined};
}
