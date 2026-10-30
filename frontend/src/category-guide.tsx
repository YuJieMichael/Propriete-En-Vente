import {categories,categoryCopy,categoryPath,homePath,type SeoLanguage} from './seo';
import {hotelAcquisitionCopy} from './hotel-acquisition-copy';
import './hotel-acquisition.css';

export function CategoryLinks({lang}:{lang:SeoLanguage}) {
  return <nav className="category-links" aria-label={{en:'Property categories',fr:'Catégories de propriétés',zh:'物业分类'}[lang]}>{categories.map(type=><a key={type} href={categoryPath(lang,type)}>{categoryCopy(lang,type)!.title}</a>)}</nav>;
}

export function CategoryGuide({lang,type}:{lang:SeoLanguage;type:string}) {
  const copy=categoryCopy(lang,type);
  if(!copy)return null;
  // The hotel category's primary action is in HotelAcquisitionIntro above its
  // catalogue. Keep this supporting guide focused on preparing that request.
  if(type==='hotel-motel')return <section className="category-guide hotel-acquisition-guide"><h2>{hotelAcquisitionCopy[lang].guideTitle}</h2><p>{copy.intro}</p>{copy.questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>;
  return <section className="category-guide"><h2>{{en:'Prepare your purchase',fr:'Préparer votre achat',zh:'购前准备'}[lang]}</h2><p>{copy.intro}</p>{copy.questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<a className="catalogue-cta" href={`${homePath(lang)}#acheter`}>{{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]}</a></section>;
}
