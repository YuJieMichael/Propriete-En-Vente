import type { Language } from './seller-copy';

// Free first month for listings submitted through #publier.
// Keep in sync with FREE_LISTING_DAYS and private.free_listing_days() in SQL.
export const FREE_LISTING_DAYS = 30;

export const freeListingCopy: Record<Language, {
  promo: string; promoCta: string;
  badge: string; bannerTitle: string; bannerText: string; termsLink: string;
  savedNote: string; expires: string; expired: string; renew: string; renewing: string;
  renewed: string; renewFailed: string; renewHint: string;
  termsTitle: string; terms: string[];
}> = {
  fr: {
    promo: 'Vendez par vous-même : votre annonce est affichée gratuitement 30 jours, sans carte de crédit.',
    promoCta: 'Publier gratuitement',
    badge: '1er mois gratuit',
    bannerTitle: 'Premier mois gratuit',
    bannerText: 'Après approbation, votre annonce est affichée gratuitement pendant 30 jours. Aucune carte de crédit n’est demandée. Nous vous écrivons 7 jours avant la fin; sans prolongation, l’annonce est retirée automatiquement, sans frais.',
    termsLink: 'Conditions de l’offre',
    savedNote: 'Les 30 jours gratuits commencent le jour de l’approbation.',
    expires: 'Gratuit jusqu’au',
    expired: 'Expirée',
    renew: 'Prolonger de 30 jours',
    renewing: 'Prolongation…',
    renewed: 'Annonce prolongée de 30 jours.',
    renewFailed: 'La prolongation n’a pas été enregistrée. Actualisez et réessayez.',
    renewHint: 'Prolongez seulement après entente avec le vendeur. Aucun paiement n’est traité sur le site.',
    termsTitle: 'Annonces gratuites — premier mois',
    terms: [
      'Les propriétaires et vendeurs peuvent soumettre une propriété au Québec. Chaque annonce est examinée avant publication; nous pouvons demander des précisions, refuser ou retirer une annonce inexacte, en double ou non conforme.',
      'Une annonce approuvée est affichée gratuitement pendant 30 jours à compter de l’approbation. Aucun moyen de paiement n’est demandé et aucun montant n’est prélevé automatiquement.',
      'Un courriel de rappel est envoyé 7 jours avant la fin. À la date prévue, l’annonce est retirée automatiquement du catalogue. Pour la prolonger ou la remettre en ligne, communiquez avec nous; les conditions de prolongation vous sont confirmées avant toute prolongation.',
      'Vous êtes responsable de l’exactitude de l’annonce et de vos droits sur les photos. Vos coordonnées restent privées. L’affichage d’une annonce n’est pas un mandat de courtage; si vous souhaitez l’aide d’un courtier, demandez-le séparément.',
    ],
  },
  en: {
    promo: 'Selling on your own? Your listing is displayed free for 30 days, no credit card needed.',
    promoCta: 'List for free',
    badge: 'First month free',
    bannerTitle: 'First month free',
    bannerText: 'Once approved, your listing is displayed free for 30 days. No credit card is required. We email you 7 days before it ends; if it is not extended, the listing is removed automatically at no charge.',
    termsLink: 'Offer terms',
    savedNote: 'The 30 free days start on the day of approval.',
    expires: 'Free until',
    expired: 'Expired',
    renew: 'Extend by 30 days',
    renewing: 'Extending…',
    renewed: 'Listing extended by 30 days.',
    renewFailed: 'The extension was not saved. Refresh and try again.',
    renewHint: 'Extend only after agreeing with the seller. No payment is processed on the site.',
    termsTitle: 'Free listings — first month',
    terms: [
      'Owners and sellers can submit a property located in Québec. Every listing is reviewed before publication; we may ask for details, decline or remove a listing that is inaccurate, duplicated or non-compliant.',
      'An approved listing is displayed free for 30 days from approval. No payment method is requested and nothing is charged automatically.',
      'A reminder email is sent 7 days before the end. On the end date, the listing is removed from the catalogue automatically. To extend it or put it back online, contact us; extension terms are confirmed with you before any extension.',
      'You are responsible for the accuracy of the listing and your rights to the photos. Your contact details stay private. Displaying a listing is not a brokerage contract; if you want a broker’s help, ask for it separately.',
    ],
  },
  zh: {
    promo: '业主自己卖房：房源审核通过后免费展示 30 天，不绑信用卡。',
    promoCta: '免费挂房',
    badge: '首月免费',
    bannerTitle: '首月免费挂房',
    bannerText: '房源审核通过后，免费展示 30 天，不需要绑定信用卡。到期前 7 天我们会发邮件提醒；如不续期，房源到期自动下架，不收任何费用。',
    termsLink: '优惠条款',
    savedNote: '30 天免费期从审核通过当天开始计算。',
    expires: '免费至',
    expired: '已到期',
    renew: '续期 30 天',
    renewing: '续期中…',
    renewed: '已续期 30 天。',
    renewFailed: '续期未保存，请刷新后重试。',
    renewHint: '请先与卖家确认后再续期。网站不处理任何付款。',
    termsTitle: '免费挂房（首月）',
    terms: [
      '业主和卖家可以提交位于魁北克的房产。每条房源发布前都会审核；如信息不准确、重复或不合规，我们可以要求补充、拒绝或下架。',
      '房源审核通过后，从通过当天起免费展示 30 天。不需要提供任何付款方式，也不会自动扣费。',
      '到期前 7 天会发送提醒邮件。到期当天房源自动从目录下架。如需续期或重新上架，请联系我们；续期条件会在续期前与您确认。',
      '您需对房源信息的准确性和照片的使用权负责。您的联系方式不会公开。展示房源不构成经纪委托；如需经纪协助，请另行提出。',
    ],
  },
};

export function freeUntil(iso: string, lang: Language) {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : `${lang}-CA`, { dateStyle: 'medium' }).format(new Date(iso));
}
