export const RECIPIENT = 'achat.vente.garderie@gmail.com';
export type Enquiry = Record<string, string> & { requestId: string; kind: string; name: string; email: string; language: string };
export function parseEnquiry(value: unknown): Enquiry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid');
  const input = value as Record<string, unknown>;
  const limits: Record<string, number> = {requestId:36,kind:6,language:2,name:120,email:254,phone:40,city:200,address:300,listingReference:36,propertyType:10,budgetMin:10,budgetMax:10,expectedPrice:10,timeline:200,service:6,assistance:100,contactLanguage:2,contactMethod:5,contactTime:200,requirements:3000,website:200};
  const result: Record<string,string> = {};
  for (const [key,max] of Object.entries(limits)) {
    const v = input[key] ?? '';
    if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) throw Error('invalid');
    result[key] = v.trim();
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.requestId) || !['buyer','seller'].includes(result.kind) || !['en','fr','zh'].includes(result.language)) throw Error('invalid');
  if (!result.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email) || result.website) throw Error('invalid');
  for (const key of ['budgetMin','budgetMax','expectedPrice']) if (result[key] && (!/^\d+$/.test(result[key]) || Number(result[key]) > 1000000000)) throw Error('invalid');
  if (result.timeline) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.timeline)) throw Error('invalid');
    const selectedDate = new Date(`${result.timeline}T00:00:00.000Z`);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate.toISOString().slice(0, 10) !== result.timeline) throw Error('invalid');
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const selectedUtc = selectedDate.getTime();
    const latestUtc = Date.UTC(today.getUTCFullYear() + 10, today.getUTCMonth(), today.getUTCDate());
    if (selectedUtc < todayUtc || selectedUtc > latestUtc) throw Error('invalid');
  }
  if (result.budgetMin && result.budgetMax && Number(result.budgetMin)>Number(result.budgetMax)) throw Error('invalid');
  if (result.listingReference && !/^[0-9a-f-]{8,36}$/i.test(result.listingReference)) throw Error('invalid');
  if (!['','house','condo','plex','commercial'].includes(result.propertyType) || !['','hybrid','broker'].includes(result.service)) throw Error('invalid');
  if (result.kind === 'buyer') { result.address=''; result.expectedPrice=''; result.service=''; }
  else { if (!['broker','hybrid'].includes(result.service)) throw Error('invalid'); result.budgetMin=''; result.budgetMax=''; }
  if (!['','en','fr','zh'].includes(result.contactLanguage) || !['','email','phone'].includes(result.contactMethod)) throw Error('invalid');
  const requested = result.assistance ? result.assistance.split(',') : [];
  const allowed = ['photos','video','listing','pricing','visits','offers','unsure'];
  if (requested.some(id => !allowed.includes(id)) || new Set(requested).size !== requested.length || (requested.includes('unsure') && requested.length > 1)) throw Error('invalid');
  result.assistance = result.kind === 'seller' && result.service === 'hybrid' ? allowed.filter(id => requested.includes(id)).join(',') : '';
  delete result.website;
  return result as Enquiry;
}

export function enquiriesCsv(rows: Record<string, unknown>[]): string {
  const columns = ['created_at','kind','name','email','phone','city','address','propertyType','budgetMin','budgetMax','expectedPrice','requirements','timeline','service','assistance','contactLanguage','contactMethod','contactTime','listingReference','language'];
  const cell = (v: unknown) => {
    let text = String(v ?? '');
    if (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"','""') + '"';
  };
  return '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
