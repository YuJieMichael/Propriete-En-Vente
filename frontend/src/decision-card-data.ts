import type {Language} from './seller-copy';
import type {Listing} from './listings-data';

export type DecisionCriteria={max?:string;beds?:string;parking?:boolean;transaction?:''|'sale'|'rent'};
export type DecisionStatus='match'|'mismatch'|'unknown';
export type DecisionFact={key:string;status:DecisionStatus;text:string;question?:string};
export type DecisionResult={facts:DecisionFact[];questions:string[]};
export const residentialTypes=new Set(['house','condo','plex']);
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const nonNegative=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const amount=(value:number,lang:Language)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value);

export function defaultDecisionCriteria(item:Pick<Listing,'transaction'>,initial:DecisionCriteria={}):DecisionCriteria{
  return {max:initial.max||'',beds:initial.beds||'',parking:Boolean(initial.parking),transaction:initial.transaction||(item.transaction==='rent'?'rent':'sale')};
}

/** Only structured, public facts are compared. An absent value never becomes a negative fact. */
export function evaluateDecision(item:Listing,criteria:DecisionCriteria,lang:Language):DecisionResult{
  const c={
    en:{sale:'Offered for sale',rent:'Offered for rent',notSale:'Not listed for sale',notRent:'Not listed for rent',priceUnknown:'Asking price not provided for this transaction',within:'Within your asking-price budget',over:'Above your asking-price budget',bedKnown:'Bedrooms listed',bedUnknown:'Bedroom count not provided',bedEnough:'Meets your minimum bedroom count',bedShort:'Below your minimum bedroom count',parkingYes:'On-site parking is listed',parkingNo:'No on-site parking is listed',parkingUnknown:'On-site parking is unconfirmed',street:'Street parking is listed separately',areaUnknown:'Living area not provided',lotUnknown:'Lot area not provided',priceQuestion:'What is the asking price for this transaction, and what extra costs apply?',bedQuestion:'How many bedrooms are included in this property?',parkingQuestion:'Is on-site parking included, and how many spaces are available?',areaQuestion:'What is the living area, and how was it measured?',lotQuestion:'What is the lot area, and are a plan and lot dimensions available?'},
    fr:{sale:'Offerte à la vente',rent:'Offerte à la location',notSale:'Pas annoncée à la vente',notRent:'Pas annoncée à la location',priceUnknown:'Prix non renseigné pour cette transaction',within:'Dans votre budget de prix demandé',over:'Au-dessus de votre budget de prix demandé',bedKnown:'Chambres annoncées',bedUnknown:'Nombre de chambres non renseigné',bedEnough:'Respecte votre minimum de chambres',bedShort:'Sous votre minimum de chambres',parkingYes:'Stationnement sur place annoncé',parkingNo:'Aucun stationnement sur place annoncé',parkingUnknown:'Stationnement sur place à confirmer',street:'Stationnement dans la rue annoncé séparément',areaUnknown:'Superficie habitable non renseignée',lotUnknown:'Superficie du terrain non renseignée',priceQuestion:'Quel est le prix demandé pour cette transaction et quels frais supplémentaires sont à prévoir ?',bedQuestion:'Combien de chambres comprend cette propriété ?',parkingQuestion:'Le stationnement sur place est-il inclus et combien de places sont disponibles ?',areaQuestion:'Quelle est la superficie habitable et comment a-t-elle été mesurée ?',lotQuestion:'Quelle est la superficie du terrain ? Un plan et ses dimensions sont-ils disponibles ?'},
    zh:{sale:'房源支持出售',rent:'房源支持出租',notSale:'房源未列为出售',notRent:'房源未列为出租',priceUnknown:'未提供此交易方式的报价',within:'报价在您的预算内',over:'报价高于您的预算',bedKnown:'已列出的卧室数量',bedUnknown:'未提供卧室数量',bedEnough:'达到您要求的最少卧室数量',bedShort:'低于您要求的最少卧室数量',parkingYes:'已列出物业内车位',parkingNo:'已列明无物业内车位',parkingUnknown:'物业内车位待确认',street:'路边停车另列，不计为物业内车位',areaUnknown:'未提供居住面积',lotUnknown:'未提供土地面积',priceQuestion:'此交易方式的报价是多少？还需要支付哪些额外费用？',bedQuestion:'这套物业实际包含几间卧室？',parkingQuestion:'是否包含物业内车位？共有几个可用车位？',areaQuestion:'居住面积是多少？采用什么测量方式？',lotQuestion:'土地面积是多少？是否有地块图和尺寸资料？'},
  }[lang];
  const facts:DecisionFact[]=[];
  const transaction=criteria.transaction||'sale';
  const actual=item.transaction||'sale';
  const available=actual==='sale-rent'||actual===transaction;
  facts.push({key:'transaction',status:available?'match':'mismatch',text:transaction==='rent'?(available?c.rent:c.notRent):(available?c.sale:c.notSale)});
  const max=typeof criteria.max==='string'&&/^\d{1,10}$/.test(criteria.max)?Number(criteria.max):0;
  if(max>0){
    const price=available?(transaction==='rent'&&actual==='sale-rent'?item.rentPrice:item.price):undefined;
    if(!positive(price))facts.push({key:'budget',status:'unknown',text:c.priceUnknown,question:c.priceQuestion});
    else facts.push({key:'budget',status:price<=max?'match':'mismatch',text:`${price<=max?c.within:c.over} · ${amount(price,lang)}${transaction==='rent'?({en:'/month',fr:'/mois',zh:'/月'}[lang]):''} / ${amount(max,lang)}`});
  }
  const beds=typeof criteria.beds==='string'&&/^\d{1,3}$/.test(criteria.beds)?Number(criteria.beds):0;
  if(beds>0&&residentialTypes.has(item.type)){
    if(!nonNegative(item.beds))facts.push({key:'beds',status:'unknown',text:c.bedUnknown,question:c.bedQuestion});
    else facts.push({key:'beds',status:item.beds>=beds?'match':'mismatch',text:`${item.beds>=beds?c.bedEnough:c.bedShort} · ${item.beds} / ${beds}`});
  }
  if(criteria.parking){
    let parking=item.parking;
    if(nonNegative(item.parkingSpaces)){
      const countSaysParking=item.parkingSpaces>0;
      parking=item.parking!==null&&item.parking!==undefined&&item.parking!==countSaysParking?null:countSaysParking;
    }
    if(typeof parking!=='boolean')facts.push({key:'parking',status:'unknown',text:c.parkingUnknown,question:c.parkingQuestion});
    else facts.push({key:'parking',status:parking?'match':'mismatch',text:`${parking?c.parkingYes:c.parkingNo}${!parking&&item.streetParking?` · ${c.street}`:''}`});
  }
  if(residentialTypes.has(item.type)&&!positive(item.area))facts.push({key:'area',status:'unknown',text:c.areaUnknown,question:c.areaQuestion});
  if(item.type==='land'&&!positive(item.lotArea))facts.push({key:'lotArea',status:'unknown',text:c.lotUnknown,question:c.lotQuestion});
  const questions=[...facts.flatMap(fact=>fact.question?[fact.question]:[]),...decisionQuestions(item.type,lang)];
  return {facts,questions:[...new Set(questions)]};
}

export function decisionQuestions(type:Listing['type'],lang:Language):string[]{
  const common={en:'What is included in the price, and when would possession or occupancy be possible?',fr:'Quelles sont les inclusions au prix et quand la prise de possession ou l’occupation serait-elle possible ?',zh:'报价包含哪些项目？何时可以交房或入住？'}[lang];
  const questions={
    en:{house:['What work has been completed, and what known work remains?','What are the current property taxes and recurring costs?'],condo:['What are the current condo fees, and are special assessments planned?','Which condo documents and rules can be reviewed?'],plex:['Which units are occupied, and what are the current leases and expenses?','What are the permitted uses and occupancy conditions?'],commercial:['Which uses are currently permitted, and what approvals would my project require?','Does the asking price include the building, a leasehold interest or other assets?'],land:['Which uses are permitted, and what approvals would my project require?','What access, water, sewer or other services are available?'], 'hotel-motel':['Does the sale include the property, the business, equipment or a combination?','Which operating records, permits and occupancy figures are available for review?'],daycare:['What is included in the sale, and what are the lease or property terms?','Which permits, authorized places and subsidy conditions can be verified?'],business:['Does the sale concern shares or assets, and what is included?','Which financial records, contracts and lease terms can be reviewed?']},
    fr:{house:['Quels travaux ont été réalisés et quels travaux connus restent à prévoir ?','Quels sont les taxes foncières et les frais récurrents actuels ?'],condo:['Quels sont les frais de copropriété actuels et des cotisations spéciales sont-elles prévues ?','Quels documents et règlements de copropriété peut-on consulter ?'],plex:['Quels logements sont occupés et quels sont les baux et dépenses actuels ?','Quels sont les usages permis et les conditions d’occupation ?'],commercial:['Quels usages sont actuellement permis et quelles autorisations mon projet nécessiterait-il ?','Le prix comprend-il l’immeuble, un droit au bail ou d’autres actifs ?'],land:['Quels usages sont permis et quelles autorisations mon projet nécessiterait-il ?','Quels accès, services d’eau, d’égout ou autres services sont disponibles ?'], 'hotel-motel':['La vente comprend-elle l’immeuble, l’entreprise, l’équipement ou une combinaison ?','Quels relevés d’exploitation, permis et taux d’occupation peut-on consulter ?'],daycare:['Quelles sont les inclusions de la vente et les conditions du bail ou de l’immeuble ?','Quels permis, places autorisées et conditions de subvention peut-on vérifier ?'],business:['S’agit-il d’une vente d’actions ou d’actifs et quelles sont les inclusions ?','Quels états financiers, contrats et conditions de bail peut-on consulter ?']},
    zh:{house:['已经完成哪些维修？还有哪些已知待修项目？','目前的地税及日常持有费用是多少？'],condo:['目前的物业费是多少？是否计划收取特别分摊费用？','可以查阅哪些共管物业文件和管理规定？'],plex:['哪些单元已有租客？现有租约和支出情况如何？','允许的用途和占用条件是什么？'],commercial:['目前允许哪些用途？我的项目需要哪些批准？','报价包含建筑、租赁权益还是其他资产？'],land:['允许哪些用途？我的项目需要哪些批准？','是否有道路出入、供水、排污或其他服务？'],'hotel-motel':['出售范围包括物业、经营业务、设备，还是其中的组合？','可以查阅哪些经营记录、许可证和入住率资料？'],daycare:['出售范围包含哪些内容？租约或物业条件是什么？','可以核实哪些许可证、许可名额及补贴条件？'],business:['交易是股权出售还是资产出售？包含哪些项目？','可以查阅哪些财务报表、合同及租约条件？']},
  }[lang][type];
  return [...questions,common];
}
