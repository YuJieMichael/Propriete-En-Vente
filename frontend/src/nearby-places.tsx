import {useEffect, useState} from 'react';
import {ChevronDown, Cross, GraduationCap, Pill, ShoppingBasket, TrainFront, Trees} from 'lucide-react';
import type {Language} from './seller-copy';
import './nearby-places.css';
import {loadNearby, nearbyCategories, type NearbyCategory, type NearbyFile} from './lib/nearby';

const copy = {
  en: {
    show: 'What’s nearby?', intro: 'The closest everyday places in the area.',
    categories: {transit: 'Metro, REM or train', grocery: 'Grocery store', school: 'School', pharmacy: 'Pharmacy', park: 'Park', health: 'Clinic or hospital'},
    empty: 'No nearby places have been recorded for this property yet.', loading: 'Looking up nearby places…', error: 'Nearby places are unavailable right now.', retry: 'Try again',
    approximate: 'The pin is approximate.', credit: 'Map data © OpenStreetMap contributors. Coverage can be incomplete; check on site.',
  },
  fr: {
    show: 'Qu’y a-t-il à proximité ?', intro: 'Les lieux du quotidien les plus proches dans le secteur.',
    categories: {transit: 'Métro, REM ou train', grocery: 'Épicerie', school: 'École', pharmacy: 'Pharmacie', park: 'Parc', health: 'Clinique ou hôpital'},
    empty: 'Aucun lieu à proximité n’est encore répertorié pour cette propriété.', loading: 'Recherche des lieux à proximité…', error: 'Les lieux à proximité sont indisponibles pour le moment.', retry: 'Réessayer',
    approximate: 'L’emplacement est indicatif.', credit: 'Données cartographiques © les contributeurs d’OpenStreetMap. La couverture peut être incomplète; vérifiez sur place.',
  },
  zh: {
    show: '附近有什么？', intro: '这一带最近的日常场所。',
    categories: {transit: '地铁、REM 或火车站', grocery: '超市', school: '学校', pharmacy: '药房', park: '公园', health: '诊所或医院'},
    empty: '这套房源暂时还没有周边信息。', loading: '正在查找周边场所…', error: '暂时无法获取周边信息。', retry: '重试',
    approximate: '地图位置仅供参考。', credit: '地图数据 © OpenStreetMap 贡献者。数据可能不完整，请实地核实。',
  },
};
const icons: Record<NearbyCategory, typeof TrainFront> = {transit: TrainFront, grocery: ShoppingBasket, school: GraduationCap, pharmacy: Pill, park: Trees, health: Cross};

/** Closed until the visitor asks; then lists the nearest place of each kind by name. */
export function NearbyPlaces({reference, approximate, lang}: {reference: string; approximate: boolean; lang: Language}) {
  const c = copy[lang];
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{summary?: NearbyFile | null; error?: boolean}>({});
  useEffect(() => {
    if (!open) return;
    let active = true;
    setState({});
    loadNearby(reference).then(summary => { if (active) setState({summary}); }, () => { if (active) setState({error: true}); });
    return () => { active = false; };
  }, [open, reference, attempt]);
  const places = state.summary ? nearbyCategories.flatMap(kind => state.summary!.places[kind] ? [{kind, name: state.summary!.places[kind]!.name}] : []) : [];
  return <section className="nearby-places">
    <button type="button" className="nearby-toggle" aria-expanded={open} aria-controls="nearby-places-body" onClick={() => setOpen(value => !value)}>{c.show}<ChevronDown aria-hidden="true"/></button>
    {open && <div id="nearby-places-body" aria-busy={state.summary === undefined && !state.error}>
      {state.error ? <p role="alert">{c.error} <button type="button" onClick={() => setAttempt(n => n + 1)}>{c.retry}</button></p>
        : state.summary === undefined ? <p className="nearby-loading" role="status">{c.loading}</p>
        : !places.length ? <p className="nearby-intro">{c.empty}</p>
        : <>
          <p className="nearby-intro">{c.intro}{approximate && ` ${c.approximate}`}</p>
          <ul className="nearby-list">{places.map(({kind, name}) => {
            const Icon = icons[kind];
            return <li key={kind}><Icon aria-hidden="true"/><span><strong>{c.categories[kind]}</strong><span className="nearby-name">{name}</span></span></li>;
          })}</ul>
          <p className="nearby-credit">{c.credit}</p>
        </>}
    </div>}
  </section>;
}
