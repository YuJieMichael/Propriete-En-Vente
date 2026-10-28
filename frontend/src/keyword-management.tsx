import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import type {Language} from './seller-copy';
import {supabase} from './lib/supabase';
import {invalidatePublicListings} from './lib/public-listings';
import {readListingKeywords,type ListingKeyword} from './keyword-search';
import {keywordCopy} from './keyword-copy';
import './keyword-management.css';

type Definition=ListingKeyword&{revision:number};
type Row={id:string;reference:string;title:string;city:string;type:string;status:'published'|'pending'|'rejected';revision:number;keyword_ids:string[]};
const emptyLabels={en:'',fr:'',zh:''};
export function KeywordManagement({lang}:{lang:Language}){
 const c=keywordCopy[lang];
 const [definitions,setDefinitions]=useState<Definition[]>([]),[rows,setRows]=useState<Row[]>([]),[more,setMore]=useState(false);
 const [queryInput,setQueryInput]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0);
 const [selected,setSelected]=useState<Record<string,number>>({}),[bulkTags,setBulkTags]=useState<string[]>([]);
 const [editing,setEditing]=useState<Definition|null>(null),[labels,setLabels]=useState({...emptyLabels}),[synonyms,setSynonyms]=useState('');
 const [rowEditor,setRowEditor]=useState<Row|null>(null),[rowTags,setRowTags]=useState<string[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const version=useRef(0),locked=useRef(false),active=useRef(true);
 const load=useCallback(async()=>{
  const request=++version.current;setLoading(true);setError('');
  try{
   if(!supabase)throw Error();
   const result=await supabase.rpc('list_listing_keywords_admin',{p_query:query,p_offset:offset});
   if(result.error||!Array.isArray(result.data?.keywords)||!Array.isArray(result.data?.listings))throw result.error||Error();
   if(!active.current||request!==version.current)return;
   const tags=readListingKeywords(result.data.keywords).map(tag=>({...tag,revision:result.data.keywords.find((value:Definition)=>value.id===tag.id).revision}));
   setDefinitions(tags);setRows(result.data.listings.slice(0,50));setMore(result.data.has_more===true);
  }catch{if(active.current&&request===version.current)setError(c.loadError);}
  finally{if(active.current&&request===version.current)setLoading(false);}
 },[query,offset,c.loadError]);
 useEffect(()=>{active.current=true;void load();return()=>{active.current=false;version.current++;};},[load]);
 function resetDefinition(){setEditing(null);setLabels({...emptyLabels});setSynonyms('');}
 async function mutate(job:()=>PromiseLike<{error:unknown}>,after:()=>void){
  if(locked.current||!supabase)return;
  locked.current=true;setBusy(true);setError('');setMessage('');
  try{
   const result=await job();if(result.error)throw result.error;
   invalidatePublicListings();
   if(active.current){after();await load();setMessage(c.saved);}
  }catch(reason){if(active.current){const code=(reason as {code?:string})?.code;setError(code==='40001'?c.conflict:code==='42501'?c.denied:c.failed);}}
  finally{locked.current=false;if(active.current)setBusy(false);}
 }
 function saveDefinition(event:FormEvent){
  event.preventDefault();const terms=[...new Set(synonyms.split(/[\n,，;；]+/).map(value=>value.trim()).filter(Boolean))];
  const clean={en:labels.en.trim(),fr:labels.fr.trim(),zh:labels.zh.trim()};
  if(!Object.values(clean).every(value=>value.length>0&&value.length<=60)||terms.length>30||terms.some(term=>term.length>80)){setError(c.invalid);return;}
  void mutate(()=>supabase!.rpc('save_listing_keyword',{p_id:editing?.id||null,p_revision:editing?.revision||0,p_labels:clean,p_synonyms:terms}),resetDefinition);
 }
 function apply(mode:'add'|'remove'|'replace',single?:Row){
  const expected=single?[{id:single.id,revision:single.revision}]:Object.entries(selected).map(([id,revision])=>({id,revision}));
  const ids=single?rowTags:bulkTags;
  if(!expected.length||expected.length>100||ids.length>30||(mode!=='replace'&&!ids.length))return;
  void mutate(()=>supabase!.rpc('apply_listing_keywords',{p_listings:expected,p_keyword_ids:ids,p_mode:mode}),()=>{setSelected({});setRowEditor(null);});
 }
 function toggle(values:string[],id:string){return values.includes(id)?values.filter(value=>value!==id):[...values,id];}
 const checkboxes=(values:string[],setValues:(value:string[])=>void,prefix:string)=><div className="keyword-options">{definitions.map(tag=><label key={tag.id}><input type="checkbox" aria-label={prefix+tag.labels[lang]} checked={values.includes(tag.id)} disabled={busy||(!values.includes(tag.id)&&values.length>=30)} onChange={()=>setValues(toggle(values,tag.id))}/>{tag.labels[lang]}</label>)}</div>;
 const selectionCount=Object.keys(selected).length;
 return <section className="admin-panel keyword-management" aria-busy={loading||busy}>
  <div className="keyword-heading"><div><h2>{c.title}</h2><p>{c.intro}</p></div><button type="button" disabled={busy||loading} onClick={()=>{setSelected({});void load();}}>{c.refresh}</button></div>
  <p className="keyword-public-note">{c.publicHint}</p>
  {error&&<p role="alert" className="keyword-error">{error}</p>}{message&&<p role="status">{message}</p>}{loading&&<p role="status">{c.loading}</p>}
  <details className="keyword-library" open><summary>{c.definitions} ({definitions.length})</summary>
   <div className="keyword-definitions">{definitions.map(tag=><div key={tag.id}><strong>{tag.labels[lang]}</strong><span>{tag.synonyms.join(' · ')}</span><button type="button" disabled={busy} onClick={()=>{setEditing(tag);setLabels({...tag.labels});setSynonyms(tag.synonyms.join('\n'));}}>{c.editPrefix}{tag.labels[lang]}</button></div>)}</div>
   <form className="keyword-definition-form" onSubmit={saveDefinition}><fieldset disabled={busy}><legend>{editing?c.edit:c.create}</legend><div className="keyword-labels">
    {(['en','fr','zh'] as const).map(language=><label key={language}>{language==='en'?c.english:language==='fr'?c.french:c.chinese}<input name={`keyword-${language}`} value={labels[language]} required maxLength={60} lang={language} onChange={event=>setLabels({...labels,[language]:event.target.value})}/></label>)}
   </div><label>{c.synonyms}<textarea name="keyword-synonyms" rows={3} maxLength={2430} value={synonyms} onChange={event=>setSynonyms(event.target.value)}/></label><p>{c.limits}</p><div className="keyword-actions"><button type="submit">{c.save}</button>{editing&&<button type="button" onClick={resetDefinition}>{c.cancel}</button>}</div></fieldset></form>
  </details>
  <h3>{c.listings}</h3><p>{c.notice}</p>
  <form className="keyword-listing-search" onSubmit={event=>{event.preventDefault();setSelected({});if(query===queryInput.trim()&&offset===0)void load();else{setQuery(queryInput.trim());setOffset(0);}}}><label>{c.search}<input name="keyword-listing-search" maxLength={120} value={queryInput} disabled={busy} onChange={event=>setQueryInput(event.target.value)}/></label><button disabled={busy||loading}>{c.searchButton}</button></form>
  <fieldset className="keyword-bulk" disabled={busy||loading}><legend>{c.bulk}</legend>{checkboxes(bulkTags,setBulkTags,c.bulkPrefix)}<p aria-live="polite">{c.selected}: {selectionCount}</p><div className="keyword-actions"><button type="button" disabled={!selectionCount||!bulkTags.length} onClick={()=>apply('add')}>{c.add}</button><button type="button" disabled={!selectionCount||!bulkTags.length} onClick={()=>apply('remove')}>{c.remove}</button></div></fieldset>
  {!!rows.length&&<label className="keyword-select-page"><input type="checkbox" checked={rows.every(row=>selected[row.id]!==undefined)} disabled={busy||loading} onChange={()=>setSelected(rows.every(row=>selected[row.id]!==undefined)?{}:Object.fromEntries(rows.map(row=>[row.id,row.revision])))}/>{c.selectPage}</label>}
  {!rows.length&&!loading&&<p>{c.empty}</p>}
  <div className="keyword-listings">{rows.map(row=><article key={row.id}>
   <div className="keyword-heading"><label className="keyword-row-select"><input type="checkbox" aria-label={c.select+row.reference} disabled={busy||loading} checked={selected[row.id]!==undefined} onChange={()=>setSelected(current=>{const next={...current};if(next[row.id]!==undefined)delete next[row.id];else next[row.id]=row.revision;return next;})}/><strong>{row.reference} · {row.title}</strong></label><button type="button" disabled={busy||loading} onClick={()=>{setRowEditor(row);setRowTags([...row.keyword_ids]);}}>{c.editTags}{row.reference}</button></div>
   <p>{row.city} · {c[row.status]}</p><div className="keyword-chips">{row.keyword_ids.length?row.keyword_ids.map(id=><span key={id}>{definitions.find(tag=>tag.id===id)?.labels[lang]||id}</span>):<span>{c.noTags}</span>}</div>
   {rowEditor?.id===row.id&&<fieldset className="keyword-assignment-editor" disabled={busy}><legend>{c.editTags}{row.reference}</legend>{checkboxes(rowTags,setRowTags,c.listingPrefix)}<div className="keyword-actions"><button type="button" onClick={()=>apply('replace',rowEditor)}>{c.saveTags}</button><button type="button" onClick={()=>setRowEditor(null)}>{c.cancel}</button></div></fieldset>}
  </article>)}</div>
  <nav className="keyword-pagination" aria-label={c.listings}><button type="button" disabled={busy||loading||offset===0} onClick={()=>{setSelected({});setOffset(Math.max(0,offset-50));}}>{c.previous}</button><span>{c.page} {Math.floor(offset/50)+1}</span><button type="button" disabled={busy||loading||!more} onClick={()=>{setSelected({});setOffset(offset+50);}}>{c.next}</button></nav>
 </section>;
}
