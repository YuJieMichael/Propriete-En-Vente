import { useEffect, useRef, useState } from 'react';
import {daycareLabels} from './property-categories';
import { ChevronDown, ImageOff, RefreshCw } from 'lucide-react';
import type { Language } from './seller-copy';
import { supabase } from './lib/supabase';
import { publicationCopy } from './publication-copy';
import { publicListingsEnabled } from './lib/public-listings';
import type { PublicProperty } from '../../supabase/functions/_shared/listing-input';
import {listingsCopy} from './listings-copy';
import type {PropertyType} from './listings-data';
import './publication.css';
import {isImportedPhotoPath} from './lib/imported-listings';
import {ListingHistory,listingActionsCopy} from './listing-review-history';
import {cardPhotoSources,fallBackToFullPhoto} from './lib/card-photo';
import {PhotoViewer} from './property-gallery';

type Submission = {
  id: string;
  listing_number: number;
  property: Omit<PublicProperty,"type"> & {type:PropertyType;transaction?:string;source?:{id:string;placeholder:boolean};};
  contact: { name: string; email: string; phone: string };
  photo_paths: string[];
  video_path: string | null;
  status: 'pending' | 'published' | 'rejected';
  revision: number;
  review_note: string;
};
type SignedCache = { paths: string[]; urls: string[]; signedAt: number };
const money = (value: number, lang: Language) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : `${lang}-CA`, {style: 'currency', currency: 'CAD', maximumFractionDigits: 0}).format(value);

// Mounted only inside AdminPage's staff + MFA guard. Database repeats both checks.
export function ListingReview({ lang, scope = 'all' }: { lang: Language; scope?: 'all' | 'seller' | 'published' }) {
  const c = publicationCopy[lang];
  const a = listingActionsCopy[lang];
  const [confirmation,setConfirmation]=useState<{row:Submission;decision:'published'|'rejected'}|null>(null);
  const [reason,setReason]=useState('');
  const [actionMessage,setActionMessage]=useState('');
  const [actionError,setActionError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const [rows, setRows] = useState<Submission[]>([]);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // One listing open at a time keeps the list short on phones.
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{row: Submission; index: number; opener: HTMLElement} | null>(null);
  const active = useRef(true);
  const locked = useRef(false);
  const inFlight = useRef(false);
  const pendingRefresh = useRef(false);
  const hasLoaded = useRef(false);
  const photoCache = useRef(new Map<string, SignedCache>());
  const videoCache = useRef(new Map<string, SignedCache>());

  useEffect(()=>{
    if(confirmation){dialog.current?.showModal();}
    else returnFocus.current?.focus();
  },[confirmation]);
  useEffect(()=>{
    if(!confirmation||busy)return;
    const latest=rows.find(row=>row.id===confirmation.row.id);
    if(latest&&(latest.revision!==confirmation.row.revision||latest.status!==confirmation.row.status)){
      setConfirmation(null);setActionError(a.changed);
    }
  },[rows,confirmation,busy,a.changed]);
  function askReview(row:Submission,decision:'published'|'rejected'){
    returnFocus.current=document.activeElement as HTMLElement;
    setReason(notes[row.id]??'');setActionMessage('');setActionError('');setConfirmation({row:{...row},decision});
  }

  async function refresh() {
    if (!supabase || !publicListingsEnabled) return;
    if (inFlight.current) { pendingRefresh.current = true; return; }
    inFlight.current = true;
    if (!hasLoaded.current && active.current) setLoading(true);
    try {
      let query = supabase.from('listing_submissions')
        .select('id,listing_number,property,contact,photo_paths,video_path,status,revision,review_note')
        .neq('status', 'uploading');
      if (scope === 'seller') query = query.neq('status', 'published');
      if (scope === 'published') query = query.eq('status', 'published');
      const result = await query
        .order('created_at', { ascending: false })
        .limit(50);
      if (result.error) throw result.error;
      const next = (result.data || []) as Submission[];
      const now = Date.now();
      const nextPhotos: Record<string, string[]> = {};
      const nextVideos: Record<string, string> = {};
      const nextPhotoCache = new Map<string, SignedCache>();
      const nextVideoCache = new Map<string, SignedCache>();

      await Promise.all(next.map(async row => {
        const cached = photoCache.current.get(row.id);
        const canReuse = cached && cached.signedAt + 240_000 > now
          && cached.paths.length === row.photo_paths.length
          && cached.paths.every((path, index) => path === row.photo_paths[index]);
        if (canReuse) {
          nextPhotos[row.id] = cached.urls;
          nextPhotoCache.set(row.id, cached);
          return;
        }
        const urls = await Promise.all(row.photo_paths.map(async path => {
          if(isImportedPhotoPath(path))return path;
          const signed = await supabase!.storage.from('listing-photos').createSignedUrl(path, 300);
          if (signed.error) throw signed.error;
          return signed.data.signedUrl;
        }));
        nextPhotos[row.id] = urls;
        nextPhotoCache.set(row.id, { paths: row.photo_paths, urls, signedAt: now });
      }));

      await Promise.all(next.filter(row => row.video_path).map(async row => {
        const path = row.video_path!;
        const cached = videoCache.current.get(row.id);
        if (cached && cached.paths[0] === path && cached.signedAt + 240_000 > now) {
          nextVideos[row.id] = cached.urls[0];
          nextVideoCache.set(row.id, cached);
          return;
        }
        const signed = await supabase!.storage.from('listing-videos').createSignedUrl(path, 300);
        if (signed.error) throw signed.error;
        const urls = [signed.data.signedUrl];
        nextVideos[row.id] = urls[0];
        nextVideoCache.set(row.id, { paths: [path], urls, signedAt: now });
      }));

      if (active.current) {
        photoCache.current = nextPhotoCache;
        videoCache.current = nextVideoCache;
        setRows(next);
        setPhotos(nextPhotos);
        setVideos(nextVideos);
        setError(false);
        hasLoaded.current = true;
      }
    } catch {
      // Keep the last successful list visible during a temporary network failure.
      if (active.current) setError(true);
    } finally {
      inFlight.current = false;
      if (active.current) setLoading(false);
      if (pendingRefresh.current) {
        pendingRefresh.current = false;
        if (active.current && document.visibilityState === 'visible') void refresh();
      }
    }
  }

  useEffect(() => {
    active.current = true;
    void refresh();
    const onFocus = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  async function review(row: Submission, decision: 'published' | 'rejected') {
    if (!supabase || locked.current) return;
    const note=reason.trim();if(decision==='rejected'&&!note)return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await supabase.rpc('review_listing', {
        p_id: row.id,
        p_revision: row.revision,
        p_decision: decision,
        p_note: note,
      });
      if (result.error) throw result.error;
      setConfirmation(null);setNotes(current=>({...current,[row.id]:note}));setActionMessage(a.saved);
      await refresh();
    } catch {
      if (active.current) {setConfirmation(null);setActionError(a.failed);}
      await refresh();
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  if (!publicListingsEnabled) return <div className="admin-panel"><h2>{c.review}</h2><p>{c.setup}</p></div>;
  return (
    <div className="admin-panel listing-review">
      <div className="listing-review-heading">
        <h2>{scope === 'published' ? ({fr: 'Annonces publiées', en: 'Published listings', zh: '已发布房源'}[lang]) : c.review}</h2>
        <p><RefreshCw aria-hidden="true" size={15} />{c.autoRefresh}</p>
      </div>
      {error && <p role="alert">{c.actionError}</p>}
      {actionError&&<p role="alert">{actionError}</p>}
      {actionMessage&&<p role="status">{actionMessage}</p>}
      {loading && <p role="status">{c.loading}</p>}
      {!rows.length && !loading && !error && <p>{scope === 'published' ? ({fr: 'Aucune annonce publiée.', en: 'No published listings.', zh: '暂无已发布房源。'}[lang]) : c.empty}</p>}
      {rows.map(row => {
        const parking = row.property.parkingSpaces
          ? `${row.property.parkingSpaces} ${c.parkingSpace}`
          : row.property.parking ? c.parking : c.noParking;
        const open = openId === row.id, cover = photos[row.id]?.[0];
        const status = row.status === 'published' ? c.success : row.status === 'pending' ? c.pending : c.rejected;
        const month = row.property.transaction === 'rent' ? {fr: '/mois', en: '/month', zh: '/月'}[lang] : '';
        return (
          <article key={row.id} className={open ? 'is-open' : undefined}>
            <h3 className="listing-review-row">
              <button type="button" className="listing-review-summary" aria-expanded={open} aria-controls={`listing-review-${row.id}`} onClick={() => setOpenId(open ? null : row.id)}>
                {cover
                  ? <img src={cover} {...cardPhotoSources(cover, '72px')} alt="" loading="lazy" onError={event => { fallBackToFullPhoto(event.currentTarget, cover); }} />
                  : <span className="listing-review-thumb" aria-hidden="true"><ImageOff /></span>}
                <span>
                  <strong>{row.property.title}</strong>
                  <span>{row.property.city} · {money(row.property.price, lang)}{month}</span>
                  <span><span className={`listing-review-status is-${row.status}`}>{status}</span> · {c.reference} {row.listing_number}</span>
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
            </h3>
            {open && <div id={`listing-review-${row.id}`} className="listing-review-detail">
              <p>{c.postal}: {row.property.postal || '—'}</p>
              <ListingHistory id={row.id} revision={row.revision} lang={lang}/>
              <p className="publication-description">{row.property.description}</p>
              <p>{c.type}: {listingsCopy[lang].types[row.property.type]}{row.property.daycareSubsidy?` · ${daycareLabels[lang][row.property.daycareSubsidy]}`:''} · {c.beds}: {row.property.beds??"—"} · {c.baths}: {row.property.baths??"—"} · {c.area}: {row.property.area??"—"}</p>
              <p>{c.mode}: {row.property.mode === 'broker' ? c.broker : c.hybrid} · {parking}{row.property.streetParking ? ` · ${c.streetParking}` : ''} · {row.property.outdoor ? c.outdoor : ''}</p>
              <div className="publication-photos">{(photos[row.id] || []).map((src, i) => <button type="button" key={src} onClick={event => setViewer({row, index: i, opener: event.currentTarget})}><img src={src} alt={`${c.photos} ${i + 1}`} loading="lazy" /></button>)}</div>
              {videos[row.id] && <video src={videos[row.id]} controls playsInline preload="metadata" />}
              <h4>{c.private}</h4>
              <p>{row.contact.name} · {row.contact.email} · {row.contact.phone}</p>
              <label>{c.note}<textarea maxLength={2000} value={notes[row.id] ?? row.review_note} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))} /></label>
              <div className="publication-actions">
                {row.status !== 'published' && <button disabled={busy} onClick={() => askReview(row, 'published')}>{row.status==='rejected'?a.restore:c.approve}</button>}
                {row.status !== 'rejected' && <button className="listing-destructive" disabled={busy} onClick={() => askReview(row, 'rejected')}>{row.status === 'published' ? c.withdraw : c.reject}</button>}
              </div>
            </div>}
          </article>
        );
      })}
      {viewer && !!photos[viewer.row.id]?.length && <PhotoViewer images={photos[viewer.row.id]} start={Math.min(viewer.index, photos[viewer.row.id].length - 1)} title={viewer.row.property.title} lang={lang} opener={viewer.opener} onClose={() => setViewer(null)} />}
      {confirmation&&<dialog ref={dialog} className="listing-confirm-dialog" aria-labelledby="listing-confirm-title" aria-describedby="listing-confirm-hint" onCancel={event=>{event.preventDefault();if(!busy)setConfirmation(null);}}>
        <form onSubmit={event=>{event.preventDefault();void review(confirmation.row,confirmation.decision);}}>
          <h2 id="listing-confirm-title">{confirmation.decision==='rejected'?(confirmation.row.status==='published'?a.withdrawTitle:a.rejectTitle):(confirmation.row.status==='rejected'?a.restoreTitle:a.publishTitle)}</h2>
          <p className="listing-confirm-property"><strong>{confirmation.row.property.title}</strong><span>{c.reference}: {confirmation.row.listing_number} · {confirmation.row.property.city}</span></p>
          <p id="listing-confirm-hint">{confirmation.decision==='rejected'?a.withdrawHint:a.publishHint}</p>
          <label>{confirmation.decision==='rejected'?a.required:a.optional}<textarea autoFocus required={confirmation.decision==='rejected'} maxLength={2000} disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/></label>
          <div className="publication-actions"><button type="button" disabled={busy} onClick={()=>setConfirmation(null)}>{a.cancel}</button><button type="submit" className={confirmation.decision==='rejected'?'listing-destructive':''} disabled={busy||(confirmation.decision==='rejected'&&!reason.trim())}>{busy?a.saving:confirmation.decision==='rejected'?(confirmation.row.status==='published'?a.confirmWithdraw:a.confirmReject):(confirmation.row.status==='rejected'?a.confirmRestore:a.confirmPublish)}</button></div>
        </form>
      </dialog>}
    </div>
  );
}
