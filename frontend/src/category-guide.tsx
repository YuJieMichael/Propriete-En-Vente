import {categories,categoryCopy,categoryPath,homePath,type SeoLanguage} from './seo';

export function CategoryLinks({lang}:{lang:SeoLanguage}) {
  return <nav className="category-links" aria-label={{en:'Property categories',fr:'Catégories de propriétés',zh:'物业分类'}[lang]}>{categories.map(type=><a key={type} href={categoryPath(lang,type)}>{categoryCopy(lang,type)!.title}</a>)}</nav>;
}

export function CategoryGuide({lang,type}:{lang:SeoLanguage;type:string}) {
  const copy=categoryCopy(lang,type);
  if(!copy)return null;
  return <section className="category-guide"><h2>{{en:'Prepare your purchase',fr:'Préparer votre achat',zh:'购前准备'}[lang]}</h2><p>{copy.intro}</p>{copy.questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<a className="catalogue-cta" href={`${homePath(lang)}#acheter`}>{{en:'Tell us about your search',fr:'Préciser ma recherche',zh:'填写购买需求'}[lang]}</a></section>;
}
