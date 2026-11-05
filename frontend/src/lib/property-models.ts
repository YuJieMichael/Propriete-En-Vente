import {isImportedPhotoPath} from './imported-photo-path';

export type ModelText={fr:string;en:string;zh:string};
export type ModelPoint=[number,number,number];
export type ModelHotspot={id:string;label:ModelText;position:ModelPoint;normal:ModelPoint;photos:string[];illustrative:boolean};
export type PropertyModel={src:string;label:ModelText;area:'interior'|'exterior';illustrative:boolean;hotspots?:ModelHotspot[]};

function translated(value:unknown):value is ModelText{
  return !!value&&typeof value==='object'&&['fr','en','zh'].every(lang=>{
    const text=(value as Record<string,unknown>)[lang];
    return typeof text==='string'&&!!text.trim()&&text.length<=80&&!/[\u0000-\u001f]/.test(text);
  });
}
function vector(value:unknown,limit:number):value is ModelPoint{
  return Array.isArray(value)&&value.length===3&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=limit);
}
function hotspots(value:unknown,sceneIllustrative:boolean):ModelHotspot[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.slice(0,12).flatMap(raw=>{
    if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(raw.id)||seen.has(raw.id)
      ||!translated(raw.label)||!vector(raw.position,10000)||!vector(raw.normal,1)||Math.hypot(...raw.normal)<.01||!Array.isArray(raw.photos))return [];
    const photos=[...new Set(raw.photos.filter((src:unknown):src is string=>typeof src==='string'&&src.length<=240
      &&(isImportedPhotoPath(src)||/^\/models\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+\.(?:webp|jpg|png)$/.test(src))))].slice(0,8) as string[];
    if(!photos.length)return [];
    seen.add(raw.id);
    return [{id:raw.id,label:{fr:raw.label.fr.trim(),en:raw.label.en.trim(),zh:raw.label.zh.trim()},position:[...raw.position],normal:[...raw.normal],photos,illustrative:sceneIllustrative||raw.illustrative!==false} as ModelHotspot];
  });
}

/** Reviewed, self-contained GLB files only. Optional bad media must not break a listing. */
export function propertyModels(value:unknown):PropertyModel[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.slice(0,8).flatMap(raw=>{
    if(!raw||typeof raw!=='object')return [];
    const {src,label,area}=raw;
    if(typeof src!=='string'||src.length>240||!/^\/models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(src)||seen.has(src)
      ||!['interior','exterior'].includes(area)||!translated(label))return [];
    seen.add(src);
    const illustrative=raw.illustrative!==false;
    const points=hotspots(raw.hotspots,illustrative);
    return [{src,area,label:{fr:label.fr.trim(),en:label.en.trim(),zh:label.zh.trim()},illustrative,...(points.length?{hotspots:points}:{})} as PropertyModel];
  });
}
