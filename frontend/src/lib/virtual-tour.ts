export type VirtualTour={url:string;provider:'Matterport'|'Kuula'};

/** Accept a real provider share URL, never HTML, script URLs, or arbitrary frames.
 * The broker/importer must verify that the tour belongs to this property.
 * Normalization deliberately drops tracking, redirects, and autoplay parameters.
 */
export function virtualTour(value:unknown):VirtualTour|null {
  if(typeof value!=='string'||value.length>2000)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    if(url.hostname==='my.matterport.com'&&/^\/show\/?$/.test(url.pathname)){
      const model=url.searchParams.getAll('m');
      if(model.length!==1||!/^[A-Za-z0-9]{11}$/.test(model[0]))return null;
      return {url:`https://my.matterport.com/show/?m=${model[0]}`,provider:'Matterport'};
    }
    if(['kuula.co','www.kuula.co'].includes(url.hostname)&&/^\/share\/(collection\/)?[A-Za-z0-9_-]{4,80}\/?$/.test(url.pathname)){
      return {url:`https://kuula.co${url.pathname.replace(/\/$/,'')}`,provider:'Kuula'};
    }
  }catch{/* An invalid optional tour never prevents the listing from loading. */}
  return null;
}
