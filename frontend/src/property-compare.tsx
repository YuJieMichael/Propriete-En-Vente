import {useEffect,useRef} from 'react';
import {Columns3,X} from 'lucide-react';
import type {Language} from './seller-copy';

export const compareLimit=3;
export const compareCopy={
  fr:{add:'Comparer',limit:`Jusqu’à ${compareLimit} propriétés`,open:'Comparer',clear:'Effacer',title:'Comparer les propriétés',close:'Fermer la comparaison',remove:'Retirer',view:'Voir la fiche',selected:(n:number)=>`${n} ${n===1?'propriété sélectionnée':'propriétés sélectionnées'}`,hint:'Sélectionnez au moins deux propriétés.'},
  en:{add:'Compare',limit:`Up to ${compareLimit} properties`,open:'Compare',clear:'Clear',title:'Compare properties',close:'Close comparison',remove:'Remove',view:'View property',selected:(n:number)=>`${n} ${n===1?'property selected':'properties selected'}`,hint:'Select at least two properties.'},
  zh:{add:'对比',limit:`最多 ${compareLimit} 套`,open:'开始对比',clear:'清空',title:'房源对比',close:'关闭对比',remove:'移除',view:'查看房源',selected:(n:number)=>`已选 ${n} 套房源`,hint:'请至少选择两套房源。'},
} as const;

export type CompareColumn={id:string;title:string;href:string;image:string};
export type CompareRow=[label:string,values:string[]];

/** Bottom bar for the selected properties, and a side-by-side table in a dialog. */
export function PropertyCompare({lang,columns,rows,open,onOpen,onClose,onRemove,onClear}:{lang:Language;columns:CompareColumn[];rows:CompareRow[];open:boolean;onOpen:()=>void;onClose:()=>void;onRemove:(id:string)=>void;onClear:()=>void}){
  const c=compareCopy[lang];
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const modal=dialog.current;
    if(open&&columns.length>=2&&modal&&!modal.open)modal.showModal?.();
    if((!open||columns.length<2)&&modal?.open)modal.close();
  },[open,columns.length]);
  if(!columns.length)return null;
  return <>
    <div className="compare-bar" role="region" aria-label={c.title}>
      <div className="compare-bar-items">{columns.map(column=><span key={column.id}><img src={column.image} alt=""/><button type="button" aria-label={`${c.remove} · ${column.title}`} onClick={()=>onRemove(column.id)}><X aria-hidden="true"/></button></span>)}</div>
      <p>{c.selected(columns.length)}{columns.length<2&&<small>{c.hint}</small>}</p>
      <button type="button" className="compare-clear" onClick={onClear}>{c.clear}</button>
      <button type="button" className="catalogue-cta" disabled={columns.length<2} onClick={onOpen}><Columns3 aria-hidden="true"/>{c.open}</button>
    </div>
    <dialog className="compare-dialog" ref={dialog} aria-labelledby="compare-title" onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
      <div className="compare-dialog-head"><h2 id="compare-title">{c.title}</h2><button type="button" aria-label={c.close} onClick={onClose}><X aria-hidden="true"/></button></div>
      <div className="compare-table-wrap"><table className="compare-table">
        <thead><tr><th scope="col"><span className="listing-sr-only">{c.title}</span></th>{columns.map(column=><th key={column.id} scope="col"><img src={column.image} alt=""/><a href={column.href} onClick={onClose}>{column.title}</a></th>)}</tr></thead>
        <tbody>{rows.map(([label,values])=><tr key={label}><th scope="row">{label}</th>{values.map((value,index)=><td key={columns[index].id}>{value}</td>)}</tr>)}</tbody>
      </table></div>
    </dialog>
  </>;
}
