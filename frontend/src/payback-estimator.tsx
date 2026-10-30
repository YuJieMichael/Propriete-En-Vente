import {useId, useState} from 'react';
import {ChevronDown, TrendingUp} from 'lucide-react';
import type {Language} from './seller-copy';
import type {Listing} from './listings-data';
import {daycareDays, daycareRevenue, hotelRevenue, payback, publishedCount} from './lib/payback';
import './payback-estimator.css';

const copy = {
  en: {
    title: 'Payback estimate', intro: 'Adjust the assumptions to see how quickly the asking price could be recovered from operating income.',
    rooms: 'Guest rooms', places: 'Places', nightly: 'Average nightly rate', daily: 'Revenue per place per day', occupancy: 'Occupancy', revenue: 'Annual revenue', expenses: 'Operating expenses',
    published: 'published', assumed: 'assumed', daycareOccupancy: 'Place utilization',
    gross: 'Revenue / year', net: 'Net operating income / year', cap: 'Capitalization rate', years: 'Payback', yearsValue: (n: string) => `${n} years`, none: 'Not recovered',
    note: `Illustration only, using your assumptions rather than the business's financial statements. Net income is before financing, depreciation and income tax. Ask for the confidential documents to check real revenue and expenses.`,
    daycareNote: `Daycare revenue uses ${daycareDays} open days a year.`,
  },
  fr: {
    title: 'Estimation du délai de récupération', intro: 'Ajustez les hypothèses pour voir en combien de temps le prix demandé pourrait être récupéré par le revenu d’exploitation.',
    rooms: 'Chambres', places: 'Places', nightly: 'Tarif moyen par nuit', daily: 'Revenu par place par jour', occupancy: 'Taux d’occupation', revenue: 'Revenu annuel', expenses: 'Dépenses d’exploitation',
    published: 'publié', assumed: 'hypothèse', daycareOccupancy: 'Taux d’occupation des places',
    gross: 'Revenu / an', net: 'Revenu net d’exploitation / an', cap: 'Taux de capitalisation', years: 'Récupération', yearsValue: (n: string) => `${n} ans`, none: 'Non récupéré',
    note: 'Illustration seulement, selon vos hypothèses et non les états financiers de l’entreprise. Le revenu net est avant financement, amortissement et impôt. Demandez les documents confidentiels pour vérifier les revenus et dépenses réels.',
    daycareNote: `Le revenu de la garderie compte ${daycareDays} jours d’ouverture par an.`,
  },
  zh: {
    title: '回本测算', intro: '调整下面的假设，看看按经营收入多少年能收回挂牌价。',
    rooms: '客房数', places: '名额', nightly: '平均房价（每晚）', daily: '每个名额每天收入', occupancy: '入住率', revenue: '年收入', expenses: '运营成本占收入',
    published: '已公开', assumed: '假设值', daycareOccupancy: '名额使用率',
    gross: '年收入', net: '年净经营收入', cap: '资本化率', years: '回本时间', yearsValue: (n: string) => `${n} 年`, none: '无法回本',
    note: '仅为示意，使用的是您的假设，不是企业的财务报表。净收入未扣除贷款利息、折旧和所得税。请申请保密资料核实真实收入和成本。',
    daycareNote: `托儿所收入按每年开放 ${daycareDays} 天计算。`,
  },
};

const locale = (lang: Language) => lang === 'zh' ? 'zh-CN' : `${lang}-CA`;
const money = (value: number, lang: Language) => new Intl.NumberFormat(locale(lang), {style: 'currency', currency: 'CAD', maximumFractionDigits: 0}).format(value);
const percent = (value: number, lang: Language, digits = 0) => new Intl.NumberFormat(locale(lang), {style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value);

type SliderProps = {label: string; value: number; min: number; max: number; step: number; display: string; badge?: string; onChange: (value: number) => void};
function Slider({label, value, min, max, step, display, badge, onChange}: SliderProps) {
  const id = useId();
  return <div className="payback-slider">
    <label htmlFor={id}>{label}{badge && <small>{badge}</small>}</label>
    <output htmlFor={id}>{display}</output>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}

export const paybackTypes = ['hotel-motel', 'daycare', 'business', 'commercial'];

export function PaybackEstimator({item, lang}: {item: Listing; lang: Language}) {
  const c = copy[lang];
  const feature = (key: string) => publishedCount(item.features?.find(f => f.key === key)?.value.en);
  const hotel = item.type === 'hotel-motel', daycare = item.type === 'daycare';
  const publishedUnits = hotel ? feature('guestRooms') : daycare ? feature('capacity') : null;
  const [units, setUnits] = useState(publishedUnits ?? (hotel ? 20 : 60));
  const [rate, setRate] = useState(hotel ? 120 : 60);
  const [occupancy, setOccupancy] = useState(hotel ? 0.6 : 0.95);
  const [annual, setAnnual] = useState(Math.round(item.price * 0.15 / 10_000) * 10_000);
  const [expenseRatio, setExpenseRatio] = useState(hotel ? 0.65 : daycare ? 0.8 : 0.6);
  if (!paybackTypes.includes(item.type) || item.transaction === 'rent' || !(item.price > 0)) return null;
  const revenue = hotel ? hotelRevenue(units, rate, occupancy) : daycare ? daycareRevenue(units, rate, occupancy) : annual;
  const result = payback({price: item.price, revenue, expenseRatio});
  const years = result.years === null ? c.none : c.yearsValue(new Intl.NumberFormat(locale(lang), {maximumFractionDigits: 1}).format(result.years));
  const badge = (published: boolean) => published ? c.published : c.assumed;
  return <details className="payback-disclosure">
    <summary className="payback-toggle"><TrendingUp aria-hidden="true" size={16}/>{c.title}<ChevronDown className="payback-chevron" aria-hidden="true" size={14}/></summary>
    <section className="detail-section payback-estimator">
    <h2><TrendingUp aria-hidden="true"/>{c.title}</h2>
    <p className="payback-intro">{c.intro}</p>
    <div className="payback-grid">
      <div className="payback-inputs">
        {(hotel || daycare) ? <>
          <Slider label={hotel ? c.rooms : c.places} badge={badge(publishedUnits === units)} value={units} min={1} max={Math.max(200, publishedUnits ?? 0)} step={1} display={String(units)} onChange={setUnits}/>
          <Slider label={hotel ? c.nightly : c.daily} badge={c.assumed} value={rate} min={hotel ? 40 : 20} max={hotel ? 400 : 150} step={hotel ? 5 : 1} display={money(rate, lang)} onChange={setRate}/>
          <Slider label={daycare ? c.daycareOccupancy : c.occupancy} badge={c.assumed} value={occupancy} min={0.2} max={1} step={0.01} display={percent(occupancy, lang)} onChange={setOccupancy}/>
        </> : <Slider label={c.revenue} badge={c.assumed} value={annual} min={0} max={Math.max(1_000_000, Math.round(item.price * 0.5))} step={5_000} display={money(annual, lang)} onChange={setAnnual}/>}
        <Slider label={c.expenses} badge={c.assumed} value={expenseRatio} min={0.2} max={0.95} step={0.01} display={percent(expenseRatio, lang)} onChange={setExpenseRatio}/>
      </div>
      <dl className="payback-results" aria-live="polite">
        <div><dt>{c.gross}</dt><dd>{money(result.revenue, lang)}</dd></div>
        <div><dt>{c.net}</dt><dd>{money(result.net, lang)}</dd></div>
        <div><dt>{c.cap}</dt><dd>{result.capRate === null ? '—' : percent(result.capRate, lang, 1)}</dd></div>
        <div className="payback-years"><dt>{c.years}</dt><dd>{years}</dd></div>
      </dl>
    </div>
    <p className="payback-note">{c.note}{daycare && ` ${c.daycareNote}`}</p>
    </section>
  </details>;
}
