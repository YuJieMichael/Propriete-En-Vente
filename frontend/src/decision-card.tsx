import {useId,useState} from 'react';
import {ArrowRight,Check,HelpCircle,Minus} from 'lucide-react';
import type {Listing} from './listings-data';
import type {Language} from './seller-copy';
import {defaultDecisionCriteria,evaluateDecision,residentialTypes,type DecisionCriteria,type DecisionStatus} from './decision-card-data';
import './decision-card.css';

export function DecisionCard({lang,item,initialCriteria,onAsk}:{lang:Language;item:Listing;initialCriteria?:DecisionCriteria;onAsk?:(questions:string[])=>void}){
  const id=useId();
  const [criteria,setCriteria]=useState(()=>defaultDecisionCriteria(item,initialCriteria));
  const [excluded,setExcluded]=useState<string[]>([]);
  const c={
    en:{eyebrow:'Prepare your next step',title:'Your property decision card',intro:'Compare the public facts with your needs, then choose the questions to ask.',transaction:'My project',sale:'Buy',rent:'Rent',max:'Maximum asking-price budget (CAD)',monthly:'Maximum monthly rent (CAD)',optional:'Optional',beds:'Minimum bedrooms',any:'Any',parking:'I need on-site parking',matches:'Meets my criteria',mismatches:'Does not meet my criteria',unknown:'Information to confirm',empty:'No items in this group',questions:'My questions for the seller',ask:'Add selected questions to my enquiry',none:'Select at least one question.',note:'Based on the published listing. Budget compares the asking price only; taxes, fees and financing are not included. These questions do not confirm condition, permitted use or profitability.',bedNote:'Bedroom criteria apply to residential properties.',selected:'questions selected'},
    fr:{eyebrow:'Préparer la suite',title:'Votre carte de décision',intro:'Comparez les faits publiés à vos besoins, puis choisissez les questions à poser.',transaction:'Mon projet',sale:'Acheter',rent:'Louer',max:'Budget maximal du prix demandé (CAD)',monthly:'Loyer mensuel maximal (CAD)',optional:'Facultatif',beds:'Minimum de chambres',any:'Peu importe',parking:'J’ai besoin de stationnement sur place',matches:'Correspond à mes critères',mismatches:'Ne correspond pas à mes critères',unknown:'Informations à confirmer',empty:'Aucun élément dans cette catégorie',questions:'Mes questions au vendeur',ask:'Ajouter les questions choisies à ma demande',none:'Choisissez au moins une question.',note:'Selon l’annonce publiée. Le budget compare uniquement le prix demandé, sans taxes, frais ni financement. Ces questions ne confirment ni l’état, ni l’usage permis, ni la rentabilité.',bedNote:'Le critère de chambres s’applique aux propriétés résidentielles.',selected:'questions choisies'},
    zh:{eyebrow:'准备下一步',title:'您的房源决策卡',intro:'把公开资料与您的需求对照，再选择想向卖家确认的问题。',transaction:'我的计划',sale:'购买',rent:'租赁',max:'最高报价预算（加元）',monthly:'最高月租预算（加元）',optional:'选填',beds:'最少卧室数量',any:'不限',parking:'我需要物业内车位',matches:'符合我的条件',mismatches:'不符合我的条件',unknown:'资料待确认',empty:'此类别暂无项目',questions:'我想问卖家的问题',ask:'把所选问题带入咨询',none:'请至少选择一个问题。',note:'依据房源已公开资料进行比较。预算仅对照报价，不含税费、其他费用或融资成本。下列问题不代表已确认物业状况、允许用途或收益。',bedNote:'卧室条件仅用于住宅物业。',selected:'个问题已选择'},
  }[lang];
  const result=evaluateDecision(item,criteria,lang);
  const chosen=result.questions.filter(question=>!excluded.includes(question));
  const groupLabels:Record<DecisionStatus,string>={match:c.matches,mismatch:c.mismatches,unknown:c.unknown};
  const set=(patch:Partial<DecisionCriteria>)=>setCriteria(current=>({...current,...patch}));
  return <section className="decision-card" aria-labelledby={`${id}-title`}>
    <header><p className="eyebrow">{c.eyebrow}</p><h2 id={`${id}-title`}>{c.title}</h2><p>{c.intro}</p></header>
    <div className="decision-inputs">
      <label>{c.transaction}<select value={criteria.transaction} onChange={event=>set({transaction:event.target.value as 'sale'|'rent',max:''})}><option value="sale">{c.sale}</option><option value="rent">{c.rent}</option></select></label>
      <label>{criteria.transaction==='rent'?c.monthly:c.max}<input inputMode="numeric" type="number" min="1" max="1000000000" step="1" placeholder={c.optional} value={criteria.max} onChange={event=>set({max:event.target.value})}/></label>
      {residentialTypes.has(item.type)&&<label>{c.beds}<select value={criteria.beds} onChange={event=>set({beds:event.target.value})}><option value="">{c.any}</option>{[1,2,3,4,5,6,7,8,9,10].map(count=><option key={count} value={String(count)}>{count}+</option>)}</select></label>}
    </div>
    <label className="decision-parking"><input type="checkbox" checked={criteria.parking} onChange={event=>set({parking:event.target.checked})}/>{c.parking}</label>
    {!residentialTypes.has(item.type)&&initialCriteria?.beds&&<p className="decision-note">{c.bedNote}</p>}
    <div className="decision-groups" aria-live="polite">{(['match','mismatch','unknown'] as const).map(status=>{
      const facts=result.facts.filter(fact=>fact.status===status);
      const Icon=status==='match'?Check:status==='mismatch'?Minus:HelpCircle;
      return <section className={`decision-group decision-${status}`} key={status}><h3><Icon aria-hidden="true"/>{groupLabels[status]} <span>{facts.length}</span></h3>{facts.length?<ul>{facts.map(fact=><li key={fact.key}>{fact.text}</li>)}</ul>:<p>{c.empty}</p>}</section>;
    })}</div>
    <fieldset className="decision-questions"><legend>{c.questions}</legend>{result.questions.map(question=><label key={question}><input type="checkbox" checked={!excluded.includes(question)} onChange={event=>setExcluded(current=>event.target.checked?current.filter(value=>value!==question):[...current,question])}/><span>{question}</span></label>)}</fieldset>
    {onAsk&&<div className="decision-action"><button type="button" onClick={()=>onAsk(chosen)} disabled={!chosen.length}>{c.ask}<ArrowRight aria-hidden="true"/></button><span role="status">{chosen.length?`${chosen.length} ${c.selected}`:c.none}</span></div>}
    <p className="decision-note">{c.note}</p>
  </section>;
}
