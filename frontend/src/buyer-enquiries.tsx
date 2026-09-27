import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Language } from './seller-copy';

export const buyerInboxCopy = {
  en: { title:'Buyer enquiries', hint:'Each request appears individually. Email summaries are sent in batches of 10 when email delivery is configured.', autoRefresh:'Updates automatically every 15 seconds and when you return to this page.', loading:'Loading…', error:'Could not sync enquiries. The system will retry automatically.', empty:'No buyer enquiries yet.', previous:'Previous', next:'Next', date:'Submitted', name:'Name', email:'Email', phone:'Phone', city:'Preferred cities', min:'Minimum budget (CAD)', max:'Maximum budget (CAD)', propertyType:'Property type', requirements:'Requirements', timeline:'Timeline', contactLanguage:'Contact language', contactMethod:'Contact method', contactTime:'Contact availability', details:'View request', types:{house:'House',condo:'Condo',plex:'Plex',commercial:'Commercial'} },
  fr: { title:'Demandes d’achat', hint:'Chaque demande apparaît individuellement. Les récapitulatifs sont envoyés par lots de 10 lorsque le service courriel est configuré.', autoRefresh:'Mise à jour automatique toutes les 15 secondes et à votre retour sur la page.', loading:'Chargement…', error:'Impossible de synchroniser les demandes. Une nouvelle tentative sera faite automatiquement.', empty:'Aucune demande d’achat pour le moment.', previous:'Précédent', next:'Suivant', date:'Date de réception', name:'Nom', email:'Courriel', phone:'Téléphone', city:'Villes recherchées', min:'Budget minimum (CAD)', max:'Budget maximum (CAD)', propertyType:'Type de propriété', requirements:'Critères', timeline:'Échéancier', contactLanguage:'Langue de contact', contactMethod:'Moyen de contact', contactTime:'Disponibilités', details:'Voir la demande', types:{house:'Maison',condo:'Condo',plex:'Plex',commercial:'Commercial'} },
  zh: { title:'买家咨询', hint:'每条咨询提交后即可查看。配置发信服务后，每满 10 条另行发送邮件汇总。', autoRefresh:'每 15 秒自动同步；返回此页面时也会立即更新。', loading:'正在加载…', error:'咨询暂时无法同步，系统会自动重试。', empty:'目前还没有买家咨询。', previous:'上一页', next:'下一页', date:'提交时间', name:'姓名', email:'邮箱', phone:'电话', city:'意向城市', min:'最低预算（加元）', max:'最高预算（加元）', propertyType:'房屋类型', requirements:'购房要求', timeline:'计划时间', contactLanguage:'联系语言', contactMethod:'联系方式', contactTime:'方便联系的时间', details:'查看需求', types:{house:'独立屋',condo:'公寓',plex:'多户住宅',commercial:'商业地产'} },
};
type Row={id:string;created_at:string;payload:Record<string,string>};
export function BuyerEnquiries({lang}:{lang:Language}) {
  const t=buyerInboxCopy[lang];
  const [rows,setRows]=useState<Row[]>([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false);
  const generation=useRef(0);
  const hasLoaded=useRef(false);
  const inFlight=useRef(false),pendingLoad=useRef(false);
  const loadLatest=useRef<()=>void>(()=>{});
  const load=useCallback(async()=>{
    if(inFlight.current){pendingLoad.current=true;return;}
    inFlight.current=true;const version=++generation.current;if(!hasLoaded.current)setLoading(true);setError(false);
    try{
      if(!supabase)throw Error('unconfigured');
      const result=await supabase.rpc('list_buyer_enquiries',{p_offset:offset});
      if(version!==generation.current)return;
      if(result.error)throw result.error;
      const data=(result.data||[]) as Row[];setRows(data.slice(0,50));setMore(data.length>50);hasLoaded.current=true;
    }catch{if(version===generation.current)setError(true);}
    finally{
      inFlight.current=false;
      if(version===generation.current)setLoading(false);
      if(pendingLoad.current){pendingLoad.current=false;if(document.visibilityState!=='hidden')loadLatest.current();}
    }
  },[offset]);
  loadLatest.current=()=>{void load();};
  useEffect(()=>{
    void load();
    const sync=()=>{if(document.visibilityState!=='hidden')void load();};
    const timer=window.setInterval(sync,15_000);
    window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);generation.current++;};
  },[load]);
  const date=(value:string)=>new Date(value).toLocaleString(lang==='fr'?'fr-CA':lang==='en'?'en-CA':'zh-CN');
  const value=(p:Row['payload'],key:string)=>{
    const v=p[key];if(!v)return '—';
    if(key==='propertyType')return t.types[v as keyof typeof t.types]||v;
    if(key==='contactLanguage')return ({en:'English',fr:'Français',zh:'中文'}[v]||v);
    if(key==='contactMethod')return v==='email'?t.email:v==='phone'?t.phone:v;
    return v;
  };
  return <section className="admin-panel buyer-enquiries">
    <div className="buyer-enquiries-heading">
      <div><h2>{t.title}</h2><p>{t.hint}</p><p className="admin-sync-note">{t.autoRefresh}</p></div>
    </div>
    {error&&<p role="alert">{t.error}</p>}
    {loading&&rows.length===0?<p role="status">{t.loading}</p>:rows.length===0&&!error?<p>{t.empty}</p>:rows.length>0?<div className="buyer-enquiry-list">{rows.map(row=>(
      <article className="buyer-enquiry-card" key={row.id}>
        <div className="buyer-enquiry-topline">
          <div className="buyer-enquiry-person"><strong>{row.payload.name||'—'}</strong>{row.payload.email?<a href={`mailto:${row.payload.email}`}>{row.payload.email}</a>:<span>—</span>}<span>{value(row.payload,'phone')}</span></div>
          <div className="buyer-enquiry-location"><span>{t.city}</span><strong>{value(row.payload,'city')}</strong></div>
          <div className="buyer-enquiry-date"><span>{t.date}</span><strong>{date(row.created_at)}</strong></div>
          <details className="buyer-enquiry-details">
            <summary>{t.details}</summary>
            <dl className="buyer-enquiry-fields">{(['budgetMin','budgetMax','propertyType','requirements','timeline','contactLanguage','contactMethod','contactTime'] as const).map(key=><div key={key}><dt>{key==='budgetMin'?t.min:key==='budgetMax'?t.max:t[key]}</dt><dd>{value(row.payload,key)}</dd></div>)}</dl>
          </details>
        </div>
      </article>
    ))}</div>:null}
    <div style={{display:'flex',gap:'1rem',marginTop:'1rem'}}><button className="admin-secondary" disabled={loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>{t.previous}</button><button className="admin-secondary" disabled={loading||!more||error} onClick={()=>setOffset(n=>n+50)}>{t.next}</button></div>
  </section>;
}
