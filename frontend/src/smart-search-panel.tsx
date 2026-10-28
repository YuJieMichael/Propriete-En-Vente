import {useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,MessageSquareText,Search} from 'lucide-react';
import type {Filters,Listing,PropertyType} from './listings-data';
import type {Language} from './seller-copy';
import {parseSearchSentence,type SentenceSearch} from './smart-search';
import './smart-search.css';

const copy={
  fr:{title:'Décrivez votre recherche',intro:'Une phrase suffit pour préparer vos filtres.',label:'Votre recherche en français, en anglais ou en chinois',placeholder:'Un condo à Montréal, moins de 700 000 $, 2 chambres, avec stationnement',example:'Essayer cet exemple',parse:'Préparer les filtres',preview:'Vérifiez les conditions reconnues',pending:'À vérifier séparément · non appliqué',apply:'Confirmer et rechercher',privacy:'Votre phrase est analysée dans ce navigateur. Seuls les filtres confirmés sont placés dans l’adresse de recherche.',limit:'300 caractères maximum. Aucun résultat n’est inventé.',reset:'Les conditions confirmées remplacent les filtres de recherche précédents.'},
  en:{title:'Describe your search',intro:'Use one sentence to prepare your filters.',label:'Your search in English, French or Chinese',placeholder:'A condo in Montreal under $700,000, 2 bedrooms, with parking',example:'Try this example',parse:'Prepare filters',preview:'Review the recognized conditions',pending:'Check separately · not applied',apply:'Confirm and search',privacy:'Your sentence is processed in this browser. Only confirmed filters are included in the search address.',limit:'Up to 300 characters. No listings are invented.',reset:'Confirmed conditions replace your previous search filters.'},
  zh:{title:'用一句话找房',intro:'说出需求，先确认条件，再搜索现有房源。',label:'用中文、法语或英语描述需求',placeholder:'想找蒙特利尔70万以内、两间卧室、有车位的公寓',example:'试试这个例子',parse:'识别搜索条件',preview:'请确认已识别的条件',pending:'需要另行确认 · 未应用',apply:'确认条件并搜索',privacy:'这句话在当前浏览器内解析，只有确认后的筛选条件会进入搜索网址。',limit:'最多300个字符，搜索结果均来自现有房源。',reset:'确认后将替换原来的搜索筛选条件。'},
} as const;

export function SmartSearch({lang,items,onApply,initialText='',initialType}:{lang:Language;items:Listing[];onApply:(filters:Partial<Filters>)=>void;initialText?:string;initialType?:PropertyType}) {
  const c=copy[lang];
  const id=useId();
  const [text,setText]=useState(initialText.slice(0,300));
  const [parsed,setParsed]=useState<SentenceSearch|null>(null);
  const [applied,setApplied]=useState(false);
  const edited=useRef(false);
  useEffect(()=>{if(initialText&&!edited.current){setText(initialText.slice(0,300));setParsed(parseSearchSentence(initialText,lang,items,initialType));setApplied(false);}},[initialText,lang,items,initialType]);
  function prepare(){edited.current=true;setParsed(parseSearchSentence(text,lang,items,initialType));setApplied(false);}
  return <section className="smart-search" aria-labelledby={`${id}-title`}>
    <div className="smart-search-heading"><MessageSquareText aria-hidden="true"/><div><h2 id={`${id}-title`}>{c.title}</h2><p>{c.intro}</p></div></div>
    <form onSubmit={event=>{event.preventDefault();prepare();}}>
      <label htmlFor={`${id}-input`}>{c.label}</label>
      <div className="smart-search-input"><textarea id={`${id}-input`} value={text} maxLength={300} rows={2} placeholder={c.placeholder} aria-describedby={`${id}-privacy`} onChange={event=>{edited.current=true;setText(event.target.value);setParsed(null);setApplied(false);}}/><button type="submit" disabled={!text.trim()}><Search aria-hidden="true"/>{c.parse}</button></div>
      <div className="smart-search-meta"><button type="button" className="smart-search-example" onClick={()=>{edited.current=true;setText(c.placeholder);setParsed(null);setApplied(false);}}>{c.example}</button><span>{text.length}/300</span></div>
      <p id={`${id}-privacy`} className="smart-search-privacy">{c.privacy}</p>
    </form>
    {parsed&&<div className="smart-search-preview" role="status" aria-live="polite">
      <h3>{c.preview}</h3>
      {!!parsed.conditions.length&&<dl>{parsed.conditions.map(condition=><div key={condition.key}><dt>{condition.label}</dt><dd>{condition.value}</dd></div>)}</dl>}
      {!!parsed.unhandled.length&&<div className="smart-search-unhandled"><strong>{c.pending}</strong><ul>{parsed.unhandled.map((message,index)=><li key={index}>{message}</li>)}</ul></div>}
      <p>{c.limit}</p>
      {parsed.canApply&&<><p>{c.reset}</p><button className="smart-search-confirm" type="button" disabled={applied} onClick={()=>{edited.current=true;onApply(parsed.filters);setApplied(true);}}>{c.apply}<ArrowRight aria-hidden="true"/></button></>}
    </div>}
  </section>;
}
