import { normalizeSearch, type Filters, type Listing, type PropertyType } from './listings-data';
import type { Language } from './seller-copy';

export type SearchCondition = {key: keyof Filters; label: string; value: string};
export type SentenceSearch = {
  input: string;
  filters: Partial<Filters>;
  conditions: SearchCondition[];
  /** Conditions which were not applied. These are deliberately visible before confirmation. */
  unhandled: string[];
  canApply: boolean;
  truncated: boolean;
};

const copy = {
  fr: {location:'Lieu',type:'Type',min:'Budget minimum',max:'Budget maximum',beds:'Chambres',baths:'Salles de bain (minimum)',parking:'Stationnement',outdoor:'Espace extérieur',transaction:'Transaction',yes:'Oui',sale:'À vendre',rent:'À louer',negative:'Les exclusions ne sont pas appliquées. Vérifiez ce critère dans les annonces.',conflict:'Plusieurs valeurs incompatibles : ce critère n’est pas appliqué.',budget:'Précisez « moins de », « plus de » ou une fourchette pour le budget.',bedRange:'Ce nombre de chambres ne correspond pas aux filtres disponibles (0–4 exactement, puis 5 et plus).',left:'Texte non interprété',long:'Le texte est limité à 300 caractères.',empty:'Ajoutez un lieu, un budget ou un type de propriété.',invalid:'La fourchette de prix est inversée; aucun budget n’est appliqué.'},
  en: {location:'Location',type:'Property type',min:'Minimum budget',max:'Maximum budget',beds:'Bedrooms',baths:'Bathrooms (minimum)',parking:'Parking',outdoor:'Outdoor space',transaction:'Transaction',yes:'Yes',sale:'For sale',rent:'For rent',negative:'Exclusions are not applied. Check this condition in the listings.',conflict:'Conflicting values: this condition is not applied.',budget:'Specify “under”, “over” or a range for the budget.',bedRange:'This bedroom requirement does not match the available filters (exactly 0–4, then 5 or more).',left:'Not interpreted',long:'Text is limited to 300 characters.',empty:'Add a location, budget or property type.',invalid:'The price range is reversed; no budget is applied.'},
  zh: {location:'位置',type:'物业类型',min:'最低预算',max:'最高预算',beds:'卧室',baths:'浴室（至少）',parking:'停车位',outdoor:'户外空间',transaction:'交易类型',yes:'有',sale:'出售',rent:'出租',negative:'排除条件未应用，请在房源资料中另行确认。',conflict:'存在相互冲突的条件，该项未应用。',budget:'请用“以内”“以上”或明确区间说明预算。',bedRange:'这个卧室条件与现有筛选不一致（0–4间为精确数量，5间起为至少数量），未应用。',left:'未识别',long:'最多处理300个字符。',empty:'请补充位置、预算或物业类型。',invalid:'最低预算高于最高预算，预算条件未应用。'},
} as const;
const unsupportedBathrooms={
  fr:'Le filtre de salles de bain est un minimum. Une limite maximale ou un nombre exact n’est pas appliqué.',
  en:'The bathroom filter is a minimum. A maximum or exact count is not applied.',
  zh:'现有浴室筛选表示“至少”。最多数量或精确数量无法应用，请另行确认。',
} as const;

const types: {type:PropertyType; pattern:string; names:Record<Language,string>}[] = [
  {type:'hotel-motel',pattern:'hotels?|motels?|酒店|旅馆|旅館|汽车旅馆|汽車旅館',names:{fr:'Hôtel / motel',en:'Hotel / motel',zh:'酒店／旅馆'}},
  {type:'daycare',pattern:'day\s*cares?|garderies?|托儿所|托兒所|托儿机构|幼儿园|幼兒園',names:{fr:'Garderie',en:'Daycare',zh:'托儿机构'}},
  {type:'land',pattern:'land|terrains?|土地|地块|地塊',names:{fr:'Terrain',en:'Land',zh:'土地'}},
  {type:'business',pattern:'business(?:es)?|entreprises?|生意|企业|企業',names:{fr:'Entreprise',en:'Business',zh:'企业／生意'}},
  {type:'house',pattern:'houses?|maisons?|独立屋|獨立屋|别墅|別墅|独栋|獨棟',names:{fr:'Maison',en:'House',zh:'独立屋'}},
  {type:'condo',pattern:'condos?|condominiums?|apartments?|appartements?|公寓',names:{fr:'Condo',en:'Condo',zh:'公寓'}},
  {type:'plex',pattern:'(?:du|tri|quadru)?plex|多户住宅|多戶住宅|复式|複式',names:{fr:'Plex',en:'Plex',zh:'多户住宅'}},
  {type:'commercial',pattern:'commercial|商业物业|商業物業',names:{fr:'Commercial',en:'Commercial',zh:'商业物业'}},
];

const amountPattern = String.raw`(?:\d{1,3}(?:[ ,\u00a0]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(?:millions?|k|m)(?![a-z])|\s*[万萬亿億])?`;
const moneyPattern = String.raw`(?:\$\s*)?${amountPattern}(?:\s*(?:\$|cad|dollars?|加元|元|块|塊))?`;
const minimumCue = /(?:over|above|at least|minimum|min\.?|more than|plus de|au moins|a partir de|最低|至少|不低于)\s*$/;
const maximumCue = /(?:under|below|up to|at most|maximum|max\.?|less than|moins de|jusqu['’]?a|budget(?: de| of)?|预算(?:为|是)?|預算(?:為|是)?|最高|不超过|不超過|低于)\s*$/;
const minimumAfter = /^\s*(?:以上|起|及以上|或以上)/;
const maximumAfter = /^\s*(?:以内|以內|以下|之内|之內|或以下)/;
const cityTranslations:{base:string;aliases:string[]}[]=[
  {base:'Montréal',aliases:['蒙特利尔','蒙特利爾','蒙特婁','满地可','滿地可']},
  {base:'Laval',aliases:['拉瓦尔','拉瓦爾']},
  {base:'Brossard',aliases:['布罗萨尔','布羅薩爾']},
  {base:'Longueuil',aliases:['隆格伊','朗格伊']},
  {base:'Québec',aliases:['魁北克市','quebec city']},
  {base:'Gatineau',aliases:['加蒂诺','加蒂諾']},
  {base:'Sherbrooke',aliases:['舍布鲁克','舍布魯克']},
  {base:'Trois-Rivières',aliases:['三河市']},
];
// Imported aliases also contain listing titles, address numbers and references, not just places.
const aliasGlue=new Set(['rue','street','avenue','ave','av','app','apt','apartment','appartement','unit','unite','suite','boulevard','boul','blvd','road','route','chemin','ch','rang','place','pl','de','du','des','le','la','les','un','une','et','and','for','a','au','aux','sur','sale','rent','vendre','louer','vente','property','propriete','bedroom','bedrooms','chambre','chambres','floor','etage','avec','with','belle','beau','superbe']);
function budgetDirection(before:string,after:string) {
  if(/(?:no|not) more than\s*$/.test(before))return {isMin:false,isMax:true};
  if(/(?:no|not) less than\s*$/.test(before))return {isMin:true,isMax:false};
  return {isMin:minimumCue.test(before)||minimumAfter.test(after),isMax:maximumCue.test(before)||maximumAfter.test(after)};
}
// Unrecognized quantity syntax must not be repurposed as money just because it follows “under”.
function nonMoneyQuantityAfter(after:string,raw:string) {
  return /^\s*(?:个|個|间|間)?\s*(?:full\b|half\b|complete\b|demi(?:e)?\b|bedrooms?\b|beds?\b|bathrooms?\b|baths?\b|chambres?\b|salles? de bain\b|minutes?\b|mins?\b|hours?\b|hrs?\b|kilomet(?:er|re)s?\b|km\b|met(?:er|re)s?\b|m[²2]|sq\.?\s*(?:ft|m)\b|sqft\b|square\s+(?:feet|foot|metres?|meters?)\b|feet\b|ft\b|acres?\b|hectares?\b|pieds?\b|pi[²2]|卧室|臥室|浴室|卫生间|衛生間|分钟|分鐘|小时|小時|公里|千米|米|平方|平米|英尺|英亩|英畝|公顷|公頃|²)/.test(after)
    || (/m\s*$/.test(raw)&&/^\s*(?:2\b|to\s+(?:the\s+)?(?:metro|station)|from\s+(?:the\s+)?(?:metro|station))/.test(after));
}

function amount(value:string) {
  const clean = value.replace(/\$|cad|dollars?|加元|元|块|塊/g,'').trim();
  const unit = /(?:millions?|k|m|万|萬|亿|億)$/.exec(clean)?.[0] || '';
  let number = clean.slice(0,unit ? -unit.length : undefined).replace(/\s/g,'');
  // English/French thousands separators are allowed, as are decimal unit values (0,7 million).
  number = /^\d{1,3}(?:,\d{3})+$/.test(number) ? number.replace(/,/g,'') : number.replace(',','.');
  const factor = unit==='k' ? 1000 : unit==='万'||unit==='萬' ? 10000 : unit==='亿'||unit==='億' ? 100000000 : unit ? 1000000 : 1;
  const result = Number(number)*factor;
  return Number.isFinite(result) && result>=0 && result<=999999999 && Number.isInteger(result) ? result : null;
}

function wordMatches(pattern:string,text:string) {
  // Latin words need boundaries; Chinese keywords can be adjacent to numerals or other text.
  const regex = new RegExp(`(?<![a-z])(?:${pattern})(?![a-z])`,'g');
  return [...text.matchAll(regex)];
}
function negated(text:string,index:number,length=0) {
  const before=text.slice(Math.max(0,index-40),index);
  const after=text.slice(index+length,index+length+35);
  return /(?:\b(?:no|not|without|sans|pas de|pas d['’]|aucun|exclude|excluding)\s*(?:(?:a|any|de|in|at|dans|a)\s+)?|\b(?:don['’]?t|do not|does not)\s+(?:need|want|require)\s*(?:a\s+|any\s+)?|\bno need for\s+|\bpas besoin de\s+|不想要|不想|不要|不需要|无需|無需|没有|沒有|不含|不带|不帶|不在|无|無)\s*$/.test(before) || (length>0&&/^\s*(?:not required|not needed|not wanted|non requis|不需要|不要)/.test(after));
}

/** A local, deterministic translator into the catalogue's existing filters; it never creates listings. */
export function parseSearchSentence(text:string,lang:Language,items:Listing[]):SentenceSearch {
  const input=text.slice(0,300).trim();
  const source=normalizeSearch(input);
  const c=copy[lang];
  const filters:Partial<Filters>={};
  const conditions:SearchCondition[]=[];
  const unhandled:string[]=[];
  const consumed=source.split('').map(()=>false);
  const consume=(index:number,length:number)=>{for(let i=index;i<index+length;i++)consumed[i]=true;};
  const add=(key:keyof Filters,label:string,value:string)=>conditions.push({key,label,value});
  const warn=(message:string)=>{if(!unhandled.includes(message))unhandled.push(message);};
  const money=(value:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value);
  if(text.length>300)warn(c.long);

  // Only places already represented by catalogue city/district/postal/alias fields can become location filters.
  const locations=new Map<string,string>();
  for(const item of items) {
    for(const term of [item.city,item.district,item.neighbourhood||'',item.postal]) {
      const normalized=normalizeSearch(term);
      if(normalized.length>=2&&!/^\d+$/.test(normalized))locations.set(normalized,term);
    }
    for(const raw of item.aliases.split(/\s+/)) {
      const term=raw.replace(/^[,.;:()[\]]+|[,.;:()[\]]+$/g,'');
      const normalized=normalizeSearch(term);
      if(normalized.length<2||/\d/.test(normalized)||aliasGlue.has(normalized)||types.some(type=>wordMatches(type.pattern,normalized).length))continue;
      if(/^[a-z'-]{3,}$/.test(normalized)||/[\u3400-\u9fff]/.test(normalized))locations.set(normalized,term);
    }
  }
  for(const translated of cityTranslations) {
    const base=normalizeSearch(translated.base);
    // Match a city base with an optional borough, never infer a city from a street or title.
    const exists=items.some(item=>{const city=normalizeSearch(item.city);return city===base||city.startsWith(`${base} (`)||city.startsWith(`${base},`);});
    if(exists)for(const alias of [translated.base,...translated.aliases])locations.set(normalizeSearch(alias),translated.base);
  }
  const foundLocations:{query:string;start:number;length:number}[]=[];
  for(const [term,query] of [...locations].sort((a,b)=>b[0].length-a[0].length)) {
    let index=source.indexOf(term);
    while(index>=0) {
      const latin=/^[a-z0-9]/.test(term);
      const boundary=!latin||(!/[a-z0-9]/.test(source[index-1]||'')&&!/[a-z0-9]/.test(source[index+term.length]||''));
      if(boundary && !consumed.slice(index,index+term.length).some(Boolean)) {
        if(negated(source,index,term.length)){warn(`${c.location}: ${query} — ${c.negative}`);consume(index,term.length);}
        else {foundLocations.push({query,start:index,length:term.length});consume(index,term.length);}
      }
      index=source.indexOf(term,index+term.length);
    }
  }
  const placeQueries=[...new Set(foundLocations.map(place=>place.query))];
  if(placeQueries.length) {
    // Multiple place names are combined only when a real listing contains all of them.
    const compatible=items.some(item=>placeQueries.every(query=>normalizeSearch(`${item.city} ${item.district} ${item.postal} ${item.aliases}`).includes(normalizeSearch(query))));
    if(compatible&&placeQueries.join(' ').length<=120){filters.q=placeQueries.join(' ');add('q',c.location,filters.q);}
    else warn(`${c.location}: ${placeQueries.join(' / ')} — ${c.conflict}`);
  }

  const foundTypes:{type:PropertyType;name:string}[]=[];
  for(const type of types)for(const match of wordMatches(type.pattern,source)) {
    consume(match.index!,match[0].length);
    if(negated(source,match.index!,match[0].length))warn(`${c.type}: ${type.names[lang]} — ${c.negative}`);
    else if(!foundTypes.some(found=>found.type===type.type))foundTypes.push({type:type.type,name:type.names[lang]});
  }
  if(foundTypes.length===1){filters.type=foundTypes[0].type;add('type',c.type,foundTypes[0].name);}
  else if(foundTypes.length>1)warn(`${c.type}: ${c.conflict}`);

  const transactionMatches=[...wordMatches('for rent|to rent|rent(?:al)?|a louer|location|出租|租房|租赁|租賃',source).map(match=>({match,value:'rent' as const})),...wordMatches('for sale|to buy|buy|a vendre|achat|acheter|出售|买房|買房|购买|購買',source).map(match=>({match,value:'sale' as const}))];
  const transactions=new Set<string>();
  for(const {match,value} of transactionMatches){consume(match.index!,match[0].length);if(negated(source,match.index!))warn(`${c.transaction}: ${c.negative}`);else transactions.add(value);}
  if(transactions.size===1){filters.transaction=[...transactions][0] as 'sale'|'rent';add('transaction',c.transaction,c[filters.transaction]);}
  else if(transactions.size>1)warn(`${c.transaction}: ${c.conflict}`);

  for(const [key,pattern,label] of [['parking','parking|stationnement|garage|车位|車位|停车位|停車位|停车|停車',c.parking],['outdoor','garden|yard|jardin|cour exterieure|户外空间|戶外空間|花园|花園|院子',c.outdoor]] as const) {
    const matches=wordMatches(pattern,source);
    let positive=false,negative=false;
    for(const match of matches){consume(match.index!,match[0].length);if(negated(source,match.index!,match[0].length))negative=true;else positive=true;}
    if(negative)warn(`${label}: ${c.negative}`);
    if(positive&&!negative){filters[key]=true;add(key,label,c.yes);}
  }

  const bedroomPattern=/(\d{1,2}|[零一二两兩三四五六七八九十])\s*(\+)?\s*(?:bedrooms?|beds?|chambres?|ch\.?\b|卧室|臥室|间卧室|間臥室|室|房)/g;
  const bedroomValues=new Set<string>();
  for(const match of source.matchAll(bedroomPattern)) {
    consume(match.index!,match[0].length);
    const count=/^\d+$/.test(match[1])?Number(match[1]):({'零':0,'一':1,'二':2,'两':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10} as Record<string,number>)[match[1]];
    const before=source.slice(Math.max(0,match.index!-22),match.index!);
    const after=source.slice(match.index!+match[0].length);
    const minimum=Boolean(match[2])||minimumCue.test(before)||minimumAfter.test(after)||/^\s*(?:minimum|min\b|or more|et plus)/.test(after);
    const maximum=maximumCue.test(before)||maximumAfter.test(after)||/^\s*(?:maximum|max\b|or fewer|ou moins)/.test(after);
    if(negated(source,match.index!)){warn(`${c.beds}: ${c.negative}`);continue;}
    if(maximum || (minimum&&count<5) || (!minimum&&count>=5)) {warn(c.bedRange);continue;}
    bedroomValues.add(String(count));
  }
  if(bedroomValues.size===1){filters.beds=[...bedroomValues][0];add('beds',c.beds,`${filters.beds}${Number(filters.beds)>=5?'+':''}`);}
  else if(bedroomValues.size>1)warn(`${c.beds}: ${c.conflict}`);

  const bathroomValues=new Set<string>();
  let bathroomUnsupported=false;
  for(const match of source.matchAll(/(?<![\d.,])(\d{1,2})\s*(?:\+)?\s*(?:个|個|间|間)?\s*(?:bathrooms?|baths?|salles? de bain|浴室|卫生间|衛生間)/g)) {
    consume(match.index!,match[0].length);
    const before=source.slice(Math.max(0,match.index!-40),match.index!);
    const after=source.slice(match.index!+match[0].length);
    const maximum=budgetDirection(before,after).isMax||/(?:fewer than|au plus|pas plus de|最多|至多|不多于|不多於|少于|少於)\s*$/.test(before)||/^\s*(?:maximum|max\b|or fewer|ou moins)/.test(after);
    const exact=/(?:exactly|only|exactement|precisement|seulement|uniquement|juste|恰好|正好|刚好|剛好|仅|僅|只有|只要|只需)\s*$/.test(before)||/^\s*(?:exactly|only\b|exactement|seulement|uniquement|整|恰好|正好)/.test(after);
    if(maximum||exact){bathroomUnsupported=true;warn(unsupportedBathrooms[lang]);}
    else if(negated(source,match.index!,match[0].length)){bathroomUnsupported=true;warn(`${c.baths}: ${c.negative}`);}
    else bathroomValues.add(match[1]);
  }
  if(!bathroomUnsupported&&bathroomValues.size===1){filters.baths=[...bathroomValues][0];add('baths',c.baths,`≥ ${filters.baths}`);}
  else if(bathroomValues.size>1)warn(`${c.baths}: ${c.conflict}`);

  const prices:{value:number;index:number;length:number;raw:string}[]=[];
  for(const match of source.matchAll(new RegExp(moneyPattern,'g'))) {
    if(consumed.slice(match.index!,match.index!+match[0].length).some(Boolean))continue;
    if(nonMoneyQuantityAfter(source.slice(match.index!+match[0].length),match[0]))continue;
    const value=amount(match[0]);
    if(value!==null)prices.push({value,index:match.index!,length:match[0].length,raw:match[0]});
  }
  let minimum:number|undefined,maximum:number|undefined,priceConflict=false;
  if(prices.length===2 && /^(?:\s*(?:to|and|et|a|au|至|到|[-–—~～])\s*)$/.test(source.slice(prices[0].index+prices[0].length,prices[1].index))) {
    // Do not infer missing scale units: “50 à 70万” remains unhandled.
    const units=prices.map(price=>/k|m|万|萬|亿|億/.test(price.raw));
    if(units[0]===units[1]){minimum=prices[0].value;maximum=prices[1].value;for(const price of prices)consume(price.index,price.length);}
  }
  if(minimum===undefined&&maximum===undefined)for(const price of prices) {
    const before=source.slice(Math.max(0,price.index-30),price.index);
    const after=source.slice(price.index+price.length);
    if(/(?:not|pas)\s+(?:under|below|over|above|moins de|plus de)\s*$/.test(before)) {consume(price.index,price.length);warn(`${c.max}: ${c.negative}`);continue;}
    const {isMin,isMax}=budgetDirection(before,after);
    if(isMin!==isMax) {
      if(isMin){if(minimum!==undefined&&minimum!==price.value)priceConflict=true;minimum=price.value;}
      if(isMax){if(maximum!==undefined&&maximum!==price.value)priceConflict=true;maximum=price.value;}
      consume(price.index,price.length);
    } else if(/[\d].*(?:k|m|万|萬|亿|億|\$|cad|dollar)/.test(price.raw)||price.value>=10000)warn(c.budget);
  }
  if(priceConflict)warn(`${c.max}: ${c.conflict}`);
  else if(minimum!==undefined&&maximum!==undefined&&minimum>maximum)warn(c.invalid);
  else {
    if(minimum!==undefined){filters.min=String(minimum);add('min',c.min,money(minimum));}
    if(maximum!==undefined){filters.max=String(maximum);add('max',c.max,money(maximum));}
  }

  let leftover=source.split('').map((character,index)=>consumed[index]?' ':character).join('');
  // Only remove grammatical glue. Unsupported meaningful conditions remain visible.
  leftover=leftover.replace(/\b(?:i|we|want|would|like|looking|look|search|find|for|a|an|the|in|at|with|and|or|of|de|du|des|le|la|les|un|une|je|cherche|recherche|veux|voudrais|dans|avec|et|ou|entre|between|budget|under|below|over|above|up to|at most|at least|minimum|maximum|moins|plus|jusqu|au|a|partir|no|not|without|sans|pas|aucun)\b/g,' ').replace(/(?:想找|寻找|尋找|找一个|找一個|找|我想|我们|我們|的|带有|帶有|带|帶|有|和|以及|以内|以內|以下|以上|预算|預算|不超过|不超過|至少|最高|最低|不要|不需要|没有|沒有|无|無)/g,' ').replace(/[\s,，、。.!！?？:：;；'’\-–—/]+/g,' ').trim();
  if(leftover)warn(`${c.left}: ${leftover}`);
  if(!conditions.length&&!unhandled.length)warn(c.empty);
  return {input,filters,conditions,unhandled,canApply:conditions.length>0,truncated:text.length>300};
}
