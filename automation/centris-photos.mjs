import sharp from 'sharp';

export async function sourcePhotoWebp(source,{fetchImpl=fetch}={}){
  const url=new URL(source);
  if(url.protocol!=='https:'||url.hostname!=='mspublic.centris.ca'||url.pathname!=='/media.ashx')throw Error('Untrusted photo URL');
  // Use the URL advertised by Centris. Unsupported size parameters can return an empty HTTP 200.
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok||!response.headers.get('Content-Type')?.startsWith('image/'))throw Error(`Source photo failed (${response.status}; ${response.headers.get('Content-Type')||'no image content type'})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>20e6)throw Error('Invalid source photo size');
  const image=await sharp(bytes,{limitInputPixels:40000000}).resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  const metadata=await sharp(image).metadata();
  if(metadata.width<100||metadata.height<100)throw Error('Invalid source photo dimensions');
  return image;
}
