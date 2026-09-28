import type {CSSProperties} from 'react';
import type {Language} from './seller-copy';
import {listingsCopy} from './listings-copy';
import type {Filters} from './listings-data';

export function PriceRange({filters,lang,ceiling,onChange,invalid}:{filters:Filters;lang:Language;ceiling:number;onChange:(patch:Partial<Filters>)=>void;invalid:boolean}){
 const c=listingsCopy[lang];
 const step=filters.transaction==='rent'?100:10000;
 const maximum=Math.ceil(Math.max(ceiling,Number(filters.min)||0,Number(filters.max)||0,step*10)/step)*step;
 const lower=Math.min(Number(filters.min)||0,maximum),upper=filters.max===''?maximum:Math.min(Number(filters.max),maximum);
 const money=(n:number)=>new Intl.NumberFormat(lang==='zh'?'zh-CN':`${lang}-CA`,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
 const title={fr:'Fourchette de prix',en:'Price range',zh:'价格区间'}[lang];
 const unlimited={fr:'Sans limite',en:'No limit',zh:'不限'}[lang];
 return <div className="price-range-filter" role="group" aria-label={title}>
  <div className="price-range-inputs">
   <label>{c.min}<input type="number" min="0" max="999999999" step="1" placeholder="0" value={filters.min} onChange={event=>onChange({min:event.target.value.replace(/\D/g,'').slice(0,9)})} aria-invalid={invalid||undefined} aria-describedby={invalid?'price-range-error':undefined}/></label>
   <label>{c.max}<input type="number" min="0" max="999999999" step="1" placeholder={unlimited} value={filters.max} onChange={event=>onChange({max:event.target.value.replace(/\D/g,'').slice(0,9)})} aria-invalid={invalid||undefined} aria-describedby={invalid?'price-range-error':undefined}/></label>
  </div>
  <div className="price-range-track" style={{'--range-start':`${lower/maximum*100}%`,'--range-end':`${upper/maximum*100}%`,'--min-z':lower>=maximum?5:3} as CSSProperties}>
   <div className="price-range-rail" aria-hidden="true"/><div className="price-range-fill" aria-hidden="true"/>
   <input className="price-range-min" type="range" min="0" max={maximum} step={step} value={lower} aria-label={c.min} aria-valuetext={money(lower)} onChange={event=>{const next=Math.min(Number(event.target.value),upper);onChange({min:next===0?'':String(next)});}}/>
   <input className="price-range-max" type="range" min="0" max={maximum} step={step} value={upper} aria-label={c.max} aria-valuetext={filters.max===''?unlimited:money(upper)} onChange={event=>{const next=Math.max(Number(event.target.value),lower);onChange({max:next===maximum?'':String(next)});}}/>
  </div>
  <div className="price-range-endpoints" aria-hidden="true"><span>0 $</span><span>{unlimited}</span></div>
 </div>;
}
