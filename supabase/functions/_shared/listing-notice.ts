export const NOTICE_REPLY_TO = 'info@proprieteenvente.ca';
export const NOTICE_PHONE = '514-758-8358';

export type ListingNotice = {
  id: string;
  kind: 'reminder' | 'expired';
  reference: number;
  title: string;
  expiresAt: string;
  email: string;
  name: string;
};

export function parseNotice(value: unknown): ListingNotice {
  const v = value as Record<string, unknown>;
  if (!v || typeof v !== 'object') throw Error('invalid');
  if (typeof v.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(v.id)) throw Error('invalid');
  if (v.kind !== 'reminder' && v.kind !== 'expired') throw Error('invalid');
  if (typeof v.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) throw Error('invalid');
  if (typeof v.expiresAt !== 'string' || Number.isNaN(Date.parse(v.expiresAt))) throw Error('invalid');
  return {
    id: v.id, kind: v.kind, reference: Number(v.reference), title: String(v.title ?? '').slice(0, 120),
    expiresAt: v.expiresAt, email: v.email, name: String(v.name ?? '').slice(0, 120),
  };
}

const day = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'America/Toronto' }).format(new Date(iso));

// French first (default site language), then English, then Chinese.
export function noticeEmail(n: ListingNotice): { subject: string; text: string } {
  const ref = `#${n.reference}`;
  const title = n.title ? ` « ${n.title} »` : '';
  if (n.kind === 'reminder') {
    return {
      subject: `Votre annonce gratuite ${ref} expire le ${day(n.expiresAt, 'fr-CA')} / Your free listing expires soon / 您的免费房源即将到期`,
      text: [
        `Bonjour ${n.name},`,
        `Votre annonce${title} (référence ${ref}) sur Proprieteenvente.ca est publiée gratuitement jusqu’au ${day(n.expiresAt, 'fr-CA')}.`,
        `À cette date, elle sera retirée automatiquement. Aucun paiement ne sera prélevé.`,
        `Pour la prolonger, répondez à ce courriel ou appelez le ${NOTICE_PHONE}.`,
        '',
        `Hello ${n.name},`,
        `Your listing${n.title ? ` "${n.title}"` : ''} (reference ${ref}) on Proprieteenvente.ca is published free of charge until ${day(n.expiresAt, 'en-CA')}.`,
        `It will then be removed automatically. Nothing will be charged.`,
        `To extend it, reply to this email or call ${NOTICE_PHONE}.`,
        '',
        `${n.name}，您好：`,
        `您在 Proprieteenvente.ca 上的房源${n.title ? `「${n.title}」` : ''}（编号 ${ref}）免费展示至 ${day(n.expiresAt, 'zh-CN')}。`,
        `到期后房源会自动下架，不会收取任何费用。`,
        `如需续期，请直接回复本邮件或致电 ${NOTICE_PHONE}。`,
      ].join('\n'),
    };
  }
  return {
    subject: `Votre annonce ${ref} a été retirée / Your listing has been removed / 您的房源已下架`,
    text: [
      `Bonjour ${n.name},`,
      `La période gratuite de votre annonce${title} (référence ${ref}) est terminée et l’annonce a été retirée du site. Aucun paiement n’a été prélevé.`,
      `Pour la remettre en ligne, répondez à ce courriel ou appelez le ${NOTICE_PHONE}.`,
      '',
      `Hello ${n.name},`,
      `The free period for your listing${n.title ? ` "${n.title}"` : ''} (reference ${ref}) has ended and it has been removed from the site. Nothing was charged.`,
      `To put it back online, reply to this email or call ${NOTICE_PHONE}.`,
      '',
      `${n.name}，您好：`,
      `您的房源${n.title ? `「${n.title}」` : ''}（编号 ${ref}）免费展示期已结束，已从网站下架，没有收取任何费用。`,
      `如需重新上架，请直接回复本邮件或致电 ${NOTICE_PHONE}。`,
    ].join('\n'),
  };
}
