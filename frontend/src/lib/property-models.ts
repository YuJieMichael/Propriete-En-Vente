export type ModelText={fr:string;en:string;zh:string};
export type PropertyModel={src:string;label:ModelText;area:'interior'|'exterior';illustrative:boolean};

/** Reviewed, self-contained GLB files only. Optional bad media must not break a listing. */
export function propertyModels(value:unknown):PropertyModel[]{
  if(!Array.isArray(value))return [];
  const seen=new Set<string>();
  return value.slice(0,8).flatMap(raw=>{
    if(!raw||typeof raw!=='object')return [];
    const {src,label,area}=raw;
    if(typeof src!=='string'||src.length>240||!/^\/models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(src)||seen.has(src)
      ||!['interior','exterior'].includes(area)||!label||typeof label!=='object'
      ||!['fr','en','zh'].every(lang=>typeof label[lang]==='string'&&label[lang].trim()&&label[lang].length<=80&&!/[\u0000-\u001f]/.test(label[lang])))return [];
    seen.add(src);
    return [{src,area,label:{fr:label.fr.trim(),en:label.en.trim(),zh:label.zh.trim()},illustrative:raw.illustrative!==false} as PropertyModel];
  });
}
