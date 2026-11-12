export const PHOTO_LIMIT = 1572864;
export const propertyTypes = ['house','condo','plex','commercial','land','hotel-motel','daycare','business'] as const;
export type PropertyType = typeof propertyTypes[number];
export type DaycareSubsidy = 'subsidized' | 'non-subsidized';
export const saleScopes = ['property','business','both'] as const;
export type SaleScope = typeof saleScopes[number];
export type CommercialFacts = { scope:SaleScope; rooms?:number; capacity?:number };
export type PublicProperty = { title:string; city:string; district:string; postal:string; price:number; type:PropertyType; daycareSubsidy?:DaycareSubsidy; beds:number|null; baths:number|null; area:number|null; description:string; mode:'owner'|'broker'; parking:boolean; parkingSpaces?:number; streetParking?:boolean; outdoor:boolean; confidential?:true; commercial?:CommercialFacts };

export function isCommercialType(type:string) {
  return ['commercial','hotel-motel','daycare','business'].includes(type);
}

export function parseProperty(value:unknown): PublicProperty {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw Error('invalid');
  const v=value as Record<string,unknown>;
  const text=(key:string,max:number,optional=false)=>{const x=v[key];if(typeof x!=='string'||x.length>max||(!optional&&!x.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x))throw Error('invalid');return x.trim();};
  const num=(key:string,min:number,max:number)=>{const x=v[key];if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max||!Number.isInteger(x))throw Error('invalid');return x;};
  const type=text('type',20),mode=text('mode',6),confidential=v.confidential===true;
  if(!propertyTypes.includes(type as PropertyType)||!['owner','broker'].includes(mode)|| (confidential&&!isCommercialType(type)))throw Error('invalid');
  const postal=confidential?'':text('postal',7).toUpperCase().replace(/\s/g,'');
  if(!confidential&&!/^[GHJ][0-9][A-Z][0-9][A-Z][0-9]$/.test(postal))throw Error('invalid');
  const subsidy=v.daycareSubsidy==null||v.daycareSubsidy===''?undefined:v.daycareSubsidy;
  if(subsidy!==undefined ? type!=='daycare'||!['subsidized','non-subsidized'].includes(subsidy as string) : type==='daycare'&&!confidential)throw Error('invalid');
  if(typeof v.parking!=='boolean'||typeof v.outdoor!=='boolean'||(v.parkingSpaces!==undefined&&(!Number.isInteger(v.parkingSpaces)||Number(v.parkingSpaces)<0||Number(v.parkingSpaces)>10))||(v.streetParking!==undefined&&typeof v.streetParking!=='boolean'))throw Error('invalid');
  let commercial:CommercialFacts|undefined;
  if(confidential){
    const facts=v.commercial as Record<string,unknown>|undefined;
    if(!facts||!saleScopes.includes(facts.scope as SaleScope))throw Error('invalid');
    commercial={scope:facts.scope as SaleScope};
    for(const [key,category] of [['rooms','hotel-motel'],['capacity','daycare']] as const){
      const count=facts[key];
      if(count==null)continue;
      if(type!==category||typeof count!=='number'||!Number.isInteger(count)||count<1||count>10000)throw Error('invalid');
      commercial[key]=count;
    }
  }
  return {title:text('title',120),city:text('city',100),district:text('district',120,true),postal:postal?postal.slice(0,3)+' '+postal.slice(3):'',price:num('price',1,1000000000),type:type as PublicProperty['type'],...(subsidy?{daycareSubsidy:subsidy as DaycareSubsidy}:{}),beds:confidential?null:num('beds',0,100),baths:confidential?null:num('baths',0,100),area:confidential?null:num('area',1,10000000),description:text('description',3000),mode:mode as PublicProperty['mode'],parking:v.parking,parkingSpaces:v.parkingSpaces===undefined?undefined:Number(v.parkingSpaces),streetParking:v.streetParking===true,outdoor:v.outdoor,...(confidential?{confidential:true,commercial}:{})};
}

export function parseReviewAddress(property:PublicProperty,value:unknown){
  if(!property.confidential)return undefined;
  if(typeof value!=='string'||!value.trim()||value.length>300||/[\u0000-\u001f]/.test(value))throw Error('invalid');
  const address=value.trim();
  const normalize=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const normalized=normalize(address);
  if(!normalized||[property.title,property.city,property.district,property.description].some(text=>normalize(text).includes(normalized)))throw Error('invalid');
  return address;
}

export function parseListingInput(value:unknown) {
  if(!value||typeof value!=='object')throw Error('invalid');
  const v=value as Record<string,unknown>;
  if(typeof v.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId)||v.consent!==true||v.website)throw Error('invalid');
  const contact=v.contact as Record<string,unknown>;
  if(!contact||typeof contact.name!=='string'||!contact.name.trim()||contact.name.length>120||typeof contact.email!=='string'||contact.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)||typeof contact.phone!=='string'||contact.phone.length>40)throw Error('invalid');
  if(!Array.isArray(v.photos)||v.photos.length<1||v.photos.length>4)throw Error('invalid');
  const property=parseProperty(v.property);
  if(isCommercialType(property.type)&&!property.confidential)throw Error('invalid');
  const reviewAddress=parseReviewAddress(property,contact.reviewAddress);
  if(property.confidential&&v.video)throw Error('invalid');
  const photos=v.photos.map((raw:unknown)=>{
    if(typeof raw!=='string'||raw.length>PHOTO_LIMIT*1.34+100)throw Error('invalid_photo');
    const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);if(!match)throw Error('invalid_photo');
    const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
    if(bytes.length<12||bytes.length>PHOTO_LIMIT)throw Error('invalid_photo');
    const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b):String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!valid)throw Error('invalid_photo');return {bytes,mime:`image/${match[1]}`,ext:match[1]==='jpeg'?'jpg':match[1]};
  });
  return {id:v.requestId,property,contact:{name:contact.name.trim(),email:contact.email.trim(),phone:contact.phone.trim(),...(reviewAddress?{reviewAddress}:{})},photos};
}
