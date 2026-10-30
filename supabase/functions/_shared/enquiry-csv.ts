// Spreadsheet-safe cell: formula-like text is prefixed so Excel/Sheets do not run it.
const cell = (v: unknown) => {
  let text = String(v ?? '');
  if (/^[\s﻿]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
};
const csv = (rows: unknown[][]) => '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';

/** Every stored enquiry field (notification email attachment). */
export function enquiriesCsv(rows: Record<string, unknown>[], options: {includeListing?: boolean} = {}): string {
  const columns = ['created_at','kind','name','email','phone','city','address','propertyType','daycareSubsidy','budgetMin','budgetMax','expectedPrice','requirements','timeline','service','assistance','contactLanguage','contactMethod','contactTime','listingReference','language'];
  if (options.includeListing !== false) columns.push('listingStatus','listingId','listingNumber','listingTitle','listingAddress','listingAddressStatus','listingCity','listingPrice','listingTransaction','listingUrl','listingResolvedAt','listingSnapshotSource');
  return csv([columns, ...rows.map(row => columns.map(key => row[key]))]);
}

const summaryHeaders = {
  fr: ['Date','Nom','Téléphone','Courriel','Préférence de contact','Propriété souhaitée','Prix affiché','Lien de la propriété','Budget / offre','Message'],
  en: ['Date','Name','Phone','Email','Contact preference','Property of interest','Listed price','Property link','Budget / offer','Message'],
  zh: ['日期','姓名','电话','邮箱','联系偏好','意向房源','挂牌价','房源链接','预算 / 报价','留言'],
};
const text = (v: unknown) => String(v ?? '').trim();
const join = (values: unknown[], separator = ' · ') => values.map(text).filter(Boolean).join(separator);

/**
 * Staff export: who the person is, how to reach them, the property they asked
 * about and their budget or price. Headers follow the inbox language.
 */
export function enquiriesSummaryCsv(rows: Record<string, unknown>[], lang: 'fr'|'en'|'zh'): string {
  return csv([summaryHeaders[lang], ...rows.map(row => {
    const linked = row.listingStatus === 'linked';
    const budget = row.kind === 'seller' ? text(row.expectedPrice) : join([row.budgetMin, row.budgetMax], ' – ');
    return [
      text(row.created_at).slice(0, 16).replace('T', ' '),
      row.name, row.phone, row.email,
      join([row.contactMethod, row.contactTime, row.contactLanguage]),
      linked ? join([row.listingNumber || row.listingReference, row.listingAddress || row.listingTitle, row.listingCity]) : text(row.listingReference),
      linked ? row.listingPrice : '',
      linked ? row.listingUrl : '',
      budget,
      row.requirements,
    ];
  })]);
}
