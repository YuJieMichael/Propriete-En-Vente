import {useEffect, useId, useRef, useState} from 'react';
import {ArrowRight, Calculator} from 'lucide-react';
import type {Language} from './seller-copy';
import type {Listing} from './listings-data';
import {cataloguePath, welcomeTaxPath} from './seo';
import {taxScaleForCity, welcomeTax, welcomeTaxYear, type TaxScale} from './lib/welcome-tax';
import './welcome-tax.css';

const copy = {
  en: {
    card: 'Estimated welcome tax', cardNote: (scale: TaxScale) => scale === 'provincial' ? 'Provincial minimum scale; this municipality may charge more above $500,000.' : `${scale === 'montreal' ? 'Montréal' : 'Québec City'} ${welcomeTaxYear} scale, based on the asking price.`,
    details: 'See the brackets', open: 'Open the calculator',
    title: 'Québec welcome tax calculator', intro: `Estimate the property transfer duties (“welcome tax”) a buyer pays to the municipality, with the ${welcomeTaxYear} brackets for Montréal, Québec City and the provincial minimum.`,
    price: 'Purchase price', city: 'Municipality', cities: {montreal: 'Montréal', quebec: 'Québec City', provincial: 'Other municipality'},
    total: 'Estimated transfer duties', bracket: 'Bracket', rate: 'Rate', amount: 'Duties',
    notes: [
      'The tax base is the highest of the price paid, the consideration stipulated and the municipal assessment multiplied by the comparative factor.',
      'Duties are paid once, to the municipality, after the sale is registered. Some transfers, such as certain transfers between family members, are exempt.',
      'Outside Montréal and Québec City this uses the provincial minimum; many municipalities apply higher rates above $500,000. Confirm the amount with your notary.',
    ],
    browse: 'Browse properties for sale',
  },
  fr: {
    card: 'Taxe de bienvenue estimée', cardNote: (scale: TaxScale) => scale === 'provincial' ? 'Barème provincial minimal; cette municipalité peut exiger davantage au-delà de 500 000 $.' : `Barème ${welcomeTaxYear} de ${scale === 'montreal' ? 'Montréal' : 'la Ville de Québec'}, selon le prix demandé.`,
    details: 'Voir les tranches', open: 'Ouvrir le calculateur',
    title: 'Calculateur de taxe de bienvenue au Québec', intro: `Estimez les droits de mutation immobilière (« taxe de bienvenue ») que l’acheteur paie à la municipalité, avec les tranches ${welcomeTaxYear} de Montréal, de la Ville de Québec et le barème provincial minimal.`,
    price: 'Prix d’achat', city: 'Municipalité', cities: {montreal: 'Montréal', quebec: 'Ville de Québec', provincial: 'Autre municipalité'},
    total: 'Droits de mutation estimés', bracket: 'Tranche', rate: 'Taux', amount: 'Droits',
    notes: [
      'La base d’imposition est le plus élevé du prix payé, de la contrepartie stipulée et de l’évaluation municipale multipliée par le facteur comparatif.',
      'Les droits sont payés une seule fois à la municipalité, après l’inscription de la vente. Certains transferts, par exemple entre certains membres d’une famille, sont exonérés.',
      'Hors de Montréal et de la Ville de Québec, le calcul utilise le barème provincial minimal; plusieurs municipalités appliquent des taux plus élevés au-delà de 500 000 $. Confirmez le montant avec votre notaire.',
    ],
    browse: 'Voir les propriétés à vendre',
  },
  zh: {
    card: '预估欢迎税', cardNote: (scale: TaxScale) => scale === 'provincial' ? '按全省最低税率估算；该市对 50 万加元以上部分可能收得更高。' : `按${scale === 'montreal' ? '蒙特利尔' : '魁北克市'} ${welcomeTaxYear} 年税率和挂牌价估算。`,
    details: '查看分档明细', open: '打开计算器',
    title: '魁北克欢迎税计算器', intro: `估算买家向市政府缴纳的房产过户税（俗称“欢迎税”），使用蒙特利尔、魁北克市 ${welcomeTaxYear} 年分档税率和全省最低税率。`,
    price: '购买价格', city: '所在城市', cities: {montreal: '蒙特利尔', quebec: '魁北克市', provincial: '其他城市'},
    total: '预估过户税', bracket: '价格区间', rate: '税率', amount: '税额',
    notes: [
      '计税基数取以下最高者：实际成交价、合同约定的对价、市政评估值乘以比较系数。',
      '过户税在交易登记后一次性缴给市政府。部分转让（例如某些家庭成员之间的转让）可以免税。',
      '蒙特利尔和魁北克市以外按全省最低税率计算；不少城市对 50 万加元以上部分税率更高。具体金额请向公证人确认。',
    ],
    browse: '浏览在售房源',
  },
};

const locale = (lang: Language) => lang === 'zh' ? 'zh-CN' : `${lang}-CA`;
const money = (value: number, lang: Language, cents = false) => new Intl.NumberFormat(locale(lang), {style: 'currency', currency: 'CAD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0}).format(value);
const percent = (rate: number, lang: Language) => new Intl.NumberFormat(locale(lang), {style: 'percent', maximumFractionDigits: 1}).format(rate);

function Brackets({base, scale, lang}: {base: number; scale: TaxScale; lang: Language}) {
  const c = copy[lang];
  const {lines} = welcomeTax(base, scale);
  return <table className="welcome-tax-table"><thead><tr><th scope="col">{c.bracket}</th><th scope="col">{c.rate}</th><th scope="col">{c.amount}</th></tr></thead>
    <tbody>{lines.map(line => <tr key={line.from}><td>{money(line.from, lang)} – {money(line.to, lang)}</td><td>{percent(line.rate, lang)}</td><td>{money(line.amount, lang, true)}</td></tr>)}</tbody></table>;
}

export function welcomeTaxHref(lang: Language, price: number, city: string) {
  return `${welcomeTaxPath(lang)}?prix=${Math.round(price)}&ville=${taxScaleForCity(city)}`;
}

/** Shown on sale listings; rentals have no transfer duties. */
export function WelcomeTaxCard({item, lang}: {item: Listing; lang: Language}) {
  const c = copy[lang];
  if (item.transaction === 'rent' || !(item.price > 0)) return null;
  const scale = taxScaleForCity(item.city);
  const {total} = welcomeTax(item.price, scale);
  return <section className="detail-section welcome-tax-card">
    <h2><Calculator aria-hidden="true"/>{c.card}</h2>
    <p className="welcome-tax-total"><strong>{money(total, lang)}</strong></p>
    <p className="welcome-tax-note">{c.cardNote(scale)}</p>
    <details><summary>{c.details}</summary><Brackets base={item.price} scale={scale} lang={lang}/></details>
    <a className="welcome-tax-link" href={welcomeTaxHref(lang, item.price, item.city)}>{c.open}<ArrowRight aria-hidden="true"/></a>
  </section>;
}

function readQuery(hash: string) {
  const params = new URLSearchParams(hash.split('?')[1] || '');
  const price = /^\d{1,10}$/.test(params.get('prix') || '') ? params.get('prix')! : '500000';
  const city = params.get('ville');
  return {price, scale: (city === 'montreal' || city === 'quebec' || city === 'provincial' ? city : 'montreal') as TaxScale};
}

export function WelcomeTaxPage({lang, hash}: {lang: Language; hash: string}) {
  const c = copy[lang];
  const id = useId();
  const initial = readQuery(hash);
  const [price, setPrice] = useState(initial.price);
  const [scale, setScale] = useState<TaxScale>(initial.scale);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({preventScroll: true}); }, []);
  const base = Math.min(Number(price) || 0, 1_000_000_000);
  const {total} = welcomeTax(base, scale);
  return <div className="welcome-tax-page"><div className="welcome-tax-shell">
    <p className="eyebrow">{welcomeTaxYear}</p>
    <h1 ref={heading} tabIndex={-1}>{c.title}</h1>
    <p className="welcome-tax-intro">{c.intro}</p>
    <form className="welcome-tax-form" onSubmit={event => event.preventDefault()}>
      <label htmlFor={`${id}-price`}>{c.price}</label>
      <input id={`${id}-price`} inputMode="numeric" autoComplete="off" value={price ? new Intl.NumberFormat(locale(lang)).format(Number(price)) : ''} onChange={event => setPrice(event.target.value.replace(/\D/g, '').slice(0, 10))}/>
      <fieldset><legend>{c.city}</legend>{(['montreal', 'quebec', 'provincial'] as const).map(value =>
        <label key={value} className="welcome-tax-choice"><input type="radio" name={`${id}-city`} value={value} checked={scale === value} onChange={() => setScale(value)}/>{c.cities[value]}</label>)}
      </fieldset>
    </form>
    <div className="welcome-tax-result" aria-live="polite"><span>{c.total}</span><strong>{money(total, lang, true)}</strong></div>
    {base > 0 && <Brackets base={base} scale={scale} lang={lang}/>}
    <ul className="welcome-tax-notes">{c.notes.map(note => <li key={note}>{note}</li>)}</ul>
    <a className="welcome-tax-cta" href={cataloguePath(lang)}>{c.browse}<ArrowRight aria-hidden="true"/></a>
  </div></div>;
}
