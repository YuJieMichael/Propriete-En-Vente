// A longer introduction assembled only from published facts. Nothing is inferred: a
// missing fact is left out rather than described. Shared by the property page
// and the static SEO page so both say the same thing.
import {propertyHeading, type SeoLanguage, type SeoListing} from './seo.ts';

type Feature = {key: string; value: Partial<Record<SeoLanguage, string>>};
export type OverviewListing = SeoListing & {
  price?: number | null; rentPrice?: number | null; transaction?: string; parking?: boolean | null; parkingSpaces?: number;
  streetParking?: boolean; outdoor?: boolean | null; daycareSubsidy?: string; features?: Feature[];
};

const locale = (lang: SeoLanguage) => lang === 'zh' ? 'zh-CN' : `${lang}-CA`;
const number = (value: number, lang: SeoLanguage) => new Intl.NumberFormat(locale(lang), {maximumFractionDigits: 0}).format(value);
const money = (value: number, lang: SeoLanguage) => new Intl.NumberFormat(locale(lang), {style: 'currency', currency: 'CAD', maximumFractionDigits: 0}).format(value);
const sqft = {en: 'sq. ft.', fr: 'pi²', zh: '平方英尺'};

// Chinese text takes a space only next to numbers or Latin words.
const cjk = (before: string, text: string) => before + (/^[0-9A-Za-zÀ-ÿ]/.test(text) ? ' ' : '') + text;
/** "a, b and c" in each language. */
function list(items: string[], lang: SeoLanguage) {
  if (lang === 'zh') return items.join('、');
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${lang === 'fr' ? 'et' : 'and'} ${items.at(-1)}`;
}
function feature(item: OverviewListing, keys: string[], lang: SeoLanguage) {
  return item.features?.find(f => keys.includes(f.key))?.value[lang]?.trim() || '';
}
function yearBuilt(item: OverviewListing) {
  const value = item.features?.find(f => ['Année de construction', 'year'].includes(f.key))?.value.en ?? '';
  const year = Number(/^\s*(\d{4})\s*$/.exec(value)?.[1]);
  return year > 1700 && year <= new Date().getFullYear() + 3 ? year : null;
}

function about(item: OverviewListing, lang: SeoLanguage) {
  const label = propertyHeading(lang, item).split(' — ')[0];
  const rent = item.transaction === 'rent';
  const value = rent ? item.rentPrice ?? item.price : item.price;
  const price = typeof value === 'number' && value > 0 ? money(value, lang) + (rent ? {en: '/month', fr: '/mois', zh: '/月'}[lang] : '') : '';
  const city = item.city || '';
  // French sentences use "la propriété" as the subject, so agreement never depends on the property type.
  const intro = {
    en: `${label} in ${city}${price ? `, ${rent ? 'for' : 'listed at'} ${price}` : ''}.`,
    fr: `${label} à ${city}.${price ? ` ${rent ? 'Loyer demandé' : 'Prix demandé'} : ${price}.` : ''}`,
    zh: `位于 ${city} 的${label}${price ? `，${rent ? '租金' : '挂牌价'} ${price}` : ''}。`,
  }[lang];
  const size: string[] = [];
  if (item.beds) size.push({en: `${item.beds} ${item.beds === 1 ? 'bedroom' : 'bedrooms'}`, fr: `${item.beds} chambre${item.beds === 1 ? '' : 's'}`, zh: `${item.beds} 间卧室`}[lang]);
  if (item.baths) size.push({en: `${item.baths} ${item.baths === 1 ? 'bathroom' : 'bathrooms'}`, fr: `${item.baths} salle${item.baths === 1 ? '' : 's'} de bain`, zh: `${item.baths} 间浴室`}[lang]);
  if (item.area) size.push({en: `${number(item.area, lang)} ${sqft.en} of space`, fr: `${number(item.area, lang)} ${sqft.fr} de superficie`, zh: `${number(item.area, lang)} ${sqft.zh}面积`}[lang]);
  const lot = item.lotArea ? {en: ` on a ${number(item.lotArea, lang)} ${sqft.en} lot`, fr: ` sur un terrain de ${number(item.lotArea, lang)} ${sqft.fr}`, zh: `，土地 ${number(item.lotArea, lang)} ${sqft.zh}`}[lang] : '';
  const sentences = [intro];
  if (size.length) sentences.push({en: `It offers ${list(size, lang)}${lot}.`, fr: `La propriété offre ${list(size, lang)}${lot}.`, zh: `${cjk('共有', list(size, lang))}${lot}。`}[lang]);
  else if (lot) sentences.push({en: `The lot measures ${number(item.lotArea!, lang)} ${sqft.en}`, fr: `Le terrain mesure ${number(item.lotArea!, lang)} ${sqft.fr}.`, zh: `土地面积 ${number(item.lotArea!, lang)} ${sqft.zh}。`}[lang]);
  const year = yearBuilt(item);
  if (year) sentences.push({en: `Built in ${year}.`, fr: `Année de construction : ${year}.`, zh: `建于 ${year} 年。`}[lang]);
  const extras: string[] = [];
  if (item.parkingSpaces && item.parkingSpaces > 0) extras.push({en: `parking for ${item.parkingSpaces} ${item.parkingSpaces === 1 ? 'vehicle' : 'vehicles'}`, fr: `${item.parkingSpaces} place${item.parkingSpaces === 1 ? '' : 's'} de stationnement`, zh: `${item.parkingSpaces} 个车位`}[lang]);
  else if (item.parking) extras.push({en: 'parking', fr: 'du stationnement', zh: '车位'}[lang]);
  else if (item.streetParking) extras.push({en: 'street parking', fr: 'du stationnement sur rue', zh: '路边停车'}[lang]);
  if (item.outdoor) extras.push({en: 'outdoor space', fr: 'un espace extérieur', zh: '户外空间'}[lang]);
  const pool = feature(item, ['Piscine', 'pool', 'poolFromDescription'], lang);
  if (pool) extras.push({en: `a pool (${pool.toLowerCase()})`, fr: `une piscine (${pool.toLowerCase()})`, zh: `泳池（${pool}）`}[lang]);
  if (extras.length) sentences.push({en: `It comes with ${list(extras, lang)}.`, fr: `${size.length ? 'Elle' : 'La propriété'} comprend ${list(extras, lang)}.`, zh: `${cjk('配有', list(extras, lang))}。`}[lang]);
  const rooms = feature(item, ['guestRooms'], lang), capacity = feature(item, ['capacity'], lang);
  if (rooms) sentences.push({en: `Published guest rooms: ${rooms}.`, fr: `Chambres publiées : ${rooms}.`, zh: `公开的客房数：${rooms}。`}[lang]);
  if (capacity) sentences.push({en: `Advertised capacity: ${capacity}.`, fr: `Capacité annoncée : ${capacity}.`, zh: `挂牌名额：${capacity}。`}[lang]);
  return sentences.join(lang === 'zh' ? '' : ' ');
}

/** The property in a few sentences. Nearby places and the welcome tax are shown only on request. */
export function propertyOverview(lang: SeoLanguage, item: OverviewListing) {
  return [about(item, lang)].filter(Boolean);
}
export const overviewTitle = {en: 'Property overview', fr: 'Aperçu de la propriété', zh: '房源概览'};
