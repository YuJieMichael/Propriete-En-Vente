export const CENTRIS_AUDIENCE='proprieteenvente.ca:centris:e6356';
export const CENTRIS_ISSUER='https://token.actions.githubusercontent.com';
const repo='YuJieMichael/Propriete-En-Vente';
export function assertCloudClaims(c){
  const subjects=[`repo:${repo}:ref:refs/heads/main`,'repo:YuJieMichael@107652194/Propriete-En-Vente@1381834923:ref:refs/heads/main'];
  if(c.repository!==repo||c.repository_id!=='1381834923'||c.repository_owner_id!=='107652194'
    ||c.ref!=='refs/heads/main'||c.ref_type!=='branch'||c.runner_environment!=='github-hosted'
    ||c.workflow_ref!==`${repo}/.github/workflows/centris-sync.yml@refs/heads/main`
    ||!['schedule','workflow_dispatch'].includes(c.event_name)||!subjects.includes(c.sub)
    ||c.job_workflow_ref||!/^\d+$/.test(c.run_id)||!/^\d+$/.test(c.run_attempt))throw Error('Untrusted workflow');
  return `${c.run_id}-${c.run_attempt}`;
}
export function validateSnapshot(s){
  if(!s||s.brokerId!=='e6356'||s.complete!==true||!Array.isArray(s.cards)||s.total!==s.cards.length||s.total<1||s.total>200
    ||new Set(s.cards.map(c=>c.sourceId)).size!==s.total||!Number.isFinite(Date.parse(s.capturedAt)))throw Error('Invalid snapshot');
  for(const c of s.cards){
    if(!/^\d{7,8}$/.test(c.sourceId)||!['sale','rent','sale-rent'].includes(c.transaction)
      ||typeof c.price!=='number'||!Number.isFinite(c.price)||c.price<=0||c.price>1e9||typeof c.taxExtra!=='boolean'
      ||typeof c.title!=='string'||!c.title||c.title.length>200||typeof c.city!=='string'||!c.city||c.city.length>120
      ||(c.transaction==='sale'?c.rentPrice!==null:typeof c.rentPrice!=='number'||!Number.isFinite(c.rentPrice)||c.rentPrice<=0))throw Error('Invalid card');
    if(c.replacesSourceId!==undefined&&!/^\d{7,8}$/.test(c.replacesSourceId))throw Error('Invalid relist');
    if(c.property){
      const p=c.property;
      if(p.source?.provider!=='centris'||p.source.id!==c.sourceId||p.source.brokerId!=='e6356'||p.mode!=='broker'
        ||!new RegExp(`^https://www\\.centris\\.ca/fr/[^?#]+/${c.sourceId}$`).test(p.source.url)
        ||p.price!==c.price||p.rentPrice!==c.rentPrice||p.transaction!==c.transaction||p.taxExtra!==c.taxExtra
        ||!['house','condo','plex','commercial','land','hotel-motel','daycare','business'].includes(p.type))throw Error('Invalid property');
      for(const key of ['title','city','district','postal','description'])if(typeof p[key]!=='string'||p[key].length>3000)throw Error('Invalid property text');
      for(const lang of ['fr','en','zh'])if(typeof p.descriptionTranslations?.[lang]!=='string'||!p.descriptionTranslations[lang]||p.descriptionTranslations[lang].length>3000)throw Error('Invalid translations');
      for(const key of ['beds','baths','area','lotArea','parkingSpaces'])if(p[key]!==null&&(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<0))throw Error('Invalid property fact');
      if(p.coordinates&&(p.title==='Adresse non publiée'||p.source.locationStatus==='unverified'||p.coordinates.source!=='centris'||!Number.isFinite(p.coordinates.latitude)||!Number.isFinite(p.coordinates.longitude)||p.coordinates.latitude<44||p.coordinates.latitude>63||p.coordinates.longitude< -80||p.coordinates.longitude> -57))throw Error('Invalid coordinates');
      if(!c.replacesSourceId&&(!Array.isArray(c.photoPaths)||c.photoPaths.length<1||c.photoPaths.length>100||new Set(c.photoPaths).size!==c.photoPaths.length||c.photoPaths.some(path=>!new RegExp(`^/centris/${c.sourceId}/[0-9]{3}\\.webp$`).test(path))))throw Error('Invalid photo paths');
    }
  }
  return s;
}
