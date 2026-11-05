/** Reviewed listing images use fixed public paths; private uploads remain signed. */
export function isImportedPhotoPath(path:string){
  return /^\/centris\/\d{7,8}\/\d{3}\.webp$/.test(path)
    || /^\/editorial\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/\d{3}\.webp$/.test(path);
}
