import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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

// Mounted only inside AdminPage's staff + MFA guard. Database repeats both checks.
export function ListingReview({ lang }: { lang: Language }) {
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
      const result = await supabase.from('listing_submissions')
        .select('id,listing_number,property,contact,photo_paths,video_path,status,revision,review_note')
        .neq('status', 'uploading')
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
        <h2>{c.review}</h2>
        <p><RefreshCw aria-hidden="true" size={15} />{c.autoRefresh}</p>
      </div>
      {error && <p role="alert">{c.actionError}</p>}
      {actionError&&<p role="alert">{actionError}</p>}
      {actionMessage&&<p role="status">{actionMessage}</p>}
      {loading && <p role="status">{c.loading}</p>}
      {!rows.length && !loading && !error && <p>{c.empty}</p>}
      {rows.map(row => {
        const parking = row.property.parkingSpaces
          ? `${row.property.parkingSpaces} ${c.parkingSpace}`
          : row.property.parking ? c.parking : c.noParking;
        return (
          <article key={row.id}>
            <h3>{row.property.title}</h3>
            <p>{row.property.city} · {row.property.postal} · {row.property.price} CAD{row.property.transaction==='rent'?({fr:"/mois",en:"/month",zh:"/月"}[lang]):""}</p>
            <p>{c.status}: {row.status === 'published' ? c.success : row.status === 'pending' ? c.pending : c.rejected}</p>
            <p>{c.reference}: {row.listing_number}</p>
            <ListingHistory id={row.id} revision={row.revision} lang={lang}/>
            <p className="publication-description">{row.property.description}</p>
            <p>{c.type}: {listingsCopy[lang].types[row.property.type]} · {c.beds}: {row.property.beds??"—"} · {c.baths}: {row.property.baths??"—"} · {c.area}: {row.property.area??"—"}</p>
            <p>{c.mode}: {row.property.mode === 'broker' ? c.broker : c.hybrid} · {parking}{row.property.streetParking ? ` · ${c.streetParking}` : ''} · {row.property.outdoor ? c.outdoor : ''}</p>
            <div className="publication-photos">{(photos[row.id] || []).map((src, i) => <img src={src} key={src} alt={`${c.photos} ${i + 1}`} loading="lazy" />)}</div>
            {videos[row.id] && <video src={videos[row.id]} controls playsInline preload="metadata" />}
            <h4>{c.private}</h4>
            <p>{row.contact.name} · {row.contact.email} · {row.contact.phone}</p>
            <label>{c.note}<textarea maxLength={2000} value={notes[row.id] ?? row.review_note} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))} /></label>
            <div className="publication-actions">
              {row.status !== 'published' && <button disabled={busy} onClick={() => askReview(row, 'published')}>{row.status==='rejected'?a.restore:c.approve}</button>}
              {row.status !== 'rejected' && <button className="listing-destructive" disabled={busy} onClick={() => askReview(row, 'rejected')}>{row.status === 'published' ? c.withdraw : c.reject}</button>}
            </div>
          </article>
        );
      })}
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
