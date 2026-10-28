import type {Listing} from './listings-data';

export type Amenity='pool'|'elevator';
const normal=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").toLowerCase().trim();
const terms:Record<Amenity,Set<string>>={
 pool:new Set(['pool','swimming pool','indoor pool','outdoor pool','heated pool','in-ground pool','above-ground pool','piscine','piscine intérieure','piscine extérieure','piscine chauffée','piscine creusée','piscine hors terre','泳池','游泳池','室内泳池','室內泳池','室外泳池','加热泳池','加熱泳池','地埋式泳池','地上式泳池'].map(normal)),
 elevator:new Set(['elevator','elevators','lift','ascenseur','电梯','電梯'].map(normal)),
};
const equipmentFields=new Set(['Caractéristiques additionnelles','Amenities','Amenities and features','Équipements et particularités','hotelAmenities','amenitiesExtra','Facilities','Installations','设施','附加设施'].map(normal));
const yes=new Set(['yes','oui','有']);
const poolKinds=new Set(['Indoor','Outdoor','Heated','In-ground','Above-ground','Intérieure','Extérieure','Chauffée','Creusée','Hors terre'].map(normal));

/** Only assigned public tags or affirmative structured features, never free-text guesses. */
export function hasListingAmenity(item:Listing,amenity:Amenity):boolean{
 if(item.keywords?.some(tag=>[...Object.values(tag.labels),...tag.synonyms].some(value=>terms[amenity].has(normal(value)))))return true;
 return !!item.features?.some(feature=>{
  const labels=[feature.key,...Object.values(feature.label)].map(normal);
  const titled=labels.some(value=>terms[amenity].has(value));
  if(!titled&&!labels.some(value=>equipmentFields.has(value)))return false;
  return Object.values(feature.value).some(value=>normal(value).split(/[,;、，；]|\s+(?:and|et)\s+|和|及|与|與/).some(part=>{
   const text=part.trim();
   // A nearby facility, question or negative sentence is never an equipment entry.
   return terms[amenity].has(text)||(titled&&(yes.has(text)||(amenity==='pool'&&poolKinds.has(text))));
  }));
 });
}
