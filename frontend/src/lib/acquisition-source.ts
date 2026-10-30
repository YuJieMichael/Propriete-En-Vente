export const acquisitionSources=['google','bing','facebook','instagram','linkedin','wechat','xiaohongshu','other','direct','unknown'] as const;
export const acquisitionMedia=['organic','social','referral','email','qr'] as const;
export const acquisitionCampaigns=['hotel-20261028'] as const;
export type AcquisitionSource=typeof acquisitionSources[number];
export type AcquisitionMedium=typeof acquisitionMedia[number];
export type AcquisitionCampaign=typeof acquisitionCampaigns[number];
/** Client-reported channel context, not a user identifier or verified advertising attribution. */
export type AcquisitionAttribution={source:AcquisitionSource;medium:AcquisitionMedium|null;campaign:AcquisitionCampaign|null};
type StoredAttribution=AcquisitionAttribution&{createdAt:number};

const storageKey='propriete-en-vente:acquisition:v1';
const lifetime=30*60*1000;
const unknown:AcquisitionAttribution={source:'unknown',medium:null,campaign:null};
let memory:StoredAttribution|null=null;
let storageFailed=false;
const aliases:Record<string,AcquisitionSource>={fb:'facebook',ig:'instagram',wx:'wechat',weixin:'wechat',xhs:'xiaohongshu'};
const referrerHosts:{source:AcquisitionSource;hosts:readonly string[];medium:AcquisitionMedium}[]=[
  {source:'google',hosts:['google.com','google.ca','google.fr','google.co.uk','google.de','google.com.hk','google.com.tw','google.co.jp'],medium:'organic'},
  {source:'bing',hosts:['bing.com'],medium:'organic'},
  {source:'facebook',hosts:['facebook.com','fb.com','fb.me'],medium:'social'},
  {source:'instagram',hosts:['instagram.com'],medium:'social'},
  {source:'linkedin',hosts:['linkedin.com','lnkd.in'],medium:'social'},
  {source:'wechat',hosts:['wechat.com','weixin.qq.com'],medium:'social'},
  {source:'xiaohongshu',hosts:['xiaohongshu.com','xhslink.com'],medium:'social'},
];

function member<T extends string>(value:unknown,allowed:readonly T[]):value is T {
  return typeof value==='string'&&allowed.includes(value as T);
}
function onlyParameter(params:URLSearchParams,name:string):string|null {
  const values=params.getAll(name);
  return values.length===1?values[0].trim().toLowerCase():null;
}
function sourceParameter(value:string|null):AcquisitionSource|null {
  if(!value)return null;
  return member(value,acquisitionSources)?value:Object.hasOwn(aliases,value)?aliases[value]:null;
}
function hostMatches(host:string,base:string) {return host===base||host.endsWith(`.${base}`);}
function hostname(url:URL){return url.hostname.toLowerCase().replace(/\.$/,'');}
function sanitized(value:StoredAttribution):AcquisitionAttribution {
  // Reconstruct a fixed shape; no raw query text or additional storage properties can escape.
  return {source:value.source,medium:value.medium,campaign:value.campaign};
}
function validStored(value:unknown,now:number):value is StoredAttribution {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const record=value as Record<string,unknown>;
  return member(record.source,acquisitionSources)
    &&(record.medium===null||member(record.medium,acquisitionMedia))
    &&(record.campaign===null||member(record.campaign,acquisitionCampaigns))
    &&typeof record.createdAt==='number'&&Number.isFinite(record.createdAt)&&record.createdAt>=0
    &&record.createdAt<=now+1000&&now-record.createdAt<lifetime;
}
function forget() {
  memory=null;
  try{sessionStorage.removeItem(storageKey);}catch{/* Storage is optional. */}
}
function existing(now:number):StoredAttribution|null {
  // A failed write may leave an older stored value behind. Prefer this tab's latest fallback.
  if(storageFailed&&validStored(memory,now))return {...sanitized(memory),createdAt:memory.createdAt};
  let raw:string|null;
  try {
    raw=sessionStorage.getItem(storageKey);
  }catch{storageFailed=true;raw=null;}
  if(raw!==null) {
    // This record is always tiny. Reject oversized/corrupt data before parsing it.
    if(raw.length>512){forget();return null;}
    let value:unknown;
    try{value=JSON.parse(raw);}catch{forget();return null;}
    if(validStored(value,now))return {...sanitized(value),createdAt:value.createdAt};
    forget();return null;
  }
  if(!storageFailed){memory=null;return null;}
  if(validStored(memory,now))return {...sanitized(memory),createdAt:memory.createdAt};
  forget();return null;
}
function remember(attribution:AcquisitionAttribution,now:number) {
  const value:StoredAttribution={...attribution,createdAt:now};
  memory=value;
  try{sessionStorage.setItem(storageKey,JSON.stringify(value));storageFailed=false;}catch{storageFailed=true;}
  return sanitized(value);
}

/**
 * Capture once on page entry. Valid new UTM sources take priority; internal navigation
 * and entries without a new source retain the current tab's unexpired attribution.
 * Never call this for every event: reads must not extend the thirty-minute window.
 */
export function captureAcquisitionSource():AcquisitionAttribution {
  const now=Date.now();
  const current=existing(now);
  let page:URL;
  try{page=new URL(window.location.href);}catch{return current?sanitized(current):{...unknown};}
  const source=sourceParameter(onlyParameter(page.searchParams,'utm_source'));
  if(source) {
    const medium=onlyParameter(page.searchParams,'utm_medium');
    const campaign=onlyParameter(page.searchParams,'utm_campaign');
    return remember({source,medium:member(medium,acquisitionMedia)?medium:null,campaign:member(campaign,acquisitionCampaigns)?campaign:null},now);
  }
  let referrer='';
  try{referrer=document.referrer;}catch{/* No referrer information is available. */}
  if(!referrer)return current?sanitized(current):remember({source:'direct',medium:null,campaign:null},now);
  let referrerHost:string;
  try {
    const parsed=new URL(referrer);
    if(!['http:','https:'].includes(parsed.protocol))return current?sanitized(current):remember({...unknown},now);
    referrerHost=hostname(parsed);
  }catch{return current?sanitized(current):remember({...unknown},now);}
  if(referrerHost===hostname(page)||hostMatches(referrerHost,'proprieteenvente.ca'))return current?sanitized(current):remember({source:'direct',medium:null,campaign:null},now);
  for(const channel of referrerHosts)if(channel.hosts.some(host=>hostMatches(referrerHost,host)))return remember({source:channel.source,medium:channel.medium,campaign:null},now);
  return remember({source:'other',medium:'referral',campaign:null},now);
}

/** Only finite channel fields for an event. No raw URLs, timestamps or identifiers are returned. */
export function readSourceForEvent():AcquisitionAttribution {
  const value=existing(Date.now());
  return value?sanitized(value):{...unknown};
}
