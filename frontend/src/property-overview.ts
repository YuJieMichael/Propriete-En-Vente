// A longer introduction assembled only from published facts, the saved
// OpenStreetMap places and the transfer-duty scale. Nothing is inferred: a
// missing fact is left out rather than described. Shared by the property page
// and the static SEO page so both say the same thing.
import {propertyHeading, type SeoLanguage, type SeoListing} from './seo.ts';
import {taxScaleForCity, welcomeTax} from './lib/welcome-tax.ts';

type Feature = {key: string; value: Partial<Record<SeoLanguage, string>>};
export type OverviewListing = SeoListing & {
  price?: number | null; rentPrice?: number | null; transaction?: string; parking?: boolean | null; parkingSpaces?: number;
  streetParking?: boolean; outdoor?: boolean | null; daycareSubsidy?: string; features?: Feature[];
};
type Place = {name: string; distance: number};
export type OverviewNearby = {places: Partial<Record<'transit' | 'grocery' | 'school' | 'pharmacy' | 'park' | 'health', Place>>; busStops: number};

const locale = (lang: SeoLanguage) => lang === 'zh' ? 'zh-CN' : `${lang}-CA`;
const number = (value: number, lang: SeoLanguage) => new Intl.NumberFormat(locale(lang), {maximumFractionDigits: 0}).format(value);
const money = (value: number, lang: SeoLanguage) => new Intl.NumberFormat(locale(lang), {style: 'currency', currency: 'CAD', maximumFractionDigits: 0}).format(value);
const metres = (value: number, lang: SeoLanguage) => value < 1000 ? `${value} m` : `${new Intl.NumberFormat(locale(lang), {maximumFractionDigits: 1}).format(value / 1000)} km`;
const walk = (value: number) => Math.max(1, Math.round(value / 80));
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

function area(nearby: OverviewNearby | null | undefined, lang: SeoLanguage) {
  if (!nearby) return '';
  const names = {
    en: {transit: 'station', grocery: 'grocery store', school: 'school', pharmacy: 'pharmacy', park: 'park', health: 'clinic'},
    fr: {transit: 'gare ou station', grocery: 'épicerie', school: 'école', pharmacy: 'pharmacie', park: 'parc', health: 'clinique'},
    zh: {transit: '车站', grocery: '超市', school: '学校', pharmacy: '药房', park: '公园', health: '诊所'},
  }[lang];
  const close = (['transit', 'grocery', 'school', 'park', 'pharmacy', 'health'] as const).flatMap(kind => {
    const place = nearby.places[kind];
    if (!place) return [];
    const distance = metres(place.distance, lang), minutes = walk(place.distance);
    return [{en: `${place.name} (${names[kind]}, ${distance}, about ${minutes} min on foot)`, fr: `${place.name} (${names[kind]}, ${distance}, environ ${minutes} min à pied)`, zh: `${place.name}（${names[kind]}，${distance}，步行约 ${minutes} 分钟）`}[lang]];
  });
  const sentences: string[] = [];
  if (close.length) sentences.push({en: `Nearby, as the crow flies: ${list(close, lang)}.`, fr: `À proximité, à vol d’oiseau : ${list(close, lang)}.`, zh: `周边（直线距离）：${list(close, lang)}。`}[lang]);
  if (nearby.busStops) sentences.push({en: `There ${nearby.busStops === 1 ? 'is 1 bus stop' : `are ${nearby.busStops} bus stops`} within 500 m.`, fr: `On compte ${nearby.busStops} arrêt${nearby.busStops === 1 ? '' : 's'} d’autobus à moins de 500 m.`, zh: `500 米内有 ${nearby.busStops} 个公交站。`}[lang]);
  return sentences.join(lang === 'zh' ? '' : ' ');
}

function costs(item: OverviewListing, lang: SeoLanguage) {
  if (item.transaction === 'rent' || !(typeof item.price === 'number' && item.price > 0)) return '';
  const scale = taxScaleForCity(item.city);
  const amount = money(welcomeTax(item.price, scale).total, lang);
  if (scale === 'provincial') return {en: `At the asking price, a buyer would owe at least ${amount} in welcome tax under the provincial minimum scale; the municipality may charge more.`, fr: `Au prix demandé, l’acheteur paierait au moins ${amount} de taxe de bienvenue selon le barème provincial minimal; la municipalité peut exiger davantage.`, zh: `按挂牌价计算，买家按全省最低税率至少需缴欢迎税 ${amount}，所在城市可能收得更高。`}[lang];
  const place = {montreal: {en: 'Montréal', fr: 'de Montréal', zh: '蒙特利尔'}, quebec: {en: 'Québec City', fr: 'de la Ville de Québec', zh: '魁北克市'}}[scale][lang];
  return {en: `At the asking price, a buyer would owe about ${amount} in welcome tax under the ${place} 2026 scale.`, fr: `Au prix demandé, l’acheteur paierait environ ${amount} de taxe de bienvenue selon le barème 2026 ${place}.`, zh: `按挂牌价和${place} 2026 年税率计算，买家约需缴欢迎税 ${amount}。`}[lang];
}

/** Up to three paragraphs: the property, its surroundings, and buying costs. */
export function propertyOverview(lang: SeoLanguage, item: OverviewListing, nearby?: OverviewNearby | null) {
  return [about(item, lang), area(nearby, lang), costs(item, lang)].filter(Boolean);
}
export const overviewTitle = {en: 'Property overview', fr: 'Aperçu de la propriété', zh: '房源概览'};
