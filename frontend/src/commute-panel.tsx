import {useState} from 'react';
import {Crosshair, LocateFixed, MapPinned, X} from 'lucide-react';
import type {Language} from './seller-copy';
import {commuteChoices, type Anchor} from './lib/commute';
import './commute-panel.css';

const copy = {
  en: {title: 'Commute range', intro: 'Set where you work or study to see the properties within a drive time.', pick: 'Pick on the map', picking: 'Click the map where you work or study…', locate: 'Use my location', clear: 'Clear', within: 'Within', minutes: (n: number) => `${n} min`, locating: 'Finding your location…', denied: 'Your location is unavailable. Pick a point on the map instead.',
    note: 'Drive times are estimates from straight-line distance, not live traffic or routes. Your location stays in this browser.', count: (n: number, m: number) => `${n} ${n === 1 ? 'property' : 'properties'} within about ${m} min by car`, away: (km: string, m: number) => `${km} km · about ${m} min`},
  fr: {title: 'Temps de trajet', intro: 'Indiquez votre lieu de travail ou d’études pour voir les propriétés à une certaine durée en voiture.', pick: 'Choisir sur la carte', picking: 'Cliquez sur la carte à l’endroit de votre travail ou de vos études…', locate: 'Utiliser ma position', clear: 'Effacer', within: 'À moins de', minutes: (n: number) => `${n} min`, locating: 'Recherche de votre position…', denied: 'Votre position n’est pas disponible. Choisissez plutôt un point sur la carte.',
    note: 'Les durées sont estimées d’après la distance à vol d’oiseau, sans circulation ni itinéraire réels. Votre position reste dans ce navigateur.', count: (n: number, m: number) => `${n} propriété${n === 1 ? '' : 's'} à environ ${m} min en voiture`, away: (km: string, m: number) => `${km} km · environ ${m} min`},
  zh: {title: '通勤范围', intro: '设置您的工作或上学地点，看看开车一定时间内能到的房源。', pick: '在地图上选点', picking: '请在地图上点击您的工作或上学地点…', locate: '使用我的位置', clear: '清除', within: '车程', minutes: (n: number) => `${n} 分钟内`, locating: '正在获取您的位置…', denied: '无法获取您的位置，请改为在地图上选点。',
    note: '车程按直线距离估算，未考虑实时路况和实际路线。您的位置只保存在本浏览器中。', count: (n: number, m: number) => `开车约 ${m} 分钟内有 ${n} 套房源`, away: (km: string, m: number) => `${km} 公里 · 约 ${m} 分钟`},
};
export const commuteCopy = copy;

type Props = {lang: Language; anchor: Anchor | null; minutes: number; picking: boolean; onPicking: (value: boolean) => void; onAnchor: (anchor: Anchor | null) => void; onMinutes: (minutes: number) => void};
export function CommutePanel({lang, anchor, minutes, picking, onPicking, onAnchor, onMinutes}: Props) {
  const c = copy[lang];
  const [status, setStatus] = useState<'' | 'locating' | 'denied'>('');
  function locate() {
    if (!navigator.geolocation) { setStatus('denied'); return; }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(position => { setStatus(''); onPicking(false); onAnchor({latitude: position.coords.latitude, longitude: position.coords.longitude}); }, () => setStatus('denied'), {enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000});
  }
  return <section className="commute-panel" aria-labelledby="commute-title">
    <div className="commute-heading"><MapPinned aria-hidden="true"/><div><h3 id="commute-title">{c.title}</h3><p>{picking ? c.picking : c.intro}</p></div></div>
    <div className="commute-actions">
      <button type="button" aria-pressed={picking} onClick={() => onPicking(!picking)}><Crosshair aria-hidden="true"/>{c.pick}</button>
      <button type="button" onClick={locate}><LocateFixed aria-hidden="true"/>{c.locate}</button>
      {anchor && <button type="button" className="commute-clear" onClick={() => { onAnchor(null); onPicking(false); setStatus(''); }}><X aria-hidden="true"/>{c.clear}</button>}
    </div>
    {anchor && <div className="commute-minutes" role="group" aria-label={c.within}><span>{c.within}</span>{commuteChoices.map(choice =>
      <button key={choice} type="button" aria-pressed={minutes === choice} onClick={() => onMinutes(choice)}>{c.minutes(choice)}</button>)}</div>}
    {status && <p className="commute-status" role="status">{status === 'locating' ? c.locating : c.denied}</p>}
    <p className="commute-note">{c.note}</p>
  </section>;
}
