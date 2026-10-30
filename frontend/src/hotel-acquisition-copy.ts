import type {SeoLanguage} from './seo';

// Public form intent only. Channel attribution belongs to the acquisition
// session and must not be replaced by this label.
export function hotelAcquisitionHref(lang:SeoLanguage){
  return `/${lang}/#acheter?propertyType=hotel-motel&intent=hotel-acquisition`;
}

export const hotelAcquisitionCopy={
  fr:{
    eyebrow:'Votre projet hôtelier au Québec',
    title:'Un hôtel ou un motel en vue ? Précisez votre recherche.',
    intro:'Consultez les annonces, puis indiquez votre budget, vos régions et votre calendrier. Vous pouvez décrire votre projet même sans avoir choisi une propriété.',
    criteriaTitle:'Les trois repères pour commencer',
    criteria:[['Budget d’acquisition','Un montant ou une fourchette à préciser.'],['Régions recherchées','Les villes ou régions qui vous intéressent.'],['Échéancier','Votre horizon d’achat, même approximatif.']],
    cta:'Décrire mon projet hôtelier',
    privacy:'Sans création de compte. Votre demande est transmise en privé à l’équipe Propriété En Vente pour le suivi.',
    guideTitle:'Avant de préciser votre projet',
  },
  en:{
    eyebrow:'Your Québec hotel acquisition',
    title:'Looking for a hotel or motel? Make your search specific.',
    intro:'Browse the listings, then share your budget, preferred regions and timeline. You can describe your project before choosing a particular property.',
    criteriaTitle:'Three details to start with',
    criteria:[['Acquisition budget','An amount or range to clarify.'],['Preferred regions','The cities or regions you are considering.'],['Timeline','Your intended purchase timing, even if approximate.']],
    cta:'Describe my hotel search',
    privacy:'No account needed. Your request is shared privately with the Propriété En Vente team for follow-up.',
    guideTitle:'Before describing your project',
  },
  zh:{
    eyebrow:'魁北克酒店与汽车旅馆收购',
    title:'想买酒店或汽车旅馆？先把需求说清楚。',
    intro:'浏览房源后，告诉我们您的预算、目标地区和计划时间。还没选定具体物业，也可以先说明收购需求。',
    criteriaTitle:'先明确这三个条件',
    criteria:[['收购预算','预计金额，或仍需讨论的预算范围。'],['目标地区','您考虑的城市或地区。'],['计划时间','希望何时购买，大致时间即可。']],
    cta:'填写酒店收购需求',
    privacy:'无需创建账号。需求将私密提交给 Propriété En Vente 团队，用于后续跟进。',
    guideTitle:'填写需求前，先了解这些',
  },
};
