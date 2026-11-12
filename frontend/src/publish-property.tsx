import {trackGoogleAdsLead} from './lib/google-ads-measurement.mjs';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Language } from './seller-copy';
import { publicationCopy } from './publication-copy';
import { listingsCopy } from './listings-copy';
import { selectablePropertyTypes, daycareLabels } from './property-categories';
import { QuebecCityOptions, QUEBEC_CITY_LIST_ID } from './quebec-cities';
import { backendConfigured } from './lib/supabase';
import { isCommercialType, parseProperty, parseReviewAddress, saleScopes, type PublicProperty } from '../../supabase/functions/_shared/listing-input';
import { commercialIntakeCopy, saleScopeCopy } from './commercial-listing-copy';
import { prepareListingPhoto, type PhotoError } from './lib/listing-photo';
import { photoCopy } from './photo-copy';
import { VIDEO_LIMIT, parseVideo } from '../../supabase/functions/_shared/listing-video';
import {videoCopy} from './video-copy';
import {ListingCheckup} from './listing-checkup';
import {freeListingCopy} from './free-listing-copy';
import './enquiry.css';
import './publication.css';
import './commercial-listing.css';

export const publicationEnabled = backendConfigured && import.meta.env.VITE_LISTING_PUBLICATION_ENABLED === 'true';
type Draft = { property:PublicProperty; contact:{name:string;email:string;phone:string;reviewAddress?:string}; consent:boolean; website:string };
export function PublishProperty({lang}:{lang:Language}) {
  const c=publicationCopy[lang],v=videoCopy[lang];
  const commercialCopy=commercialIntakeCopy[lang];
  const [video,setVideo]=useState('');
  const [propertyType,setPropertyType]=useState('house');
  const confidential=isCommercialType(propertyType);
  const [videoConsent,setVideoConsent]=useState(false);
  const [videoError,setVideoError]=useState(false);
  const [photos,setPhotos]=useState<string[]>([]);
  const [photoError,setPhotoError]=useState<PhotoError|null>(null);
  const photoProcessing=useRef(false);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [preview,setPreview]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loadingPhotos,setLoadingPhotos]=useState(false);
  const [error,setError]=useState<'invalid'|'error'|'unavailable'|null>(null);
  const [reference,setReference]=useState('');
  const request=useRef({body:'',id:''});
  const sending=useRef(false);
  const previewHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(preview&&draft?.property.confidential){
      previewHeading.current?.parentElement?.scrollIntoView({block:'start',behavior:'instant'});
      previewHeading.current?.focus({preventScroll:true});
    }
  },[preview,draft]);
  function changeType(type:string){
    if(isCommercialType(type)!==confidential){
      setPhotos([]);setPhotoError(null);setVideo('');setVideoConsent(false);setVideoError(false);
    }
    setPropertyType(type);
  }
  async function addPhotos(files:File[]) {
    if(!files.length||photoProcessing.current)return;
    if(files.length+photos.length>4){setPhotoError('count');return;}
    photoProcessing.current=true;setLoadingPhotos(true);setPhotoError(null);setError(null);
    try {
      const added:string[]=[];
      for(const file of files)added.push(await prepareListingPhoto(file));
      setPhotos(current=>[...current,...added]);
    } catch(err) {const reason=err instanceof Error?err.message:'';setPhotoError(['format','size','read'].includes(reason)?reason as PhotoError:'read');} finally {photoProcessing.current=false;setLoadingPhotos(false);}
  }
  async function addVideo(file:File|undefined) {
    if(!file)return;
    setVideoError(false);
    if(!['video/mp4','video/webm'].includes(file.type)||!file.size||file.size>VIDEO_LIMIT){setVideoError(true);return;}
    setLoadingPhotos(true);
    try{const raw=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});parseVideo(raw);setVideo(raw);setVideoConsent(false);}catch{setVideoError(true);}finally{setLoadingPhotos(false);}
  }
  function prepare(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setError(null);
    try {
      const f=Object.fromEntries(new FormData(event.currentTarget));
      const commercial=confidential?{scope:f.saleScope,rooms:f.guestRooms?Number(f.guestRooms):undefined,capacity:f.daycareCapacity?Number(f.daycareCapacity):undefined}:undefined;
      const property=parseProperty({...f,confidential,commercial,price:Number(f.price),beds:Number(f.beds),baths:Number(f.baths),area:Number(f.area),parking:Number(f.parkingSpaces)>0,parkingSpaces:Number(f.parkingSpaces),streetParking:f.streetParking==='on',outdoor:f.outdoor==='on'});
      const reviewAddress=parseReviewAddress(property,f.reviewAddress);
      if(!String(f.name).trim()||!photos.length||f.consent!=='on'||(video&&!videoConsent))throw Error();
      setDraft({property,contact:{name:String(f.name).trim(),email:String(f.email).trim(),phone:String(f.phone),...(reviewAddress?{reviewAddress}:{})},consent:true,website:String(f.website||'')});
      setPreview(true);window.scrollTo({top:0,behavior:'instant'});
    } catch {setError('invalid');}
  }
  async function submit() {
    if(sending.current||!draft)return;
    if(!publicationEnabled){setError('unavailable');return;}
    const body=JSON.stringify({...draft,photos,video,videoConsent});
    if(body!==request.current.body)request.current={body,id:crypto.randomUUID()};
    sending.current=true;setBusy(true);setError(null);
    try {
      const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-listing`,{method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({...JSON.parse(body),requestId:request.current.id}),signal:AbortSignal.timeout(120000)});
      const result=await response.json();if(!response.ok||result.ok!==true)throw Error();
      if(!/^\d+$/.test(String(result.reference)))throw Error('missing_reference');
      setReference(String(result.reference));
      trackGoogleAdsLead('seller', request.current.id);
    } catch {setError('error');} finally {sending.current=false;setBusy(false);}
  }
  const photoFields=<><p>{confidential?commercialCopy.photoHint:photoCopy[lang].hint}</p>{photoError&&<p role="alert">{photoCopy[lang][photoError]}</p>}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple aria-label={confidential?commercialCopy.photos:c.photos} onChange={e=>{void addPhotos(Array.from(e.target.files||[]));e.target.value='';}}/>{loadingPhotos&&<p role="status">{c.loading}</p>}<div className="publication-photos">{photos.map((photo,i)=><figure key={i}><img src={photo} alt={`${confidential?commercialCopy.photos:c.photos} ${i+1}`}/><button type="button" onClick={()=>setPhotos(current=>current.filter((_,index)=>index!==i))}>{c.remove} {i+1}</button></figure>)}</div></>;
  if(reference)return <section className="enquiry-shell"><h1>{c.saved}</h1><p role="status">{c.savedText} <strong>{reference}</strong></p><p>{freeListingCopy[lang].savedNote}</p><a href="#proprietes">{c.listings}</a></section>;
  return <section className="enquiry-shell publication-form"><a href="#proprietes">← {c.listings}</a><h1>{c.title}</h1><p>{c.intro}</p>
    <aside className="free-listing-banner" aria-labelledby="free-listing-title"><p className="free-listing-badge">{freeListingCopy[lang].badge}</p><h2 id="free-listing-title">{freeListingCopy[lang].bannerTitle}</h2><p>{freeListingCopy[lang].bannerText}</p><a href="#terms">{freeListingCopy[lang].termsLink}</a></aside>
    {!publicationEnabled&&<p className="catalogue-notice" role="status">{c.unavailable}</p>}
    {error&&<p role="alert">{c[error]}</p>}
    {preview&&draft&&<div className={`enquiry-card${draft.property.confidential?' publication-commercial-preview':''}`}>
      <p className="eyebrow">{draft.property.confidential?commercialCopy.preview:c.localPreview}</p>
      <h2 ref={previewHeading} tabIndex={draft.property.confidential?-1:undefined}>{draft.property.title}</h2>
      <p>{listingsCopy[lang].types[draft.property.type]}{draft.property.daycareSubsidy?` · ${daycareLabels[lang][draft.property.daycareSubsidy]}`:''}</p>
      <p>{[draft.property.city,draft.property.postal||draft.property.district].filter(Boolean).join(' · ')}</p>
      <strong>{new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(draft.property.price)}</strong>
      {draft.property.commercial?<><p>{saleScopeCopy[lang][draft.property.commercial.scope]}</p><p>{commercialCopy.mediaHidden}</p></>:<>
        <div className="publication-photos">{photos.map((photo,i)=><img key={i} src={photo} alt={`${c.photos} ${i+1}`} />)}</div>
        {video&&<video src={video} controls playsInline preload="metadata" style={{width:"100%",maxHeight:420}}/>}
        <p>{c.beds}: {draft.property.beds} · {c.baths}: {draft.property.baths} · {c.area}: {draft.property.area}</p>
      </>}
      <p className="publication-description">{draft.property.description}</p>
      <p>{c.mode}: {draft.property.mode==='broker'?c.broker:c.hybrid}</p>
      <p>{draft.property.parkingSpaces?`${draft.property.parkingSpaces} ${c.parkingSpaces}`:''} {draft.property.streetParking?c.streetParking:''} {draft.property.outdoor?c.outdoor:''}</p>
      {!draft.property.confidential&&<ListingCheckup lang={lang} property={draft.property} photos={photos}/>}
      <div className="publication-actions"><button type="button" onClick={()=>{setPreview(false);setError(null);}} disabled={busy}>{c.edit}</button><button type="button" className="wide-cta" onClick={()=>void submit()} disabled={busy}>{busy?c.sending:c.submit}</button></div>
    </div>}
    <form className="enquiry-card" hidden={preview} onSubmit={prepare}>
      <fieldset disabled={busy||loadingPhotos}><legend>{c.public}</legend><div className="enquiry-grid">
        <label>{c.type} *<select name="type" value={propertyType} onChange={event=>changeType(event.target.value)}>{[...selectablePropertyTypes,'commercial' as const].map(type=><option value={type} key={type}>{listingsCopy[lang].types[type]}</option>)}</select></label>
        {confidential&&<label>{commercialCopy.scope} *<select name="saleScope" key={propertyType} defaultValue="" required><option value="" disabled>{commercialCopy.choose}</option>{saleScopes.map(scope=><option key={scope} value={scope}>{saleScopeCopy[lang][scope]}</option>)}</select></label>}
        {confidential&&<p className="enquiry-full commercial-intake-hint">{commercialCopy.publicHint}</p>}
        <label className="enquiry-full">{c.headline} *<input name="title" required maxLength={120}/></label>
        <QuebecCityOptions><label>{c.city} *<input name="city" list={QUEBEC_CITY_LIST_ID} autoComplete="address-level2" required maxLength={100}/></label></QuebecCityOptions><label>{c.district}<input name="district" maxLength={120}/></label>
        {!confidential&&<label>{c.postal} *<input name="postal" required maxLength={7} pattern="[GgHhJj][0-9][A-Za-z] ?[0-9][A-Za-z][0-9]" placeholder="G1R 2L3"/></label>}
        <label>{c.price} *<input name="price" type="number" min="1" max="1000000000" step="1" required/></label>
        {propertyType==='daycare'&&<><fieldset className="enquiry-daycare"><legend>{daycareLabels[lang].title} *</legend><div className="enquiry-daycare-choices">{(['subsidized','non-subsidized'] as const).map(value=><label key={value}><input type="radio" name="daycareSubsidy" value={value} required/><span>{daycareLabels[lang][value]}</span></label>)}</div></fieldset><label>{commercialCopy.capacity}<input name="daycareCapacity" type="number" min="1" max="10000" step="1"/></label></>}
        {propertyType==='hotel-motel'&&<label>{commercialCopy.rooms}<input name="guestRooms" type="number" min="1" max="10000" step="1"/></label>}
        <label>{c.mode} *<select name="mode"><option value="owner">{c.hybrid}</option><option value="broker">{c.broker}</option></select></label>
        {!confidential&&<><label>{c.beds} *<input name="beds" type="number" min="0" max="100" required step="1"/></label><label>{c.baths} *<input name="baths" type="number" min="0" max="100" required step="1"/></label>
        <label>{c.area} *<input name="area" type="number" min="1" max="10000000" required step="1"/></label></>}
        <label className="enquiry-full">{c.description} *<textarea name="description" rows={5} maxLength={3000} required/></label>
      </div><div className="publication-checks"><label>{c.parkingSpaces}<select name="parkingSpaces"><option value="0">{c.noParking}</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}{n===1?` ${c.parkingSpace}`:` ${c.parkingSpaces}`}</option>)}</select></label><label><input type="checkbox" name="streetParking"/>{c.streetParking}</label><label><input type="checkbox" name="outdoor"/>{c.outdoor}</label></div></fieldset>
      {confidential?<fieldset className="commercial-private-review" disabled={busy||loadingPhotos}><legend>{commercialCopy.private}</legend>
        <p>{commercialCopy.hint}</p>
        <div className="enquiry-grid"><label className="enquiry-full">{commercialCopy.address} *<input name="reviewAddress" maxLength={300} autoComplete="street-address" required /></label></div>
        <h3>{commercialCopy.photos} *</h3>{photoFields}
      </fieldset>:<>
        <fieldset disabled={busy||loadingPhotos}><legend>{c.photos} *</legend>{photoFields}</fieldset>
        <fieldset disabled={busy||loadingPhotos}><legend>{v.label}</legend><p>{v.hint}</p><input type="file" accept="video/mp4,video/webm" aria-label={v.label} onChange={e=>{void addVideo(e.target.files?.[0]);e.target.value='';}}/>{videoError&&<p role="alert">{v.invalid}</p>}{video&&<><video controls playsInline preload="metadata" src={video} style={{width:'100%',maxHeight:360}}/><button type="button" onClick={()=>{setVideo('');setVideoConsent(false);setVideoError(false);}}>{c.remove}</button><label className="publication-consent"><input type="checkbox" required checked={videoConsent} onChange={e=>setVideoConsent(e.target.checked)}/>{v.consent}</label></>}</fieldset>
      </>}
      <fieldset disabled={busy||loadingPhotos}><legend>{c.private}</legend><p>{c.privacy}</p><div className="enquiry-grid"><label>{c.name} *<input name="name" required maxLength={120} autoComplete="name"/></label><label>{c.email} *<input name="email" required type="email" maxLength={254} autoComplete="email"/></label><label>{c.phone}<input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label></div><label className="publication-consent"><input name="consent" type="checkbox" required/>{confidential?commercialCopy.consent:c.consent} *</label></fieldset>
      <div className="enquiry-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div><button type="submit" className="wide-cta" disabled={busy||loadingPhotos}>{c.preview}</button>
    </form>
  </section>;
}
