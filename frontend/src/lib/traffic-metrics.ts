import {backendConfigured} from './backend-config';
import {readSourceForEvent} from './acquisition-source';

const ledgerKey='propriete-en-vente:metric-window:v1';
const lifetime=30*60*1000;
type Ledger={started:number;visit:boolean;properties:string[]};
let memory:Ledger|null=null;
let storageFailed=false;
const pending=new Set<string>();

/** Aggregate event counts, never unique visitors. No URL, account ID or form text is sent. */
export function automaticMetricsAllowed(){
  return backendConfigured&&location.origin==='https://proprieteenvente.ca'
    &&navigator.doNotTrack!=='1'&&navigator.doNotTrack!=='yes'
    &&!(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl;
}
function readLedger():Ledger{
  const now=Date.now();let candidate:unknown=memory;
  if(!storageFailed)try{const raw=sessionStorage.getItem(ledgerKey);if(raw&&raw.length<5000)candidate=JSON.parse(raw);}catch{storageFailed=true;}
  const value=candidate as Ledger|null;
  if(value&&Number.isFinite(value.started)&&value.started<=now+1000&&now-value.started<lifetime&&typeof value.visit==='boolean'&&Array.isArray(value.properties)){
    return {started:value.started,visit:value.visit,properties:value.properties.filter((ref):ref is string=>typeof ref==='string'&&/^\d{1,36}$/.test(ref)).slice(0,100)};
  }
  return {started:now,visit:false,properties:[]};
}
function saveLedger(value:Ledger){memory=value;try{sessionStorage.setItem(ledgerKey,JSON.stringify(value));storageFailed=false;}catch{storageFailed=true;}}
async function record(event:'site_visit'|'property_view',reference=''){
  if(!automaticMetricsAllowed()||(event==='property_view'&&!/^\d{1,36}$/.test(reference)))return;
  const ledger=readLedger();const marker=event==='site_visit'?'visit':reference;
  if(pending.has(marker)||(event==='site_visit'?ledger.visit:ledger.properties.includes(reference)))return;
  // A bounded tab ledger prevents rerenders, auth restoration and refreshes
  // from becoming extra events. It contains no identifier for a person.
  if(event==='property_view'&&ledger.properties.length>=100)return;
  pending.add(marker);
  if(event==='site_visit')ledger.visit=true;else ledger.properties.push(reference);
  saveLedger(ledger);
  try{
    const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-traffic`,{
      method:'POST',headers:{'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},
      body:JSON.stringify({event,source:readSourceForEvent().source,reference}),keepalive:true,signal:AbortSignal.timeout(5000),
    });
    const result=await response.json();
    if(!response.ok||result.ok!==true)throw Error('not_recorded');
  }catch{
    // Leave normal navigation untouched. A later visit can retry a failed event.
    const current=readLedger();
    if(current.started===ledger.started){if(event==='site_visit')current.visit=false;else current.properties=current.properties.filter(ref=>ref!==reference);saveLedger(current);}
  }finally{pending.delete(marker);}
}
export const trackSiteVisit=()=>record('site_visit');
export const trackPropertyView=(reference:string)=>record('property_view',reference);

/** Confirmed enquiries are counted operationally by the server, once per request UUID. */
export function enquiryAnalyticsSource(){return automaticMetricsAllowed()?readSourceForEvent().source:'unknown';}
