import {useEffect,useState} from 'react';
import {isImportedPhotoPath,parseImportedProperty} from './imported-listings';
import {supabase} from './supabase';
import {parseProperty} from '../../../supabase/functions/_shared/listing-input';
import {listingFallback,type Listing} from '../listings-data';
export const publicListingsEnabled=!!supabase&&import.meta.env.VITE_LISTING_PUBLICATION_ENABLED==='true';
export function usePublicListings(){
  const [items,setItems]=useState<Listing[]>([]),[loading,setLoading]=useState(publicListingsEnabled),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    async function load(){
      if(!supabase||!publicListingsEnabled)return;
      try{
        const result=await supabase.from('published_listings').select('id,property,photo_paths,video_path,published_at').order('published_at',{ascending:false}).limit(1000);
        if(result.error)throw result.error;
        const values=await Promise.all((result.data||[]).map(async row=>{
          const imported=row.property?.source?.provider==='centris';
          const p=imported?parseImportedProperty(row.property):parseProperty(row.property);
          const photos=await Promise.all((row.photo_paths as string[]).map(async path=>{
            if(imported&&isImportedPhotoPath(path))return path;
            const signed=await supabase!.storage.from('listing-photos').createSignedUrl(path,300);
            if(signed.error)throw signed.error;
            return signed.data.signedUrl;
          }));
          let video:string|undefined;
          if(row.video_path){const signed=await supabase!.storage.from('listing-videos').createSignedUrl(row.video_path,300);if(!signed.error)video=signed.data.signedUrl;}
          return {...p,video,id:row.id,district:p.title||p.district,neighbourhood:imported?(p as Listing).neighbourhood:p.district,aliases:`${p.title} ${p.district} ${p.city} ${(p as Listing).source?.id||""}`,date:row.published_at.slice(0,10),image:photos[0]||listingFallback,photos,real:true} satisfies Listing;
        }));
        if(active){setItems(values);setError(false);}
      }catch{if(active)setError(true);}finally{if(active)setLoading(false);}
    }
    void load();const interval=setInterval(()=>void load(),240000);
    return()=>{active=false;clearInterval(interval);};
  },[]);
  return {items,loading,error};
}
