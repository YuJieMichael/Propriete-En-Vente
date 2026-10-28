/** A public campaign intent may preselect the property type, never submit a form. */
export function readEnquiryPreset(hash:string){
  if(!hash.startsWith('#acheter?'))return '';
  const params=new URLSearchParams(hash.slice(hash.indexOf('?')+1));
  return !params.has('listing')&&params.getAll('propertyType').length===1&&params.getAll('intent').length===1
    &&params.get('propertyType')==='hotel-motel'&&params.get('intent')==='hotel-acquisition'?'hotel-motel':'';
}
