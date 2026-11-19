import sharp from 'sharp';

// Conventional interpolation only. These settings cannot recover missing native
// detail and must not be described as a higher-resolution photographic source.
export const claritySettings={
  width:1260,
  kernel:'lanczos3',
  sharpen:{sigma:0.6,m1:0.15,m2:0.6,x1:2,y2:2,y3:3},
  webp:{lossless:true,effort:6},
};

export async function improvePhotoClarity(source,width=claritySettings.width){
  if(width!==640&&width!==claritySettings.width)throw Error('Unexpected reviewed output size');
  const metadata=await sharp(source).metadata();
  if(!metadata.width||metadata.width>680)throw Error('Expected a reviewed low-resolution source');
  const baseline=await sharp(source).resize({width,kernel:claritySettings.kernel}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  const output=await sharp(source).resize({width,kernel:claritySettings.kernel}).sharpen(claritySettings.sharpen).webp(claritySettings.webp).toBuffer();
  const pixels=await sharp(output).removeAlpha().toColourspace('srgb').raw().toBuffer();
  let sum=0,large=0;
  for(let i=0;i<pixels.length;i++){
    const difference=Math.abs(pixels[i]-baseline.data[i]);
    sum+=difference;if(difference>8)large++;
  }
  const meanSharpeningDifference=sum/pixels.length;
  const fractionOver8=large/pixels.length;
  // Compare to ordinary interpolation at the same size. Downsampling a resized
  // photograph is inherently lossy and is not a valid pixel-identity test.
  if(meanSharpeningDifference>1||fractionOver8>0.01)throw Error('Sharpening exceeded the conservative pixel-change limit');
  return {output,width:baseline.info.width,height:baseline.info.height,meanSharpeningDifference,fractionOver8};
}
