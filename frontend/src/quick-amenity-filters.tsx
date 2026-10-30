import {ArrowUpDown,CarFront,Waves} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Filters} from './listings-data';
import type {Language} from './seller-copy';
import './quick-amenity-filters.css';

export const amenityFilterCopy={
 en:{title:'Quick filters',pool:'Pool',parking:'Parking',elevator:'Elevator',clear:'Clear',parkingHint:'On-site or listed street parking. See the property details.'},
 fr:{title:'Filtres rapides',pool:'Piscine',parking:'Stationnement',elevator:'Ascenseur',clear:'Effacer',parkingHint:'Stationnement sur place ou sur rue indiqué dans la fiche. Consultez les détails.'},
 zh:{title:'快捷筛选',pool:'泳池',parking:'停车',elevator:'电梯',clear:'清除',parkingHint:'包含房源车位或已注明的路边停车，详见房源资料。'},
};
export function QuickAmenityFilters({lang,filters,disabled,onChange,hasActiveFilters,onReset,resetLabel,children}:{lang:Language;filters:Filters;disabled:boolean;onChange:(patch:Partial<Filters>)=>void;hasActiveFilters:boolean;onReset:()=>void;resetLabel:string;children?:ReactNode}){
 const c=amenityFilterCopy[lang];
 return <div className="quick-amenity-filters" role="group" aria-label={c.title}>
  {([{key:'pool',Icon:Waves},{key:'parking',Icon:CarFront},{key:'elevator',Icon:ArrowUpDown}] as const).map(({key,Icon})=>
   <button type="button" className="amenity-toggle" key={key} aria-pressed={filters[key]} disabled={disabled} title={key==='parking'?c.parkingHint:undefined} onClick={()=>onChange({[key]:!filters[key]})}><Icon aria-hidden="true"/>{c[key]}</button>
  )}
  {hasActiveFilters&&<button type="button" className="clear-filters" aria-label={resetLabel} onClick={onReset}>{c.clear}</button>}
  {children}
 </div>;
}
