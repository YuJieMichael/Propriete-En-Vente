// Imported cover photos have a 640 px thumbnail beside them (scripts/make-photo-thumbnails.mjs).
const cover=/^(\/centris\/\d{7,8}\/001)\.webp$/;

/** Responsive sources for a card-sized photo; other photos are used as they are. */
export function cardPhotoSources(src:string,sizes:string):{srcSet?:string;sizes?:string}{
  const match=cover.exec(src);
  return match?{srcSet:`${match[1]}-640w.webp 640w, ${src} 1260w`,sizes}:{};
}

/** If the thumbnail is missing, show the full photo instead of an error. Returns true when it switched. */
export function fallBackToFullPhoto(image:HTMLImageElement,src:string){
  if(!image.getAttribute('srcset'))return false;
  image.removeAttribute('srcset');image.removeAttribute('sizes');image.src=src;
  return true;
}

// Card widths: two columns on phones, about 300 px on wider screens.
export const cardSizes='(max-width: 600px) 50vw, 320px';
