/** A public campaign intent may preselect the property type, never submit a form. */
export function readEnquiryPreset(hash:string){
  if(!hash.startsWith('#acheter?'))return '';
  const params=new URLSearchParams(hash.slice(hash.indexOf('?')+1));
  return !params.has('listing')&&params.getAll('propertyType').length===1&&params.getAll('intent').length===1
    &&params.get('propertyType')==='hotel-motel'&&params.get('intent')==='hotel-acquisition'?'hotel-motel':'';
}

/** A request initiates manual review; it never represents an executed NDA. */
export function readConfidentialRequest(hash:string):boolean{
 if(!hash.startsWith('#acheter?'))return false;
 const params=new URLSearchParams(hash.slice(hash.indexOf('?')+1));
 return params.getAll('listing').length===1&&params.getAll('intent').length===1&&params.get('intent')==='nda'
  &&/^(?:[0-9]{1,18}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(params.get('listing')||'');
}
