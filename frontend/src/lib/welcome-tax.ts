// Québec property transfer duties ("taxe de bienvenue"), 2026 scales.
// Sources, checked 2026-10-29:
// - Montréal: https://montreal.ca/articles/comment-sont-calcules-les-droits-sur-les-mutations-immobilieres-9279
// - Ville de Québec: https://www.ville.quebec.qc.ca/citoyens/taxes_evaluation/droits_mutation_immobiliere.aspx
// The first three brackets are the provincial minimum every municipality applies;
// a municipality may add higher rates above 500 000 $, so other cities are a floor.
export const welcomeTaxYear = 2026;
export type TaxBracket = {upTo: number; rate: number};
export type TaxScale = 'montreal' | 'quebec' | 'provincial';

const provincial: TaxBracket[] = [{upTo: 62_900, rate: 0.005}, {upTo: 315_000, rate: 0.01}, {upTo: Infinity, rate: 0.015}];
export const taxScales: Record<TaxScale, TaxBracket[]> = {
  provincial,
  montreal: [
    {upTo: 62_900, rate: 0.005}, {upTo: 315_000, rate: 0.01}, {upTo: 552_300, rate: 0.015}, {upTo: 1_104_700, rate: 0.02},
    {upTo: 2_136_500, rate: 0.025}, {upTo: 3_113_000, rate: 0.035}, {upTo: Infinity, rate: 0.04},
  ],
  quebec: [
    {upTo: 62_900, rate: 0.005}, {upTo: 315_000, rate: 0.01}, {upTo: 500_000, rate: 0.015}, {upTo: 750_000, rate: 0.025},
    {upTo: Infinity, rate: 0.03},
  ],
};

const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*\)/, '').replace(/[^a-z]+/g, ' ').trim();
/** Montréal-Est and other island cities are separate municipalities with their own rates. */
export function taxScaleForCity(city = ''): TaxScale {
  const name = plain(city);
  return name === 'montreal' ? 'montreal' : name === 'quebec' ? 'quebec' : 'provincial';
}

export type TaxLine = {from: number; to: number; rate: number; amount: number};
export function welcomeTax(base: number, scale: TaxScale) {
  const lines: TaxLine[] = [];
  let from = 0;
  if (Number.isFinite(base) && base > 0) for (const bracket of taxScales[scale]) {
    const to = Math.min(base, bracket.upTo);
    if (to > from) lines.push({from, to, rate: bracket.rate, amount: Math.round((to - from) * bracket.rate * 100) / 100});
    if (base <= bracket.upTo) break;
    from = bracket.upTo;
  }
  return {lines, total: Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100};
}
