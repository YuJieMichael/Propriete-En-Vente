import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowRight,CheckCircle2,EyeOff,MessageSquare,Search,ShieldCheck} from 'lucide-react';
import {useAuth} from './auth';
import type {Language} from './seller-copy';
import {wantedCopy} from './wanted-board-copy';
import {wantedCities,wantedTypes,validWantedCriteria,wantedRpc,wantedError,type WantedCard,type WantedCriteria,type MyWantedCard,type WantedReply} from './lib/wanted-board';
import './wanted-board.css';

const initialCriteria:WantedCriteria={propertyType:'condo',city:'Montréal',budgetMin:0,budgetMax:500000,beds:null,parking:null,transaction:'sale',timeline:'flexible'};
type Feedback={kind:'success'|'error';key:keyof typeof wantedCopy.en}|null;
const locale=(lang:Language)=>lang==='fr'?'fr-CA':lang==='en'?'en-CA':'zh-CN';
function TextFeedback({value,lang}:{value:Feedback;lang:Language}){return value?<p className={`wanted-feedback ${value.kind}`} role={value.kind==='error'?'alert':'status'}>{String(wantedCopy[lang][value.key])}</p>:null;}

export function WantedCardDetails({card,lang,children}:{card:WantedCriteria&Partial<WantedCard>;lang:Language;children?:ReactNode}){
  const t=wantedCopy[lang];
  const money=(n:number)=>new Intl.NumberFormat(locale(lang),{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
  return <article className="wanted-card">
    <div className="wanted-card-top"><span>{card.transaction==='rent'?t.rent:t.sale}</span><span><EyeOff size={15} aria-hidden="true"/>{t.anonymous}</span></div>
    <h3>{t.types[card.propertyType]} · {card.city}</h3>
    <p className="wanted-budget">{money(card.budgetMin)} – {money(card.budgetMax)}{card.transaction==='rent'&&<small> · {t.monthly}</small>}</p>
    <dl className="wanted-criteria">
      <div><dt>{t.timeline}</dt><dd>{t.times[card.timeline]}</dd></div>
      {card.beds!==null&&<div><dt>{t.beds}</dt><dd>{card.beds}</dd></div>}
      {card.parking!==null&&<div><dt>{t.parking}</dt><dd>{card.parking?t.yes:t.no}</dd></div>}
      {card.expiresAt&&<div><dt>{t.expiry}</dt><dd>{new Date(card.expiresAt).toLocaleDateString(locale(lang))}</dd></div>}
    </dl>{children}
  </article>;
}

function PrivateReplies({requestId,lang}:{requestId:string;lang:Language}){
  const t=wantedCopy[lang];const [rows,setRows]=useState<WantedReply[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{let active=true;setLoading(true);void wantedRpc<WantedReply[]>('list_wanted_replies',{p_request_id:requestId}).then(data=>{if(active){setRows(data||[]);setError(false);}}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[requestId]);
  return <div className="wanted-replies"><p className="wanted-private-note"><ShieldCheck size={16} aria-hidden="true"/>{t.private} · {t.latest}</p>
    {loading?<p>{t.loading}</p>:error?<p role="alert">{t.error}</p>:!rows.length?<p>{t.noReplies}</p>:rows.map(reply=><div className="wanted-reply" key={reply.id}>
      <time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString(locale(lang))}</time><p>{reply.message}</p>
      {reply.listingNumber&&<a href={`/${lang}/proprietes/${reply.listingNumber}/`}>{t.viewListing} #{reply.listingNumber}<ArrowRight size={15} aria-hidden="true"/></a>}
    </div>)}
  </div>;
}

function ReplyForm({card,lang,onClose,onSent}:{card:WantedCard;lang:Language;onClose:()=>void;onSent:()=>void}){
  const t=wantedCopy[lang];const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState<Feedback>(null);
  const {user}=useAuth();const account=useRef(user?.id),alive=useRef(true);account.current=user?.id;
  const id=useRef(crypto.randomUUID()),inFlight=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(inFlight.current)return;const data=new FormData(event.currentTarget);
    inFlight.current=true;setBusy(true);setFeedback(null);const submittedBy=account.current;
    try{await wantedRpc('send_wanted_reply',{p_id:id.current,p_request_id:card.id,p_message:String(data.get('message')||'').trim(),p_listing_number:String(data.get('listing')||'').trim()||null});if(alive.current&&submittedBy===account.current)onSent();}
    catch(error){if(alive.current&&submittedBy===account.current)setFeedback({kind:'error',key:wantedError(error)});}finally{inFlight.current=false;if(alive.current)setBusy(false);}
  }
  return <form className="wanted-reply-form" onSubmit={submit} onChange={()=>{if(!inFlight.current)id.current=crypto.randomUUID();}}>
    <h4>{t.replyTitle}</h4><p>{t.messageHint}</p>
    <label>{t.message}<textarea name="message" required minLength={10} maxLength={1500} rows={4} disabled={busy}/></label>
    <label>{t.listing}<input name="listing" inputMode="numeric" pattern="[0-9]{1,12}" maxLength={12} disabled={busy}/><small>{t.listingHint}</small></label>
    <TextFeedback lang={lang} value={feedback}/><div className="wanted-actions"><button type="submit" disabled={busy}>{busy?t.saving:t.send}</button><button className="wanted-secondary" type="button" disabled={busy} onClick={onClose}>{t.cancel}</button></div>
  </form>;
}

export function WantedBoard({lang}:{lang:Language}){
  const t=wantedCopy[lang];const {user,loading:authLoading}=useAuth();const verified=!!user?.email_confirmed_at;
  const [tab,setTab]=useState<'public'|'mine'|'sent'>('public'),[rows,setRows]=useState<WantedCard[]>([]),[mine,setMine]=useState<MyWantedCard[]>([]),[sent,setSent]=useState<WantedReply[]>([]);
  const [city,setCity]=useState(''),[type,setType]=useState(''),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState<Feedback>(null),[createOpen,setCreateOpen]=useState(false);
  const [criteria,setCriteria]=useState<WantedCriteria>({...initialCriteria}),[consent,setConsent]=useState(false),[replying,setReplying]=useState<string|null>(null),[viewReplies,setViewReplies]=useState<string|null>(null),[withdraw,setWithdraw]=useState<string|null>(null);
  const generation=useRef(0),requestId=useRef(crypto.randomUUID()),inFlight=useRef(false),activeAccount=useRef<string|undefined>(undefined);
  const [privateAccount,setPrivateAccount]=useState<string|undefined>(undefined);
  const userId=user?.id;
  activeAccount.current=userId;
  const load=useCallback(async()=>{
    const version=++generation.current;setLoading(true);
    try{
      const [publicRows,ownRows,sentRows]=await Promise.all([
        wantedRpc<WantedCard[]>('list_wanted_requests',{p_offset:offset,p_city:city||null,p_type:type||null}),
        verified?wantedRpc<MyWantedCard[]>('get_my_wanted_requests'):Promise.resolve([]),
        verified?wantedRpc<WantedReply[]>('list_wanted_replies',{p_request_id:null}):Promise.resolve([]),
      ]);
      if(generation.current!==version)return;
      setRows((publicRows||[]).slice(0,30));setMore((publicRows||[]).length>30);setMine(ownRows||[]);setSent(sentRows||[]);setPrivateAccount(userId);
    }catch{if(generation.current===version)setFeedback({kind:'error',key:'error'});}
    finally{if(generation.current===version)setLoading(false);}
  },[offset,city,type,verified,userId]);
  useEffect(()=>{setMine([]);setSent([]);setViewReplies(null);setReplying(null);setFeedback(null);void load();return()=>{generation.current++;};},[load]);
  useEffect(()=>{setTab('public');setCreateOpen(false);setConsent(false);setCriteria({...initialCriteria});setWithdraw(null);requestId.current=crypto.randomUUID();},[userId]);
  function changeCriteria(next:Partial<WantedCriteria>){setCriteria(current=>({...current,...next,...(next.propertyType&&!['house','condo','plex'].includes(next.propertyType)?{beds:null}:{})}));requestId.current=crypto.randomUUID();setConsent(false);}
  async function create(event:FormEvent){
    event.preventDefault();if(inFlight.current)return;
    if(!validWantedCriteria(criteria)||!consent){setFeedback({kind:'error',key:'invalid'});return;}
    inFlight.current=true;setBusy(true);setFeedback(null);const account=userId;
    try{await wantedRpc('create_wanted_request',{p_id:requestId.current,p_card:criteria,p_consent:consent});if(account!==activeAccount.current)return;setCreateOpen(false);setTab('mine');setConsent(false);setCriteria({...initialCriteria});requestId.current=crypto.randomUUID();setFeedback({kind:'success',key:'saved'});await load();}
    catch(error){if(account===activeAccount.current)setFeedback({kind:'error',key:wantedError(error)});}finally{inFlight.current=false;setBusy(false);}
  }
  async function withdrawCard(id:string){
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setFeedback(null);const account=userId;
    try{await wantedRpc('withdraw_wanted_request',{p_id:id});if(account!==activeAccount.current)return;setWithdraw(null);setFeedback({kind:'success',key:'withdrawn'});await load();}
    catch(error){if(account===activeAccount.current)setFeedback({kind:'error',key:wantedError(error)});}finally{inFlight.current=false;setBusy(false);}
  }
  const visibleMine=privateAccount===userId?mine:[],visibleSent=privateAccount===userId?sent:[];
  const ownIds=new Set(visibleMine.map(card=>card.id));
  return <section className="wanted-page" aria-labelledby="wanted-title">
    <header className="wanted-hero"><div className="wanted-hero-symbol"><Search aria-hidden="true"/></div><p className="wanted-eyebrow">{t.eyebrow}</p><h1 id="wanted-title">{t.title}</h1><p>{t.intro}</p><div className="wanted-privacy"><ShieldCheck aria-hidden="true"/><span>{t.privacy}</span></div></header>
    {!authLoading&&!verified&&<div className="wanted-signin"><p>{user?t.verify:t.signin}</p><a href="#login">{t.login}<ArrowRight size={16} aria-hidden="true"/></a></div>}
    <div className="wanted-toolbar"><div className="wanted-tabs" role="group" aria-label={t.title}>{(['public','mine','sent'] as const).filter(key=>key==='public'||verified).map(key=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>{setTab(key);setCreateOpen(false);setFeedback(null);}}>{t[key]}</button>)}</div><div className="wanted-actions"><button className="wanted-secondary" type="button" onClick={()=>void load()} disabled={loading||busy}>{t.refresh}</button>{verified&&<button type="button" onClick={()=>{setCreateOpen(open=>!open);setFeedback(null);}}>{createOpen?t.cancel:t.create}</button>}</div></div>
    <TextFeedback value={feedback} lang={lang}/>
    {createOpen&&verified&&<section className="wanted-create"><h2>{t.create}</h2><form onSubmit={create}>
      <div className="wanted-form-grid"><label>{t.type}<select value={criteria.propertyType} onChange={e=>changeCriteria({propertyType:e.target.value as WantedCriteria['propertyType']})} disabled={busy}>{wantedTypes.map(value=><option key={value} value={value}>{t.types[value]}</option>)}</select></label>
        <label>{t.city}<select value={criteria.city} onChange={e=>changeCriteria({city:e.target.value})} disabled={busy}>{wantedCities.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>{t.transaction}<select value={criteria.transaction} onChange={e=>changeCriteria({transaction:e.target.value as 'sale'|'rent'})} disabled={busy}><option value="sale">{t.sale}</option><option value="rent">{t.rent}</option></select></label>
        <label>{t.timeline}<select value={criteria.timeline} onChange={e=>changeCriteria({timeline:e.target.value as WantedCriteria['timeline']})} disabled={busy}>{Object.entries(t.times).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>{t.min}<input type="number" min={0} max={1000000000} step={1} required value={criteria.budgetMin} onChange={e=>changeCriteria({budgetMin:Number(e.target.value)})} disabled={busy}/></label>
        <label>{t.max}<input type="number" min={1} max={1000000000} step={1} required value={criteria.budgetMax} onChange={e=>changeCriteria({budgetMax:Number(e.target.value)})} disabled={busy}/></label>
        {['house','condo','plex'].includes(criteria.propertyType)&&<label>{t.beds}<select value={criteria.beds??''} onChange={e=>changeCriteria({beds:e.target.value===''?null:Number(e.target.value)})} disabled={busy}><option value="">{t.any}</option>{Array.from({length:21},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>}
        <label>{t.parking}<select value={criteria.parking===null?'':String(criteria.parking)} onChange={e=>changeCriteria({parking:e.target.value===''?null:e.target.value==='true'})} disabled={busy}><option value="">{t.any}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></label></div>
      {criteria.transaction==='rent'&&<p>{t.monthly}</p>}<h3>{t.preview}</h3><WantedCardDetails card={criteria} lang={lang}/>
      <label className="wanted-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required disabled={busy}/><span>{t.consent}</span></label><p className="wanted-note">{t.limits}</p><button type="submit" disabled={busy||!consent}>{busy?t.saving:t.submit}</button>
    </form></section>}
    {tab==='public'&&<div className="wanted-filters"><label>{t.city}<select value={city} onChange={e=>{setCity(e.target.value);setOffset(0);}}><option value="">{t.all}</option>{wantedCities.map(value=><option key={value}>{value}</option>)}</select></label><label>{t.type}<select value={type} onChange={e=>{setType(e.target.value);setOffset(0);}}><option value="">{t.all}</option>{wantedTypes.map(value=><option key={value} value={value}>{t.types[value]}</option>)}</select></label></div>}
    {loading?<p className="wanted-empty" role="status">{t.loading}</p>:tab==='public'?<><div className="wanted-grid">{rows.length?rows.map(card=><WantedCardDetails key={card.id} card={card} lang={lang}>{verified&&!ownIds.has(card.id)&&<div className="wanted-card-actions">{replying===card.id?<ReplyForm card={card} lang={lang} onClose={()=>setReplying(null)} onSent={()=>{setReplying(null);setFeedback({kind:'success',key:'replySaved'});void load();}}/>:<button type="button" onClick={()=>{setReplying(card.id);setFeedback(null);}}><MessageSquare size={16} aria-hidden="true"/>{t.reply}</button>}</div>}</WantedCardDetails>):<p className="wanted-empty">{t.empty}</p>}</div><nav className="wanted-pagination" aria-label={t.public}><button className="wanted-secondary" type="button" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-30))}>{t.previous}</button><button className="wanted-secondary" type="button" disabled={!more} onClick={()=>setOffset(n=>n+30)}>{t.next}</button></nav></>:verified&&tab==='mine'?<><p className="wanted-note">{t.replyNote} {t.history}</p><div className="wanted-grid">{visibleMine.length?visibleMine.map(card=><WantedCardDetails key={card.id} card={card} lang={lang}><span className={`wanted-status ${card.status}`}>{t.status[card.status]}</span>{card.reviewNote&&<p>{t.noteLabel}: {card.reviewNote}</p>}<div className="wanted-card-actions"><button type="button" className="wanted-secondary" onClick={()=>setViewReplies(viewReplies===card.id?null:card.id)}>{t.responses} ({card.replyCount})</button>{!['withdrawn','expired'].includes(card.status)&&<button className="wanted-secondary" type="button" disabled={busy} onClick={()=>setWithdraw(card.id)}>{t.withdraw}</button>}</div>{withdraw===card.id&&<div className="wanted-confirm"><p>{t.withdrawConfirm}</p><div className="wanted-actions"><button type="button" disabled={busy} onClick={()=>void withdrawCard(card.id)}>{t.confirmWithdraw}</button><button className="wanted-secondary" type="button" disabled={busy} onClick={()=>setWithdraw(null)}>{t.cancel}</button></div></div>}{viewReplies===card.id&&<PrivateReplies key={`${userId}-${card.id}`} requestId={card.id} lang={lang}/>}</WantedCardDetails>):<p className="wanted-empty">{t.mineEmpty}</p>}</div></>:verified&&<><p className="wanted-note">{t.latest}</p><div className="wanted-grid">{visibleSent.length?visibleSent.map(reply=><WantedCardDetails key={reply.id} card={reply.card} lang={lang}><div className="wanted-reply"><span className="wanted-status"><CheckCircle2 size={15} aria-hidden="true"/>{t.private}</span><p>{reply.message}</p><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString(locale(lang))}</time>{reply.listingNumber&&<a href={`/${lang}/proprietes/${reply.listingNumber}/`}>{t.viewListing} #{reply.listingNumber}</a>}</div></WantedCardDetails>):<p className="wanted-empty">{t.sentEmpty}</p>}</div></>}
  </section>;
}

export function WantedReview({lang}:{lang:Language}){
  const t=wantedCopy[lang],{adminVerified,user}=useAuth();
  const [status,setStatus]=useState<'pending'|'published'|'rejected'|'withdrawn'>('pending'),[offset,setOffset]=useState(0),[rows,setRows]=useState<MyWantedCard[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[notes,setNotes]=useState<Record<string,string>>({}),[replyId,setReplyId]=useState<string|null>(null),[feedback,setFeedback]=useState<Feedback>(null);
  const generation=useRef(0),inFlight=useRef(false);
  const activeAccount=useRef(user?.id);activeAccount.current=user?.id;
  const load=useCallback(async()=>{const version=++generation.current;setLoading(true);if(!adminVerified){setRows([]);setLoading(false);return;}try{const result=await wantedRpc<MyWantedCard[]>('list_wanted_review',{p_status:status,p_offset:offset});if(generation.current!==version)return;setRows((result||[]).slice(0,30));setMore((result||[]).length>30);}catch{if(generation.current===version)setFeedback({kind:'error',key:'error'});}finally{if(generation.current===version)setLoading(false);}},[adminVerified,user?.id,status,offset]);
  useEffect(()=>{setRows([]);setReplyId(null);setFeedback(null);void load();return()=>{generation.current++;};},[load]);
  useEffect(()=>{setNotes({});},[user?.id]);
  async function review(card:MyWantedCard,decision:'published'|'rejected'){
    if(inFlight.current)return;inFlight.current=true;setBusy(card.id);setFeedback(null);const account=user?.id;
    try{await wantedRpc('review_wanted_request',{p_id:card.id,p_revision:card.revision,p_decision:decision,p_note:notes[card.id]??''});if(account!==activeAccount.current)return;setFeedback({kind:'success',key:'reviewed'});await load();}catch(error){if(account===activeAccount.current){setFeedback({kind:'error',key:wantedError(error)});await load();}}finally{inFlight.current=false;setBusy(null);}
  }
  if(!adminVerified)return <section className="wanted-review"><h2>{t.review}</h2><p>{t.staff}</p></section>;
  return <section className="wanted-review"><h2>{t.review}</h2><div className="wanted-toolbar"><div className="wanted-tabs" role="group" aria-label={t.review}>{(['pending','published','rejected','withdrawn'] as const).map(value=><button key={value} type="button" aria-pressed={status===value} onClick={()=>{setStatus(value);setOffset(0);}}>{t.status[value]}</button>)}</div><button className="wanted-secondary" type="button" disabled={loading||!!busy} onClick={()=>void load()}>{t.refresh}</button></div><TextFeedback value={feedback} lang={lang}/>
    {loading?<p>{t.loading}</p>:<div className="wanted-grid">{rows.length?rows.map(card=><WantedCardDetails key={card.id} card={card} lang={lang}><span className={`wanted-status ${card.status}`}>{t.status[card.status]}</span>{card.reviewNote&&<p>{t.noteLabel}: {card.reviewNote}</p>}{card.status!=='withdrawn'&&<><label>{t.note}<textarea maxLength={1000} rows={2} value={notes[card.id]??''} disabled={!!busy} onChange={e=>setNotes(all=>({...all,[card.id]:e.target.value}))}/></label><div className="wanted-actions">{card.status==='pending'&&<button type="button" disabled={!!busy||new Date(card.expiresAt).getTime()<=Date.now()} onClick={()=>void review(card,'published')}>{t.approve}</button>}<button className="wanted-secondary" type="button" disabled={!!busy} onClick={()=>void review(card,'rejected')}>{t.reject}</button></div></>}<button className="wanted-secondary" type="button" onClick={()=>setReplyId(replyId===card.id?null:card.id)}>{t.responses} ({card.replyCount})</button>{replyId===card.id&&<PrivateReplies key={`${user?.id}-${card.id}`} requestId={card.id} lang={lang}/>}</WantedCardDetails>):<p className="wanted-empty">{t.mineEmpty}</p>}</div>}
    <nav className="wanted-pagination" aria-label={t.review}><button className="wanted-secondary" type="button" disabled={offset===0||loading} onClick={()=>setOffset(n=>Math.max(0,n-30))}>{t.previous}</button><button className="wanted-secondary" type="button" disabled={!more||loading} onClick={()=>setOffset(n=>n+30)}>{t.next}</button></nav>
  </section>;
}
