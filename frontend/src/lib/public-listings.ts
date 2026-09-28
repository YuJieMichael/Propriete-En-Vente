import {useEffect,useState} from 'react';
import {isImportedPhotoPath,parseImportedProperty} from './imported-listings';
import {supabase} from './supabase';
import {parseProperty} from '../../../supabase/functions/_shared/listing-input';
import {listingFallback,type Listing} from '../listings-data';
export const publicListingsEnabled=!!supabase&&import.meta.env.VITE_LISTING_PUBLICATION_ENABLED==='true';
// Public data only, in memory. Refresh before five-minute photo URLs expire.
const refreshMs=240000;
let snapshot:{items:Listing[];expires:number}|null=null;
let pending:Promise<Listing[]>|null=null;
export function loadPublicListings():Promise<Listing[]>{
  if(snapshot&&snapshot.expires>Date.now())return Promise.resolve(snapshot.items);
  if(pending)return pending;
  if(!supabase||!publicListingsEnabled)return Promise.resolve([]);
  const client=supabase;
  pending=(async()=>{
    const result=await client.from('published_listings').select('id,listing_number,property,photo_paths,video_path,published_at').order('published_at',{ascending:false}).limit(1000);
    if(result.error)throw result.error;
    const rows=result.data||[];
    const privatePaths=[...new Set(rows.flatMap(row=>(row.photo_paths as string[]).filter(path=>!isImportedPhotoPath(path))))];
    const signedPhotos=new Map<string,string>();
    if(privatePaths.length){
      const signed=await client.storage.from('listing-photos').createSignedUrls(privatePaths,300);
      if(signed.error)throw signed.error;
      for(const photo of signed.data||[]){if(photo.error||!photo.path||!photo.signedUrl)throw Error('photo unavailable');signedPhotos.set(photo.path,photo.signedUrl);}
    }
    const values=await Promise.all(rows.map(async row=>{
      const imported=row.property?.source?.provider==='centris';
      const p=imported?parseImportedProperty(row.property):parseProperty(row.property);
      const photos=(row.photo_paths as string[]).map(path=>{
        if(imported&&isImportedPhotoPath(path))return path;
        const signed=signedPhotos.get(path);if(!signed)throw Error('photo unavailable');return signed;
      });
      let video:string|undefined;
      if(row.video_path){const signed=await client.storage.from('listing-videos').createSignedUrl(row.video_path,300);if(!signed.error)video=signed.data.signedUrl;}
      const reference=/^\d+$/.test(String(row.listing_number))?String(row.listing_number):undefined;
      return {...p,video,id:row.id,reference,district:p.title||p.district,neighbourhood:imported?(p as Listing).neighbourhood:p.district,aliases:`${p.title} ${p.district} ${p.city} ${reference||''}`,date:row.published_at.slice(0,10),image:photos[0]||listingFallback,photos,real:true} satisfies Listing;
    }));
    snapshot={items:values,expires:Date.now()+refreshMs};return values;
  })().catch(error=>{snapshot=null;throw error;}).finally(()=>{pending=null;});
  return pending;
}
export function usePublicListings(){
  const fresh=snapshot&&snapshot.expires>Date.now()?snapshot:null;
  const [items,setItems]=useState<Listing[]>(fresh?.items||[]),[loading,setLoading]=useState(publicListingsEnabled&&!fresh),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{const values=await loadPublicListings();if(active){setItems(values);setError(false);}}
      catch{if(active){setItems([]);setError(true);}}
      finally{if(active)setLoading(false);}
    }
    void load();const interval=setInterval(()=>void load(),refreshMs);
    return()=>{active=false;clearInterval(interval);};
  },[]);
  return {items,loading,error};
}
