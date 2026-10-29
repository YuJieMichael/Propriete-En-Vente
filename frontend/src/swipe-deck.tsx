import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {Heart, MapPin, RotateCcw, X} from 'lucide-react';
import type {Language} from './seller-copy';
import {readLibrary, toggleSaved} from './property-library';
import {cataloguePath} from './seo';
import './swipe-deck.css';

export type SwipeCard = {id: string; saveId: string; href: string; image: string; type: string; title: string; place: string; price: string; facts: string};
type Decision = {id: string; saveId: string; liked: boolean; addedToSaved: boolean};

const copy = {
  en: {label: 'Swipe through properties', hint: 'Swipe right to save, left to skip. Arrow keys work too.', skip: 'Skip', save: 'Save', undo: 'Undo', progress: (n: number, total: number) => `${n} of ${total}`, open: 'Open this property',
    doneTitle: 'You’ve seen them all', done: (n: number) => n ? `You saved ${n} ${n === 1 ? 'property' : 'properties'} in this round.` : 'You didn’t save any property in this round.', compare: 'Compare my picks', saved: 'See all saved properties', again: 'Start over', saveStamp: 'SAVE', skipStamp: 'SKIP'},
  fr: {label: 'Parcourir les propriétés en glissant', hint: 'Glissez à droite pour enregistrer, à gauche pour passer. Les flèches du clavier fonctionnent aussi.', skip: 'Passer', save: 'Enregistrer', undo: 'Annuler', progress: (n: number, total: number) => `${n} sur ${total}`, open: 'Ouvrir cette propriété',
    doneTitle: 'Vous avez tout vu', done: (n: number) => n ? `Vous avez enregistré ${n} propriété${n === 1 ? '' : 's'} dans cette ronde.` : 'Vous n’avez enregistré aucune propriété dans cette ronde.', compare: 'Comparer mes choix', saved: 'Voir toutes les propriétés enregistrées', again: 'Recommencer', saveStamp: 'J’AIME', skipStamp: 'PASSER'},
  zh: {label: '左右滑动浏览房源', hint: '右滑收藏，左滑跳过。也可以用键盘方向键。', skip: '跳过', save: '收藏', undo: '撤销', progress: (n: number, total: number) => `第 ${n} / ${total} 套`, open: '打开这套房源',
    doneTitle: '已经看完了', done: (n: number) => n ? `这一轮收藏了 ${n} 套房源。` : '这一轮没有收藏房源。', compare: '对比我选中的', saved: '查看全部收藏', again: '重新开始', saveStamp: '收藏', skipStamp: '跳过'},
};

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SwipeDeck({cards, lang, onCompare}: {cards: SwipeCard[]; lang: Language; onCompare: (ids: string[]) => void}) {
  const c = copy[lang];
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null);
  const drag = useRef<{x: number; y: number; pointer: number; moved: boolean} | null>(null);
  const deck = useRef<HTMLDivElement>(null);
  const index = decisions.length;
  const card = cards[index], next = cards[index + 1];
  useEffect(() => { setDecisions([]); }, [cards.map(card => card.id).join()]);

  function decide(liked: boolean) {
    if (!card || leaving) return;
    const addedToSaved = liked && !readLibrary().saved.includes(card.saveId);
    if (addedToSaved) toggleSaved(card.saveId);
    const record = () => { setDecisions(list => [...list, {id: card.id, saveId: card.saveId, liked, addedToSaved}]); setDx(0); setLeaving(null); };
    if (reducedMotion()) { record(); return; }
    setLeaving(liked ? 'right' : 'left');
    window.setTimeout(record, 220);
  }
  function undo() {
    const last = decisions.at(-1);
    if (!last || leaving) return;
    if (last.addedToSaved && readLibrary().saved.includes(last.saveId)) toggleSaved(last.saveId);
    setDecisions(list => list.slice(0, -1));
  }
  function down(event: ReactPointerEvent) {
    if (leaving || event.button !== 0) return;
    drag.current = {x: event.clientX, y: event.clientY, pointer: event.pointerId, moved: false};
  }
  function move(event: ReactPointerEvent) {
    const state = drag.current;
    if (!state || state.pointer !== event.pointerId) return;
    const x = event.clientX - state.x, y = event.clientY - state.y;
    // A mostly vertical gesture is a page scroll, not a swipe.
    if (!state.moved && Math.abs(y) > Math.abs(x) && Math.abs(y) > 8) { drag.current = null; setDx(0); return; }
    if (!state.moved && Math.abs(x) > 6) { state.moved = true; (event.currentTarget as Element).setPointerCapture?.(event.pointerId); }
    if (state.moved) setDx(x);
  }
  function up() {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    const threshold = Math.min(120, (deck.current?.clientWidth ?? 360) * 0.28);
    if (Math.abs(dx) >= threshold) decide(dx > 0); else setDx(0);
    // Swallow the click that ends a drag so the link does not open.
    const block = (click: Event) => { click.preventDefault(); click.stopPropagation(); };
    window.addEventListener('click', block, {capture: true, once: true});
    window.setTimeout(() => window.removeEventListener('click', block, {capture: true}), 0);
  }

  if (!cards.length) return null;
  const savedHere = decisions.filter(decision => decision.liked);
  const offset = leaving === 'right' ? 640 : leaving === 'left' ? -640 : dx;
  const strength = Math.min(1, Math.abs(offset) / 120);
  return <div className="swipe-deck" ref={deck} role="region" aria-label={c.label} tabIndex={0}
    onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); decide(true); } else if (event.key === 'ArrowLeft') { event.preventDefault(); decide(false); } else if (event.key === 'Backspace' || (event.key === 'z' && (event.metaKey || event.ctrlKey))) { event.preventDefault(); undo(); } }}>
    <p className="swipe-hint">{c.hint}</p>
    {card ? <>
      <div className="swipe-stack">
        {next && <div className="swipe-card is-next" aria-hidden="true"><img src={next.image} alt="" decoding="async"/></div>}
        <article key={card.id} className={`swipe-card${leaving ? ' is-leaving' : ''}${dx && !leaving ? ' is-dragging' : ''}`}
          style={{transform: `translateX(${offset}px) rotate(${offset / 22}deg)`}}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setDx(0); }}>
          <img src={card.image} alt="" draggable={false} decoding="async"/>
          <span className="swipe-stamp is-save" style={{opacity: offset > 0 ? strength : 0}} aria-hidden="true">{c.saveStamp}</span>
          <span className="swipe-stamp is-skip" style={{opacity: offset < 0 ? strength : 0}} aria-hidden="true">{c.skipStamp}</span>
          <div className="swipe-info">
            <span className="swipe-type">{card.type}</span>
            <h3><a href={card.href} draggable={false} aria-label={`${c.open} : ${card.title}`}>{card.title}</a></h3>
            <p><MapPin aria-hidden="true"/>{card.place}</p>
            {card.facts && <p className="swipe-facts">{card.facts}</p>}
            <strong>{card.price}</strong>
          </div>
        </article>
      </div>
      <div className="swipe-controls">
        <button type="button" className="swipe-skip" onClick={() => decide(false)} aria-label={c.skip}><X aria-hidden="true"/></button>
        <button type="button" className="swipe-undo" onClick={undo} disabled={!decisions.length} aria-label={c.undo}><RotateCcw aria-hidden="true"/></button>
        <button type="button" className="swipe-save" onClick={() => decide(true)} aria-label={c.save}><Heart aria-hidden="true"/></button>
      </div>
      <p className="swipe-progress" aria-live="polite">{c.progress(index + 1, cards.length)}</p>
    </> : <div className="swipe-done">
      <Heart aria-hidden="true"/>
      <h3>{c.doneTitle}</h3>
      <p>{c.done(savedHere.length)}</p>
      <div>
        {savedHere.length > 1 && <button type="button" className="swipe-primary" onClick={() => onCompare(savedHere.map(decision => decision.id))}>{c.compare}</button>}
        <a href={`${cataloguePath(lang)}?collection=saved`}>{c.saved}</a>
        <button type="button" onClick={() => setDecisions([])}>{c.again}</button>
      </div>
    </div>}
  </div>;
}
