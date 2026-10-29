import {useEffect, useRef, useState} from 'react';
import {BusFront, Cross, GraduationCap, Pill, ShoppingBasket, TrainFront, Trees} from 'lucide-react';
import type {Language} from './seller-copy';
import './nearby-places.css';
import {busRadius, loadNearby, nearbyCategories, nearbyRadius, walkingMinutes, type NearbyCategory, type NearbyFile} from './lib/nearby';

const copy = {
  en: {
    title: 'Around this property', intro: (km: string) => `The closest everyday places within ${km} km, as the crow flies.`,
    categories: {transit: 'Metro, REM or train', grocery: 'Grocery store', school: 'School', pharmacy: 'Pharmacy', park: 'Park', health: 'Clinic or hospital'},
    bus: (n: number) => n ? `${n} bus ${n === 1 ? 'stop' : 'stops'} within ${busRadius} m` : `No bus stop within ${busRadius} m`,
    none: 'None found nearby', walk: (minutes: number) => `about ${minutes} min walk`, loading: 'Looking up nearby places…', error: 'Nearby places are unavailable right now.', retry: 'Try again',
    approximate: 'The pin is approximate, so distances are too.', credit: (date: string) => `Map data © OpenStreetMap contributors, checked ${date}. Coverage can be incomplete; check on site.`,
  },
  fr: {
    title: 'Autour de la propriété', intro: (km: string) => `Les lieux du quotidien les plus proches dans un rayon de ${km} km, à vol d’oiseau.`,
    categories: {transit: 'Métro, REM ou train', grocery: 'Épicerie', school: 'École', pharmacy: 'Pharmacie', park: 'Parc', health: 'Clinique ou hôpital'},
    bus: (n: number) => n ? `${n} arrêt${n === 1 ? '' : 's'} d’autobus à moins de ${busRadius} m` : `Aucun arrêt d’autobus à moins de ${busRadius} m`,
    none: 'Aucun à proximité', walk: (minutes: number) => `environ ${minutes} min à pied`, loading: 'Recherche des lieux à proximité…', error: 'Les lieux à proximité sont indisponibles pour le moment.', retry: 'Réessayer',
    approximate: 'L’emplacement est indicatif; les distances le sont aussi.', credit: (date: string) => `Données cartographiques © les contributeurs d’OpenStreetMap, vérifiées le ${date}. La couverture peut être incomplète; vérifiez sur place.`,
  },
  zh: {
    title: '周边生活', intro: (km: string) => `${km} 公里内最近的日常场所（直线距离）。`,
    categories: {transit: '地铁、REM 或火车站', grocery: '超市', school: '学校', pharmacy: '药房', park: '公园', health: '诊所或医院'},
    bus: (n: number) => n ? `${busRadius} 米内有 ${n} 个公交站` : `${busRadius} 米内没有公交站`,
    none: '附近未找到', walk: (minutes: number) => `步行约 ${minutes} 分钟`, loading: '正在查找周边场所…', error: '暂时无法获取周边信息。', retry: '重试',
    approximate: '地图位置仅供参考，距离也是估算。', credit: (date: string) => `地图数据 © OpenStreetMap 贡献者，查询日期 ${date}。数据可能不完整，请实地核实。`,
  },
};
const icons: Record<NearbyCategory, typeof TrainFront> = {transit: TrainFront, grocery: ShoppingBasket, school: GraduationCap, pharmacy: Pill, park: Trees, health: Cross};

export function NearbyPlaces({reference, approximate, lang}: {reference: string; approximate: boolean; lang: Language}) {
  const c = copy[lang];
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{summary?: NearbyFile | null; error?: boolean}>({});
  // Fetch only once the visitor reaches this part of the page.
  useEffect(() => {
    const node = section.current;
    if (!node || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, {rootMargin: '200px'});
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setState({});
    loadNearby(reference).then(summary => { if (active) setState({summary}); }, () => { if (active) setState({error: true}); });
    return () => { active = false; };
  }, [visible, reference, attempt]);
  if (state.summary === null) return null;
  const kilometres = (value: number) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : `${lang}-CA`, {maximumFractionDigits: 1}).format(value);
  const number = (metres: number) => metres < 1000 ? `${metres} m` : `${kilometres(metres / 1000)} km`;
  return <section ref={section} className="nearby-places" aria-labelledby="nearby-places-title" aria-busy={!state.summary && !state.error}>
    <h3 id="nearby-places-title">{c.title}</h3>
    <p className="nearby-intro">{c.intro(kilometres(nearbyRadius / 1000))}{approximate && ` ${c.approximate}`}</p>
    {state.error ? <p role="alert">{c.error} <button type="button" onClick={() => setAttempt(n => n + 1)}>{c.retry}</button></p>
      : !state.summary ? <p className="nearby-loading" role="status">{c.loading}</p>
      : <>
        <ul className="nearby-list">{nearbyCategories.map(kind => {
          const place = state.summary!.places[kind], Icon = icons[kind];
          return <li key={kind} className={place ? undefined : 'is-empty'}><Icon aria-hidden="true"/><span><strong>{c.categories[kind]}</strong>{place ? <><span className="nearby-name">{place.name}</span><small>{number(place.distance)} · {c.walk(walkingMinutes(place.distance))}</small></> : <small>{c.none}</small>}</span></li>;
        })}
          <li className={state.summary.busStops ? undefined : 'is-empty'}><BusFront aria-hidden="true"/><span><strong>{c.bus(state.summary.busStops)}</strong></span></li>
        </ul>
        <p className="nearby-credit">{c.credit(state.summary.checked)}</p>
      </>}
  </section>;
}
