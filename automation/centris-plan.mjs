const address=value=>value.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export async function prepareSnapshot(snapshot,state,client){
  const rows=state.rows,active=new Set(snapshot.cards.map(c=>c.sourceId));
  const plan=structuredClone(snapshot);
  const newPhotos=[];
  for(let i=0;i<plan.cards.length;i++){
    let card=plan.cards[i];
    const existing=rows.find(r=>r.source_id===card.sourceId);
    if(!existing||card.transaction==='sale-rent'){
      const detail=await client.detail(card);
      card.rentPrice=detail.rentPrice;
      if(!existing){
        card.property=detail.property;
        const candidates=rows.filter(r=>!active.has(r.source_id)&&r.property.title!=='Adresse non publiée'
          &&address(r.property.title)===address(card.title)&&r.property.city===card.city&&r.property.transaction===card.transaction);
        if(candidates.length>1)throw Error('Ambiguous relist address; review required');
        if(candidates.length===1){card.replacesSourceId=candidates[0].source_id;
          // Retain existing photos and hand-reviewed facts on a source-ID replacement.
          card.property={...card.property,source:{...card.property.source,url:detail.property.source.url}};
        }else{
          card.photoPaths=detail.photos.map((_,index)=>`/centris/${card.sourceId}/${String(index+1).padStart(3,'0')}.webp`);
          detail.photos.forEach((url,index)=>newPhotos.push({url,path:card.photoPaths[index]}));
        }
      }
    }
  }
  const updates=plan.cards.filter(c=>{const r=rows.find(r=>r.source_id===c.sourceId);return r&&['price','rentPrice','taxExtra','transaction'].some(k=>(r.property[k]??null)!==c[k]);});
  const missing=rows.filter(r=>r.published&&!active.has(r.source_id)&&!plan.cards.some(c=>c.replacesSourceId===r.source_id));
  return {snapshot:plan,newPhotos,summary:{active:plan.total,new:plan.cards.filter(c=>!rows.some(r=>r.source_id===c.sourceId)&&!c.replacesSourceId).length,
    updated:updates.length,missing:missing.length,relisted:plan.cards.filter(c=>c.replacesSourceId).length}};
}
