import {useEffect,useRef,useState} from 'react';
import type {Language} from './seller-copy';
import {supabase} from './lib/supabase';

export const listingActionsCopy={
 fr:{history:'Historique des actions',empty:'Aucune action enregistrée.',error:'Impossible de charger l’historique.',retry:'Réessayer',more:'Voir les actions précédentes',actor:'Par',reason:'Motif',missing:'Non renseigné à l’époque',unknown:'Compte indisponible',published:'Publication',withdrawn:'Retrait du public',rejected:'Refus de publication',legacy:'Retrait ou refus (ancien enregistrement)',restored:'Remise en ligne',restore:'Remettre en ligne',withdrawTitle:'Retirer cette annonce du public ?',rejectTitle:'Refuser cette publication ?',publishTitle:'Publier cette annonce ?',restoreTitle:'Remettre cette annonce en ligne ?',withdrawHint:'L’annonce ne sera plus visible au public. Ses photos, sa description et son numéro seront conservés. Vous pourrez la remettre en ligne.',publishHint:'Les renseignements et les photos seront visibles sur le site public.',required:'Motif obligatoire',optional:'Note (facultative)',confirmWithdraw:'Confirmer le retrait',confirmReject:'Confirmer le refus',confirmPublish:'Confirmer la publication',confirmRestore:'Confirmer la remise en ligne',cancel:'Annuler',saving:'Enregistrement…',saved:'Action enregistrée dans l’historique.',failed:'Action non confirmée. Vérifiez l’état et l’historique avant de réessayer.',changed:'Cette annonce a changé. Vérifiez son nouvel état avant de confirmer à nouveau.'},
 en:{history:'Action history',empty:'No recorded actions.',error:'Could not load the history.',retry:'Retry',more:'Load earlier actions',actor:'By',reason:'Reason',missing:'Not recorded at the time',unknown:'Account unavailable',published:'Published',withdrawn:'Unpublished',rejected:'Publication declined',legacy:'Unpublished or declined (legacy record)',restored:'Republished',restore:'Republish',withdrawTitle:'Unpublish this listing?',rejectTitle:'Decline this publication?',publishTitle:'Publish this listing?',restoreTitle:'Republish this listing?',withdrawHint:'The listing will no longer be publicly visible. Its photos, description and reference will be kept. You can republish it later.',publishHint:'The details and photos will be visible on the public website.',required:'Reason (required)',optional:'Note (optional)',confirmWithdraw:'Confirm unpublish',confirmReject:'Confirm decline',confirmPublish:'Confirm publication',confirmRestore:'Confirm republish',cancel:'Cancel',saving:'Saving…',saved:'Action saved in the history.',failed:'Action not confirmed. Check its status and history before retrying.',changed:'This listing has changed. Check its latest status before confirming again.'},
 zh:{history:'操作历史',empty:'暂无操作记录。',error:'操作历史加载失败。',retry:'重试',more:'查看更早的记录',actor:'操作人',reason:'原因',missing:'当时未记录',unknown:'账号不可用',published:'发布',withdrawn:'下架',rejected:'不予发布',legacy:'下架或拒绝发布（旧记录）',restored:'重新上架',restore:'重新上架',withdrawTitle:'确认下架这条房源？',rejectTitle:'确认不予发布？',publishTitle:'确认发布这条房源？',restoreTitle:'确认重新上架？',withdrawHint:'确认后，公开网站将不再显示此房源。编号、图片和描述会保留，之后可以重新上架。',publishHint:'房源资料和图片将显示在公开网站上。',required:'原因（必填）',optional:'备注（选填）',confirmWithdraw:'确认下架',confirmReject:'确认不予发布',confirmPublish:'确认发布',confirmRestore:'确认重新上架',cancel:'取消',saving:'正在保存…',saved:'操作已保存，可在操作历史中查看。',failed:'操作未确认，请查看最新状态和操作历史后再重试。',changed:'房源状态已变化，请核对最新状态后重新确认。'}
};
type HistoryRow={id:string;created_at:string;action:string;actor:string|null;metadata:{note?:string;from_status?:string}};
export function ListingHistory({id,revision,lang}:{id:string;revision:number;lang:Language}){
 const t=listingActionsCopy[lang];
 const [open,setOpen]=useState(false),[rows,setRows]=useState<HistoryRow[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const request=useRef(0);
 useEffect(()=>{setOffset(0);setRows([]);},[revision]);
 useEffect(()=>{
  const version=++request.current;if(!open||!supabase)return;
  setLoading(true);setError(false);
  void (async()=>{try{const {data,error}=await supabase!.rpc('list_listing_history',{p_id:id,p_offset:offset});
   if(version!==request.current)return;
   if(error){setError(true);return;}
   const next=(data||[]) as HistoryRow[];setRows(current=>offset===0?next.slice(0,20):[...current,...next.slice(0,20)]);setMore(next.length>20);
  }catch{if(version===request.current)setError(true);}finally{if(version===request.current)setLoading(false);}})();
  return()=>{request.current++;};
 },[open,id,revision,offset,retry]);
 return <details className="listing-history" onToggle={event=>{setOpen(event.currentTarget.open);setOffset(0);}}>
  <summary>{t.history}</summary>
  {open&&<>{loading&&<p role="status">{t.saving}</p>}{error&&<p role="alert">{t.error} <button type="button" onClick={()=>setRetry(n=>n+1)}>{t.retry}</button></p>}
   {!loading&&!error&&!rows.length&&<p>{t.empty}</p>}
   <ol>{rows.map(row=><li key={row.id}><strong>{row.action==='listing_withdrawn'?t.withdrawn:row.action==='listing_restored'?t.restored:row.action==='listing_published'?t.published:row.metadata.from_status?t.rejected:t.legacy}</strong>
    <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString(lang==='zh'?'zh-CN':`${lang}-CA`,{timeZone:'America/Toronto',timeZoneName:'short'})}</time>
    <span>{t.actor}: {row.actor||t.unknown}</span><p>{t.reason}: {row.metadata.note||t.missing}</p></li>)}</ol>
   {more&&!error&&<button type="button" disabled={loading} onClick={()=>setOffset(rows.length)}>{t.more}</button>}
  </>}
 </details>;
}
