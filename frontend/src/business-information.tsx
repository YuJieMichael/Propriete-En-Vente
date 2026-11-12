import type {Listing} from './listings-data';
import type {Language} from './seller-copy';
import {LockKeyhole} from 'lucide-react';
import {hotelGuestRooms} from './seo';
import {daycareTransactionFacts} from './commercial-summary';
import {ndaRequestCopy} from './nda-request-copy';
import {ndaRequestsEnabled} from './lib/enquiry-route';

const businessCopy={
 en:{title:'Business facts & confidential documents',public:'Published business facts',unknown:'To confirm',rooms:'Guest rooms',capacity:'Advertised capacity',subsidy:'Subsidy status',subsidized:'Subsidized',unsubsidized:'Non-subsidized',building:'Building included',area:'Lot area',parking:'Parking spaces',documents:'Documents you can request',hotel:['Revenue and occupancy','Operating statements and expenses','Lease, franchise and transaction details'],daycare:['Enrolment and attendance','Operating statements and expenses','Permit, subsidy and lease documents']},
 fr:{title:'Données d’exploitation et documents confidentiels',public:'Données publiées',unknown:'À confirmer',rooms:'Chambres',capacity:'Capacité annoncée',subsidy:'Statut de subvention',subsidized:'Subventionnée',unsubsidized:'Non subventionnée',building:'Immeuble inclus',area:'Superficie du terrain',parking:'Places de stationnement',documents:'Documents à demander',hotel:['Revenus et taux d’occupation','États d’exploitation et dépenses','Bail, franchise et modalités de transaction'],daycare:['Inscriptions et fréquentation','États d’exploitation et dépenses','Permis, subvention et bail']},
 zh:{title:'经营参数与保密资料',public:'已公开经营参数',unknown:'待经纪确认',rooms:'客房数量',capacity:'挂牌名额',subsidy:'补贴类型',subsidized:'有政府补贴',unsubsidized:'无政府补贴',building:'是否包含物业',area:'土地面积',parking:'停车位',documents:'可申请核实的资料',hotel:['营收与入住率','经营报表与运营成本','租约、特许经营及交易范围'],daycare:['在册人数与入托率','经营报表与运营成本','许可、补贴及租约资料']}
};

function offersConfidentialDocuments(item:Listing){
 return item.real && (item.type==='hotel-motel'||item.type==='daycare');
}

export function NdaRequestLink({item,lang}:{item:Listing;lang:Language}){
 if(!ndaRequestsEnabled()||!offersConfidentialDocuments(item))return null;
 return <a className="nda-request-link" href={`#acheter?listing=${encodeURIComponent(item.reference||item.id)}&intent=nda`}>
   <LockKeyhole aria-hidden="true"/>{ndaRequestCopy[lang].request}
 </a>;
}

export function BusinessInformation({item,lang}:{item:Listing;lang:Language}){
 if(!offersConfidentialDocuments(item))return null;
 const t=businessCopy[lang],daycare=item.type==='daycare';
 const acceptingRequests=ndaRequestsEnabled();
 const title=acceptingRequests?t.title:t.public;
 const {capacity,building}=daycareTransactionFacts(item,lang);
 const number=(n:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`).format(n);
 const fields=daycare?[[t.capacity,capacity||t.unknown],[t.subsidy,item.daycareSubsidy==='subsidized'?t.subsidized:item.daycareSubsidy==='non-subsidized'?t.unsubsidized:t.unknown],[t.building,building||t.unknown]]:
 [[t.rooms,hotelGuestRooms(lang,item)?.value||t.unknown],[t.parking,item.parkingSpaces!=null?number(item.parkingSpaces):t.unknown],[t.area,item.lotArea?`${number(item.lotArea)} ${lang==='zh'?'平方英尺':lang==='fr'?'pi²':'sq. ft.'}`:t.unknown]];
 return <section className="business-information" aria-label={title}>
  <details><summary>{title}</summary><div className="business-information-body">
   {acceptingRequests&&<h3>{t.public}</h3>}
   <dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {acceptingRequests&&<><h3>{t.documents}</h3><ul>{(daycare?t.daycare:t.hotel).map(label=><li key={label}>{label}</li>)}</ul><p>{ndaRequestCopy[lang].note}</p></>}
  </div></details>
 </section>;
}
