import sharp from 'sharp';

// Centris's listing page advertises mosaic sizes: the first photo at 640×480 and the rest as 320×240
// thumbnails. The gallery serves the same photo at full size with sm=m&w=1260&h=1024. Unsupported size
// parameters can return an empty HTTP 200, so the full-size request is only kept when it decodes to a
// larger image than the advertised one; otherwise the advertised URL is used as before.
export const FULL_SIZE={sm:'m',w:'1260',h:'1024'};
export const MIN_SHARP_WIDTH=900;

function trusted(source){
  const url=new URL(source);
  if(url.protocol!=='https:'||url.hostname!=='mspublic.centris.ca'||url.pathname!=='/media.ashx')throw Error('Untrusted photo URL');
  return url;
}
export function fullSizeUrl(source){
  const url=trusted(source);
  const full=new URL(url);
  for(const [key,value] of Object.entries(FULL_SIZE))full.searchParams.set(key,value);
  return full.href===url.href?null:full;
}
async function fetchWebp(url,fetchImpl){
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/'))throw Error(`Source photo failed (${response.status}; ${response.headers.get('Content-Type')||'no image content type'})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>20e6)throw Error('Invalid source photo size');
  const image=await sharp(bytes,{limitInputPixels:40000000}).resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  const metadata=await sharp(image).metadata();
  if(metadata.width<100||metadata.height<100)throw Error('Invalid source photo dimensions');
  return {image,width:metadata.width,height:metadata.height};
}

export async function sourcePhotoWebp(source,{fetchImpl=fetch}={}){
  const url=trusted(source);
  const full=fullSizeUrl(source);
  if(full){
    try{
      const result=await fetchWebp(full,fetchImpl);
      const advertised=Number(url.searchParams.get('w'))||0;
      if(result.width>advertised)return result.image;
    }catch{/* fall back to the advertised URL */}
  }
  return (await fetchWebp(url,fetchImpl)).image;
}
