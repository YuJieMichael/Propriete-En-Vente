/** Imported listing photos are copied to fixed public paths under /centris/{listing}/{nnn}.webp. */
export function isImportedPhotoPath(path:string){
  return /^\/centris\/\d{7,8}\/\d{3}\.webp$/.test(path);
}
