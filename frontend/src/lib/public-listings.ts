import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import {parseProperty} from '../../../supabase/functions/_shared/listing-input';
import {listingFallback,type Listing} from '../listings-data';
export const publicListingsEnabled=!!supabase&&import.meta.env.VITE_LISTING_PUBLICATION_ENABLED==='true';
export function usePublicListings(listingId?:string){
  const [items,setItems]=useState<Listing[]>([]),[loading,setLoading]=useState(publicListingsEnabled),[error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    async function load(){
      if(!supabase||!publicListingsEnabled)return;
      try{
        const fields='id,property,photo_paths,video_path,published_at';
        const result=await supabase.from('published_listings').select(fields).order('published_at',{ascending:false}).limit(1000);
        if(result.error)throw result.error;
        const rows=result.data||[];
        // Keep related listings, while resolving older details beyond the catalogue's first page.
        if(listingId&&!rows.some(row=>row.id===listingId)){
          const detail=await supabase.from('published_listings').select(fields).eq('id',listingId);
          if(detail.error)throw detail.error;
          rows.push(...(detail.data||[]));
        }
        const values=await Promise.all(rows.map(async row=>{
          const p=parseProperty(row.property);
          const photos=await Promise.all((row.photo_paths as string[]).map(async path=>{
            const signed=await supabase!.storage.from('listing-photos').createSignedUrl(path,300);
            if(signed.error)throw signed.error;
            return signed.data.signedUrl;
          }));
          let video:string|undefined;
          if(row.video_path){const signed=await supabase!.storage.from('listing-videos').createSignedUrl(row.video_path,300);if(!signed.error)video=signed.data.signedUrl;}
          return {...p,video,id:row.id,district:p.title,neighbourhood:p.district,aliases:`${p.title} ${p.district} ${p.city}`,date:row.published_at.slice(0,10),image:photos[0]||listingFallback,photos,real:true} satisfies Listing;
        }));
        if(active){setItems(values);setError(false);}
      }catch{if(active)setError(true);}finally{if(active)setLoading(false);}
    }
    setLoading(publicListingsEnabled);void load();const interval=setInterval(()=>void load(),240000);
    return()=>{active=false;clearInterval(interval);};
  },[listingId]);
  return {items,loading,error};
}
