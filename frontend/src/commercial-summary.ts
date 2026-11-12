import { isCommercialType } from '../../supabase/functions/_shared/listing-input.ts';
import type { Listing } from './listings-data';
import { commercialIntakeCopy, saleScopeCopy } from './commercial-listing-copy.ts';
import { daycareLabels } from './property-categories.ts';
import { hotelGuestRooms } from './seo.ts';
import type { Language } from './seller-copy';

type SummaryListing = Pick<Listing,'type'|'commercial'|'features'|'daycareSubsidy'|'transaction'>;
export const commercialSummaryCopy = {
  en: { title:'Transaction summary', capacity:'Advertised places', subsidy:'Subsidy status', building:'Real estate included', included:'Included', excluded:'Excluded', commercialRent:'Listed commercial rent', residentialRent:'Listed residential rent', leaseExpiry:'Lease expiry', noi:'Net operating income (NOI)' },
  fr: { title:'Sommaire de la transaction', capacity:'Places annoncées', subsidy:'Statut de subvention', building:'Immeuble inclus', included:'Inclus', excluded:'Exclu', commercialRent:'Loyer commercial annoncé', residentialRent:'Loyer résidentiel annoncé', leaseExpiry:'Échéance des baux', noi:'Revenu net d’exploitation (RNE)' },
  zh: { title:'交易摘要', capacity:'挂牌名额', subsidy:'补贴状态', building:'是否包含物业', included:'包含', excluded:'不包含', commercialRent:'挂牌商铺租金', residentialRent:'挂牌住宅租金', leaseExpiry:'租约到期日', noi:'净营运收入（NOI）' },
};

function feature(item:SummaryListing,key:string,lang:Language){
  return item.features?.find(entry=>entry.key===key)?.value[lang]?.trim()||'';
}

export function daycareTransactionFacts(item:SummaryListing,lang:Language){
  const c=commercialSummaryCopy[lang];
  const capacity=item.commercial?.capacity;
  const scope=item.commercial?.scope;
  return {
    capacity: capacity==null?feature(item,'capacity',lang):new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`).format(capacity),
    building: scope?(scope==='business'?c.excluded:c.included):feature(item,'includedBuilding',lang),
  };
}

export function commercialSummaryRows(item:SummaryListing,lang:Language): [string,string][] {
  if(!isCommercialType(item.type)||item.transaction==='rent')return [];
  const c=commercialSummaryCopy[lang], intake=commercialIntakeCopy[lang];
  const rows:[string,string][]=[[intake.scope,item.commercial?saleScopeCopy[lang][item.commercial.scope]:intake.unknown]];
  const rooms=hotelGuestRooms(lang,item);
  if(rooms)rows.push([rooms.label,rooms.value]);
  if(item.type==='daycare'){
    const {capacity,building}=daycareTransactionFacts(item,lang);
    rows.push([c.capacity,capacity||intake.unknown],[c.subsidy,item.daycareSubsidy?daycareLabels[lang][item.daycareSubsidy]:intake.unknown],[c.building,building||intake.unknown]);
  }
  const commercialRent=feature(item,'commercialRent',lang),residentialRent=feature(item,'residentialRent',lang);
  if(commercialRent)rows.push([c.commercialRent,commercialRent]);
  if(residentialRent)rows.push([c.residentialRent,residentialRent]);
  if(commercialRent||residentialRent){
    rows.push([c.leaseExpiry,feature(item,'leaseExpiry',lang)||intake.unknown],[c.noi,feature(item,'netOperatingIncome',lang)||intake.unknown]);
  }
  return rows;
}
