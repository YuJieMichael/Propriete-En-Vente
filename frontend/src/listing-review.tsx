import { useEffect, useRef, useState } from 'react';
import type { Language } from './seller-copy';
import { supabase, verifyAccountPassword } from './lib/supabase';
import { publicationCopy } from './publication-copy';
import { publicListingsEnabled } from './lib/public-listings';
import type { PublicProperty } from '../../supabase/functions/_shared/listing-input';
import './publication.css';

type Submission = {
  id: string; property: PublicProperty; contact: { name: string; email: string; phone: string };
  photo_paths: string[]; video_path: string | null; status: 'pending' | 'published' | 'rejected';
  revision: number; review_note: string;
};

// Mounted only inside AdminPage's staff + MFA guard. Database repeats both checks.
export function ListingReview({ lang, refreshKey = 0, email = '' }: { lang: Language; refreshKey?: number; email?: string }) {
  const c = publicationCopy[lang];
  const [rows, setRows] = useState<Submission[]>([]);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const active = useRef(true);
  const locked = useRef(false);

  async function refresh() {
    if (!supabase || !publicListingsEnabled) return;
    setError(false); setBusy(true);
    try {
      const result = await supabase.from('listing_submissions').select('id,property,contact,photo_paths,video_path,status,revision,review_note').neq('status', 'uploading').order('created_at', { ascending: false }).limit(100);
      if (result.error) throw result.error;
      const next = (result.data || []) as Submission[];
      const images: Record<string, string[]> = {}, clips: Record<string, string> = {};
      for (const row of next) images[row.id] = await Promise.all(row.photo_paths.map(async path => {
        const signed = await supabase!.storage.from('listing-photos').createSignedUrl(path, 300);
        if (signed.error) throw signed.error;
        return signed.data.signedUrl;
      }));
      for (const row of next) if (row.video_path) {
        const signed = await supabase.storage.from('listing-videos').createSignedUrl(row.video_path, 300);
        if (signed.error) throw signed.error;
        clips[row.id] = signed.data.signedUrl;
      }
      if (active.current) { setRows(next); setPhotos(images); setVideos(clips); }
    } catch {
      if (active.current) { setRows([]); setPhotos({}); setVideos({}); setError(true); }
    } finally { if (active.current) setBusy(false); }
  }

  useEffect(() => {
    active.current = true; void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !locked.current) void refresh();
    }, 30000);
    return () => { active.current = false; window.clearInterval(timer); };
  }, [refreshKey]);

  async function review(row: Submission, decision: 'published' | 'rejected') {
    if (!supabase || locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    try {
      const result = await supabase.rpc('review_listing', { p_id: row.id, p_revision: row.revision, p_decision: decision, p_note: notes[row.id] || '' });
      if (result.error) throw result.error;
      await refresh();
    } catch { if (active.current) setError(true); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }

  async function withdraw(row: Submission) {
    if (!email || !password.trim() || !supabase) return;
    setBusy(true); setPasswordError(false);
    try {
      if (!await verifyAccountPassword(email, password)) { setPasswordError(true); return; }
      setWithdrawId(null); setPassword('');
      await review(row, 'rejected');
    } catch { setPasswordError(true); }
    finally { if (active.current) setBusy(false); }
  }

  if (!publicListingsEnabled) return <div className="admin-panel"><h2>{c.review}</h2><p>{c.setup}</p></div>;
  return <div className="admin-panel listing-review">
    <h2>{c.review}</h2>
    {error && <p role="alert">{c.actionError}</p>}
    {!rows.length && !busy && <p>{c.empty}</p>}
    {busy && <p role="status">{c.loading}</p>}
    {rows.map(row => <article key={row.id}>
      <h3>{row.property.title}</h3>
      <p>{row.property.city} · {row.property.postal} · {row.property.price} CAD</p>
      <p>{c.status}: {row.status === 'published' ? c.success : row.status === 'pending' ? c.pending : c.rejected}</p>
      <p>{c.reference}: {row.id}</p>
      <p className="publication-description">{row.property.description}</p>
      <p>{c.type}: {c.types[['house', 'condo', 'plex', 'commercial'].indexOf(row.property.type)]} · {c.beds}: {row.property.beds} · {c.baths}: {row.property.baths} · {c.area}: {row.property.area}</p>
      <p>{c.mode}: {row.property.mode === 'broker' ? c.broker : c.hybrid} · {row.property.parking ? c.parking : ''} · {row.property.outdoor ? c.outdoor : ''}</p>
      <div className="publication-photos">{(photos[row.id] || []).map((src, i) => <img src={src} key={src} alt={`${c.photos} ${i + 1}`} />)}</div>
      {videos[row.id] && <video src={videos[row.id]} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 420 }} />}
      <h4>{c.private}</h4><p>{row.contact.name} · {row.contact.email} · {row.contact.phone}</p>
      <label>{c.note}<textarea maxLength={2000} value={notes[row.id] ?? row.review_note} onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))} /></label>
      <div className="publication-actions">
        {row.status === 'pending' && <button disabled={busy} onClick={() => void review(row, 'published')}>{c.approve}</button>}
        {row.status !== 'rejected' && <button disabled={busy} onClick={() => row.status === 'published' ? (setWithdrawId(row.id), setPassword(''), setPasswordError(false)) : void review(row, 'rejected')}>{row.status === 'published' ? c.withdraw : c.reject}</button>}
      </div>
      {withdrawId === row.id && <div className="withdraw-confirm">
        <label>{c.passwordConfirm}<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={c.passwordPlaceholder} /></label>
        <small>{email}</small>
        {passwordError && <p role="alert">{c.passwordInvalid}</p>}
        <div className="publication-actions">
          <button disabled={busy || !password.trim()} onClick={() => void withdraw(row)}>{c.withdraw}</button>
          <button disabled={busy} onClick={() => { setWithdrawId(null); setPassword(''); setPasswordError(false); }}>{c.passwordCancel}</button>
        </div>
      </div>}
    </article>)}
  </div>;
}
