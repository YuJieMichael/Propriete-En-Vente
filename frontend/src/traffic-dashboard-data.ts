import type {Language} from './seller-copy';
import {buildCampaignLink} from './lib/campaign-links';

export const trafficEvents=['site_visit','property_view','enquiry_success'] as const;
export type TrafficCounts=Record<typeof trafficEvents[number],number>;
export type TrafficSummary={started_at:string|null;days:number;totals:TrafficCounts;sources:({source:string}&TrafficCounts)[];daily:({day:string}&TrafficCounts)[];properties:{reference:string;property_view:number;enquiry_success:number}[]};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):number=>{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw Error('invalid_traffic_summary');return value;};
const counts=(value:Record<string,unknown>):TrafficCounts=>({site_visit:count(value.site_visit),property_view:count(value.property_view),enquiry_success:count(value.enquiry_success)});
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;

/** Read contract of the existing staff-only get_traffic_summary RPC. Missing values are never replaced with zero. */
export function parseTrafficSummary(value:unknown):TrafficSummary{
  if(!object(value)||!Number.isInteger(value.days)||Number(value.days)<1||Number(value.days)>90||!object(value.totals)
    ||!(value.started_at===null||(typeof value.started_at==='string'&&Number.isFinite(Date.parse(value.started_at))))
    ||!Array.isArray(value.sources)||!Array.isArray(value.daily)||!Array.isArray(value.properties))throw Error('invalid_traffic_summary');
  const sources=value.sources.map(row=>{if(!object(row)||typeof row.source!=='string'||row.source.length>80)throw Error('invalid_traffic_summary');return {source:row.source,...counts(row)};});
  const daily=value.daily.map(row=>{
    if(!object(row)||typeof row.day!=='string'||!dayPattern.test(row.day)||!Number.isFinite(Date.parse(`${row.day}T12:00:00Z`))||new Date(`${row.day}T12:00:00Z`).toISOString().slice(0,10)!==row.day)throw Error('invalid_traffic_summary');
    return {day:row.day,...counts(row)};
  }).sort((a,b)=>a.day.localeCompare(b.day));
  if(new Set(daily.map(row=>row.day)).size!==daily.length||daily.length>90)throw Error('invalid_traffic_summary');
  const properties=value.properties.map(row=>{
    if(!object(row)||(typeof row.reference!=='string'&&!(typeof row.reference==='number'&&Number.isSafeInteger(row.reference)))||String(row.reference).length>64)throw Error('invalid_traffic_summary');
    return {reference:String(row.reference),property_view:count(row.property_view),enquiry_success:count(row.enquiry_success)};
  });
  return {started_at:value.started_at as string|null,days:Number(value.days),totals:counts(value.totals),sources,daily,properties};
}

export const hasRecordedEvents=(row:TrafficCounts)=>trafficEvents.some(event=>row[event]>0);
export function trafficCoverage(summary:TrafficSummary){
  const active=summary.daily.filter(hasRecordedEvents);
  return {firstDay:summary.daily[0]?.day??null,lastDay:summary.daily.at(-1)?.day??null,lastRecordedDay:active.at(-1)?.day??null,daysWithEvents:active.length,daysWithoutRecords:summary.daily.length-active.length,hasEvents:hasRecordedEvents(summary.totals)};
}

export const hotelCampaignChannels=['facebook','wechat','linkedin','partner'] as const;
export type HotelCampaignChannel=typeof hotelCampaignChannels[number];
/** Only fixed public destinations and the collector's existing platform source/medium allowlists are generated. */
export function hotelCampaignLink(lang:Language,channel:HotelCampaignChannel):string{
  if(!['en','fr','zh'].includes(lang)||!hotelCampaignChannels.includes(channel))throw Error('invalid_campaign_link');
  const url=buildCampaignLink({lang,source:channel==='partner'?'other':channel,medium:channel==='partner'?'referral':'social',campaign:'hotel-20261028'});
  if(!url)throw Error('invalid_campaign_link');
  return url;
}
