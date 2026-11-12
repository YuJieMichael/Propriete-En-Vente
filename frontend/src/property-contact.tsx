import {ArrowRight, CalendarDays, MessageCircle} from 'lucide-react';
import type {Language} from './seller-copy';
import {publicationCopy} from './publication-copy';

export function PropertyContact({reference,lang,price,mobile=false}:{reference:string;lang:Language;price:string;mobile?:boolean}){
  const c={
    fr:{team:'Équipe Propriété En Vente',caption:'Votre demande, au bon endroit.',visit:'Demander une visite',note:'Sans compte. Votre demande inclut la référence du bien. La date de visite sera confirmée avec vous.',languages:'Français · English · 中文'},
    en:{team:'Propriété En Vente team',caption:'Let’s talk about this property.',visit:'Request a viewing',note:'No account needed. Your request includes this property’s reference. The viewing time will be confirmed with you.',languages:'Français · English · 中文'},
    zh:{team:'Propriété En Vente 团队',caption:'从这套房源，开始下一步。',visit:'申请看房',note:'无需注册，咨询会自动附上房源编号。看房时间需由团队与您确认。',languages:'Français · English · 中文'},
  }[lang];
  const href=`#acheter?listing=${encodeURIComponent(reference)}`;
  const viewingHref=`${href}&intent=viewing`;
  if(mobile)return <div className="property-contact-mobile"><div><small>{publicationCopy[lang].reference} {reference}</small><strong>{price}</strong></div><a className="catalogue-cta" href={viewingHref}><CalendarDays aria-hidden="true"/>{c.visit}</a></div>;
  return <aside className="detail-contact">
    <p className="contact-eyebrow">{c.caption}</p>
    <h2>{publicationCopy[lang].contact}</h2>
    <div className="contact-team"><span aria-hidden="true">PV</span><div><strong>{c.team}</strong><small>{c.languages}</small></div></div>
    <a href={href} className="catalogue-cta"><MessageCircle aria-hidden="true"/>{publicationCopy[lang].enquire}<ArrowRight aria-hidden="true"/></a>
    <a href={viewingHref} className="contact-viewing"><CalendarDays aria-hidden="true"/>{c.visit}</a>
    <p className="contact-footnote">{c.note}</p>
  </aside>;
}
