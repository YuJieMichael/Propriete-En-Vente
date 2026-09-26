import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Language } from './seller-copy';

export const buyerInboxCopy = {
  en: { title:'Buyer enquiries', hint:'Requests update automatically every 30 seconds. Email summaries are sent in batches of 10 when email delivery is configured.', loading:'Loading…', error:'Could not load enquiries. Please retry or verify your administrator access.', empty:'No buyer enquiries yet.', refresh:'Refresh enquiries', previous:'Previous', next:'Next', date:'Submitted', name:'Name', email:'Email', phone:'Phone', city:'Preferred cities', min:'Minimum budget (CAD)', max:'Maximum budget (CAD)', propertyType:'Property type', requirements:'Requirements', timeline:'Timeline', contactLanguage:'Contact language', contactMethod:'Contact method', contactTime:'Contact availability', details:'View request', read:'Read', replied:'Replied', statusError:'Could not save the enquiry status. Please retry.', types:{house:'House',condo:'Condo',plex:'Plex',commercial:'Commercial'} },
  fr: { title:'Demandes d’achat', hint:'Les demandes sont actualisées automatiquement toutes les 30 secondes. Les récapitulatifs sont envoyés par lots de 10 lorsque le service courriel est configuré.', loading:'Chargement…', error:'Impossible de charger les demandes. Réessayez ou vérifiez votre accès administrateur.', empty:'Aucune demande d’achat pour le moment.', refresh:'Actualiser les demandes', previous:'Précédent', next:'Suivant', date:'Date de réception', name:'Nom', email:'Courriel', phone:'Téléphone', city:'Villes recherchées', min:'Budget minimum (CAD)', max:'Budget maximum (CAD)', propertyType:'Type de propriété', requirements:'Critères', timeline:'Échéancier', contactLanguage:'Langue de contact', contactMethod:'Moyen de contact', contactTime:'Disponibilités', details:'Voir la demande', read:'Lue', replied:'Répondu', statusError:'Impossible d’enregistrer le statut. Réessayez.', types:{house:'Maison',condo:'Condo',plex:'Plex',commercial:'Commercial'} },
  zh: { title:'买家咨询', hint:'咨询列表每 30 秒自动更新。配置发信服务后，每满 10 条另行发送邮件汇总。', loading:'正在加载…', error:'无法加载咨询，请重试或检查管理员验证状态。', empty:'目前还没有买家咨询。', refresh:'刷新咨询', previous:'上一页', next:'下一页', date:'提交时间', name:'姓名', email:'邮箱', phone:'电话', city:'意向城市', min:'最低预算（加元）', max:'最高预算（加元）', propertyType:'房屋类型', requirements:'购房要求', timeline:'计划时间', contactLanguage:'联系语言', contactMethod:'联系方式', contactTime:'方便联系的时间', details:'查看需求', read:'已读', replied:'已回复', statusError:'无法保存咨询状态，请重试。', types:{house:'独立屋',condo:'公寓',plex:'多户住宅',commercial:'商业地产'} },
};
type Status='unread'|'read'|'replied';
type Row={id:string;created_at:string;payload:Record<string,string>;status:Status};
export function BuyerEnquiries({lang,refreshKey=0}:{lang:Language;refreshKey?:number}) {
  const t=buyerInboxCopy[lang];
  const [rows,setRows]=useState<Row[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false),[statusError,setStatusError]=useState(false);
  const [updating,setUpdating]=useState<string[]>([]);
  const generation=useRef(0);
  const load=useCallback(async()=>{
    const version=++generation.current;setLoading(true);setError(false);setMore(false);
    try{
      if(!supabase)throw Error('unconfigured');
      const result=await supabase.rpc('list_buyer_enquiries',{p_offset:offset});
      if(version!==generation.current)return;
      if(result.error)throw result.error;
      const data=(result.data||[]) as Row[];setRows(data.slice(0,50).map(row=>({...row,status:row.status||'unread'})));setMore(data.length>50);
    }catch{if(version===generation.current)setError(true);}
    finally{if(version===generation.current)setLoading(false);}
  },[offset]);
  useEffect(()=>{void load();return()=>{generation.current++;};},[load,refreshKey]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);
    return()=>window.clearInterval(timer);
  },[load]);
  const date=(value:string)=>new Date(value).toLocaleString(lang==='fr'?'fr-CA':lang==='en'?'en-CA':'zh-CN');
  const value=(p:Row['payload'],key:string)=>{
    const v=p[key];if(!v)return '—';
    if(key==='propertyType')return t.types[v as keyof typeof t.types]||v;
    if(key==='contactLanguage')return ({en:'English',fr:'Français',zh:'中文'}[v]||v);
    if(key==='contactMethod')return v==='email'?t.email:v==='phone'?t.phone:v;
    return v;
  };
  const setStatus=async(row:Row,status:Status)=>{
    if(!supabase||updating.includes(row.id))return;
    setUpdating(ids=>[...ids,row.id]);setStatusError(false);
    try{
      const result=await supabase.rpc('set_buyer_enquiry_status',{p_id:row.id,p_status:status});
      if(result.error)throw result.error;
      setRows(current=>current.map(item=>item.id===row.id?{...item,status}:item));
    }catch{setStatusError(true);}
    finally{setUpdating(ids=>ids.filter(id=>id!==row.id));}
  };
  return <section className="admin-panel buyer-enquiries">
    <div className="buyer-enquiries-heading"><div><h2>{t.title}</h2><p>{t.hint}</p></div></div>
    {loading&&rows.length===0?<p role="status">{t.loading}</p>:error&&rows.length===0?<p role="alert">{t.error}</p>:rows.length===0?<p>{t.empty}</p>:<div className="buyer-enquiry-list">{rows.map(row=>(
      <article className={`buyer-enquiry-card${row.status!=='unread'?' is-read':''}`} key={row.id}>
        <div className="buyer-enquiry-topline">
          <div className="buyer-enquiry-person"><strong>{row.payload.name||'—'}</strong>{row.payload.email?<a href={`mailto:${row.payload.email}`}>{row.payload.email}</a>:<span>—</span>}<span>{value(row.payload,'phone')}</span></div>
          <div className="buyer-enquiry-location"><span>{t.city}</span><strong>{value(row.payload,'city')}</strong></div>
          <div className="buyer-enquiry-date"><span>{t.date}</span><strong>{date(row.created_at)}</strong></div>
          <div className="buyer-enquiry-status" aria-busy={updating.includes(row.id)}>
            <label><input type="checkbox" checked={row.status!=='unread'} disabled={updating.includes(row.id)} onChange={event=>void setStatus(row,event.target.checked?'read':'unread')}/>{t.read}</label>
            <label><input type="checkbox" checked={row.status==='replied'} disabled={updating.includes(row.id)} onChange={event=>void setStatus(row,event.target.checked?'replied':'read')}/>{t.replied}</label>
          </div>
          <details className="buyer-enquiry-details">
            <summary>{t.details}</summary>
            <dl className="buyer-enquiry-fields">{(['budgetMin','budgetMax','propertyType','requirements','timeline','contactLanguage','contactMethod','contactTime'] as const).map(key=><div key={key}><dt>{key==='budgetMin'?t.min:key==='budgetMax'?t.max:t[key]}</dt><dd>{value(row.payload,key)}</dd></div>)}</dl>
          </details>
        </div>
      </article>
    ))}</div>}
    {statusError&&<p className="buyer-enquiry-status-error" role="alert">{t.statusError}</p>}
    {error&&rows.length>0&&<p role="alert">{t.error}</p>}
    <div style={{display:'flex',gap:'1rem',marginTop:'1rem'}}><button className="admin-secondary" disabled={loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>{t.previous}</button><button className="admin-secondary" disabled={loading||!more||error} onClick={()=>setOffset(n=>n+50)}>{t.next}</button></div>
  </section>;
}
