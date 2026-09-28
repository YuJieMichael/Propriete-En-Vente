import type {Listing} from '../listings-data';

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
  return {id:'',date:'',image:'',aliases:'',real:true,mode:'broker',type:type as Listing['type'],
    district:str('title',200),title:str('title',200),city:str('city',120),postal:str('postal',7),
    neighbourhood:str('district',120),description:str('description',3000),price,beds:number('beds'),
    baths:number('baths'),area:number('area'),lotArea:number('lotArea'),parking:bool('parking'),outdoor:bool('outdoor'),
    transaction:transaction as Listing['transaction'],rentPrice:number('rentPrice'),taxExtra:v.taxExtra===true,
    source:{id:source.id,url:source.url,placeholder:source.placeholder===true},
    parkingSpaces:number('parkingSpaces')??undefined};
}
