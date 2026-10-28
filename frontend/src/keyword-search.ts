import type {Listing,PropertyType} from './listings-data';
import type {Language} from './seller-copy';

export type ListingKeyword={id:string;labels:Record<Language,string>;synonyms:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normal=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'");

/** Ignore malformed/legacy optional metadata without losing the catalogue. */
export function readListingKeywords(value:unknown):ListingKeyword[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,300).flatMap(raw=>{
  if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!uuid.test(raw.id)||!raw.labels||!Array.isArray(raw.synonyms)||raw.synonyms.length>30)return [];
  if(!(['en','fr','zh'] as const).every(lang=>typeof raw.labels[lang]==='string'&&raw.labels[lang].trim().length>0&&raw.labels[lang].length<=60))return [];
  if(!raw.synonyms.every((term:unknown)=>typeof term==='string'&&term.trim().length>0&&term.length<=80))return [];
  return [{id:raw.id,labels:{en:raw.labels.en,fr:raw.labels.fr,zh:raw.labels.zh},synonyms:[...raw.synonyms]}];
 });
}

export const cityKeywordAliases=[
 {base:'Montréal',aliases:['montreal','蒙特利尔','蒙特利爾','蒙特婁','满地可','滿地可']},
 {base:'Laval',aliases:['拉瓦尔','拉瓦爾']},
 {base:'Brossard',aliases:['布罗萨尔','布羅薩爾']},
 {base:'Longueuil',aliases:['隆格伊','朗格伊']},
 {base:'Québec',aliases:['魁北克市','quebec city']},
 {base:'Gatineau',aliases:['加蒂诺','加蒂諾']},
 {base:'Sherbrooke',aliases:['舍布鲁克','舍布魯克']},
 {base:'Trois-Rivières',aliases:['三河市']},
];
const typeTerms:Record<PropertyType,string[]>={
 'hotel-motel':['hotel','hotels','hôtel','hôtels','motel','motels','酒店','旅馆','旅館','汽车旅馆','汽車旅館'],
 daycare:['garderie','garderies','daycare','daycares','day care','托儿所','托兒所','幼儿园','幼兒園','托儿机构'],
 land:['land','terrain','terrains','土地','地块','地塊'],business:['business','businesses','entreprise','entreprises','生意','企业','企業'],
 house:['house','houses','maison','maisons','独立屋','獨立屋','别墅','別墅','独栋','獨棟'],
 condo:['condo','condos','condominium','condominiums','apartment','apartments','appartement','appartements','公寓'],
 plex:['plex','duplex','triplex','quadruplex','多户住宅','多戶住宅','复式','複式'],commercial:['commercial','commercial property','商业物业','商業物業'],
};
type Group={id:string;terms:string[];matches:(item:Listing)=>boolean};
type TermMatch={start:number;length:number;term:string;groups:string[]};
function customGroups(items:Listing[]):Group[]{
 const definitions=new Map<string,ListingKeyword>();
 for(const item of items)for(const tag of item.keywords||[])definitions.set(tag.id,tag);
 return [...definitions.values()].map(tag=>({id:`tag:${tag.id}`,terms:[...Object.values(tag.labels),...tag.synonyms],matches:(item:Listing)=>!!item.keywords?.some(value=>value.id===tag.id)}));
}
function termMatches(text:string,groups:Group[]):TermMatch[]{
 const source=normal(text),terms=new Map<string,Set<string>>();
 for(const group of groups)for(const value of group.terms){const term=normal(value).trim().replace(/\s+/g,' ');if(!term)continue;if(!terms.has(term))terms.set(term,new Set());terms.get(term)!.add(group.id);}
 const used=new Set<number>(),result:TermMatch[]=[];
 for(const [term,ids] of [...terms].sort((a,b)=>b[0].length-a[0].length)){
  const pattern=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
  for(const match of source.matchAll(new RegExp(pattern,'g'))){
   const start=match.index!,end=start+match[0].length;
   if((/^[a-z0-9]/.test(term)&&/[a-z0-9]/.test(source[start-1]||''))||(/[a-z0-9]$/.test(term)&&/[a-z0-9]/.test(source[end]||'')))continue;
   if([...Array(end-start)].some((_,offset)=>used.has(start+offset)))continue;
   for(let i=start;i<end;i++)used.add(i);
   result.push({start,length:end-start,term:source.slice(start,end),groups:[...ids]});
  }
 }
 return result.sort((a,b)=>a.start-b.start);
}
/** Only explicit public tags; the sentence parser must not infer these as cities. */
export function findKeywordTerms(text:string,items:Listing[]):TermMatch[]{return termMatches(text,customGroups(items));}

export function compileKeywordQuery(items:Listing[],query:string):(item:Listing)=>boolean{
 if(!query.trim())return ()=>true;
 const groups:Group[]=[...customGroups(items),...Object.entries(typeTerms).map(([type,terms])=>({id:`type:${type}`,terms,matches:(item:Listing)=>item.type===type}))];
 for(const place of cityKeywordAliases)groups.push({id:`city:${place.base}`,terms:[place.base,...place.aliases],matches:item=>{const city=normal(item.city),base=normal(place.base);return city===base||city.startsWith(base+' (')||city.startsWith(base+',');}});
 groups.push({id:'parking',terms:['parking','stationnement','garage','车位','車位','停车','停車'],matches:item=>!!(item.parking||item.streetParking)},
  {id:'outdoor',terms:['garden','yard','jardin','cour extérieure','花园','花園','院子','户外空间','戶外空間'],matches:item=>!!item.outdoor});
 const matched=termMatches(query,groups),source=normal(query).split('');
 for(const term of matched)for(let i=term.start;i<term.start+term.length;i++)source[i]=' ';
 const tokens=source.join('').split(/[\s,，、.;；:：()[\]!?？！]+/).filter(Boolean);
 const predicates=new Map(groups.map(group=>[group.id,group.matches]));
 return item=>{
  const searchable=normal(`${item.city} ${item.district} ${item.postal} ${item.aliases} ${item.reference||''} ${item.id}`);
  const postal=query.replace(/\s/g,'');
  const postalMatch=/^[a-z]\d[a-z](?:\d[a-z]\d)?$/i.test(postal)&&normal(postal.slice(0,3))===normal(item.postal);
  return matched.every(term=>term.groups.some(id=>predicates.get(id)!(item)))&&(postalMatch||tokens.every(token=>searchable.includes(token)));
 };
}
