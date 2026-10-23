import {supabase} from './supabase';
import {QUEBEC_CITIES} from '../quebec-cities';

// This starter board offers actual Québec municipalities, rather than a public
// free-text location field which could accidentally contain personal details.
export const wantedCities = QUEBEC_CITIES.slice(0,40);
export const wantedTypes=['house','condo','plex','land','hotel-motel','daycare','business'] as const;
export type WantedType=typeof wantedTypes[number];
export type WantedCriteria={propertyType:WantedType;city:string;budgetMin:number;budgetMax:number;beds:number|null;parking:boolean|null;transaction:'sale'|'rent';timeline:'now'|'3-months'|'6-months'|'flexible'};
export type WantedCard=WantedCriteria&{id:string;createdAt:string;expiresAt:string};
export type MyWantedCard=WantedCard&{status:'pending'|'published'|'rejected'|'withdrawn'|'expired';revision:number;reviewNote:string;replyCount:number};
export type WantedReply={id:string;requestId:string;message:string;listingNumber:string|null;createdAt:string;card:WantedCard};

export function validWantedCriteria(card:WantedCriteria):boolean {
  return wantedTypes.includes(card.propertyType)&&wantedCities.some(city=>city===card.city)
    &&Number.isInteger(card.budgetMin)&&Number.isInteger(card.budgetMax)&&card.budgetMin>=0&&card.budgetMax>=1
    &&card.budgetMax<=1_000_000_000&&card.budgetMin<=card.budgetMax
    &&(card.beds===null||(Number.isInteger(card.beds)&&card.beds>=0&&card.beds<=20))
    &&(['house','condo','plex'].includes(card.propertyType)||card.beds===null)
    &&(card.parking===null||typeof card.parking==='boolean')
    &&['sale','rent'].includes(card.transaction)&&['now','3-months','6-months','flexible'].includes(card.timeline);
}
export async function wantedRpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{
  if(!supabase)throw Error('unconfigured');
  const result=await supabase.rpc(name,args);
  if(result.error)throw result.error;
  return result.data as T;
}
export function wantedError(error:unknown):'rate'|'duplicate'|'unavailable'|'verify'|'listingError'|'error'{
  const message=typeof error==='object'&&error&&'message' in error?String(error.message):String(error);
  if(message.includes('rate_limit'))return 'rate';
  if(message.includes('already_replied'))return 'duplicate';
  if(message.includes('not_available'))return 'unavailable';
  if(message.includes('verified_sign_in_required'))return 'verify';
  if(message.includes('listing_not_found'))return 'listingError';
  return 'error';
}
