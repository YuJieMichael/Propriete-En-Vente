import {ArrowRight,Building2} from 'lucide-react';
import type {SeoLanguage} from './seo';
import {hotelAcquisitionCopy,hotelAcquisitionHref} from './hotel-acquisition-copy';
import './hotel-acquisition.css';

/** Focused category introduction. Inventory and ordering remain in the catalogue. */
export function HotelAcquisitionIntro({lang}:{lang:SeoLanguage}){
  const t=hotelAcquisitionCopy[lang];
  return <section className="hotel-acquisition" aria-labelledby="hotel-acquisition-title">
    <div className="hotel-acquisition-lead">
      <p className="hotel-acquisition-eyebrow"><Building2 size={17} aria-hidden="true"/>{t.eyebrow}</p>
      <h2 id="hotel-acquisition-title">{t.title}</h2>
      <p className="hotel-acquisition-intro">{t.intro}</p>
      <a className="hotel-acquisition-cta" href={hotelAcquisitionHref(lang)} data-acquisition-entry="hotel">{t.cta}<ArrowRight size={18} aria-hidden="true"/></a>
      <p className="hotel-acquisition-privacy">{t.privacy}</p>
    </div>
    <div className="hotel-acquisition-criteria">
      <h3>{t.criteriaTitle}</h3>
      <ol>{t.criteria.map(([label,description],index)=><li key={label}><span className="hotel-acquisition-number" aria-hidden="true">0{index+1}</span><div><strong>{label}</strong><p>{description}</p></div></li>)}</ol>
    </div>
  </section>;
}
