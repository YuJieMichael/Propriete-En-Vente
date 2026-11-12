import type { Language } from './seller-copy';
import type { SaleScope } from '../../supabase/functions/_shared/listing-input';

export const saleScopeCopy: Record<Language, Record<SaleScope, string>> = {
  en: { property: 'Real estate only', business: 'Operating business only', both: 'Real estate and operating business' },
  fr: { property: 'Immeuble seulement', business: 'Entreprise seulement', both: 'Immeuble et entreprise' },
  zh: { property: '仅出售物业', business: '仅出售经营业务', both: '物业和经营业务一起出售' },
};

export const commercialIntakeCopy = {
  en: {
    scope: 'What is for sale?', choose: 'Choose what is included',
    private: 'For team review only', address: 'Exact address', photos: 'Actual property photos', preview: 'Public listing preview',
    hint: 'The team reviews the exact address and actual photos privately. Buyers see the city, area and public listing details.',
    publicHint: 'Keep the address, business name and other identifying details out of the public title and description.',
    photoHint: 'Add 1 to 4 JPEG, PNG or WebP photos, up to 20 MB each.',
    mediaHidden: 'The exact address and actual photos go to the review team.',
    consent: 'I am authorized to submit this project and its photos for private review. I request publication of the public listing details after approval.',
    rooms: 'Guest rooms (optional)', capacity: 'Licensed places (optional)', unknown: 'To confirm',
    withheld: 'Actual photos are withheld',
  },
  fr: {
    scope: 'Qu’est-ce qui est à vendre ?', choose: 'Choisir les éléments inclus',
    private: 'Pour l’équipe seulement', address: 'Adresse exacte', photos: 'Photos réelles du bien', preview: 'Aperçu de l’annonce publique',
    hint: 'L’équipe examine l’adresse exacte et les photos réelles en privé. Les acheteurs voient la ville, le secteur et les renseignements publics.',
    publicHint: 'Gardez l’adresse, le nom de l’entreprise et les autres détails permettant d’identifier le bien hors du titre et de la description publics.',
    photoHint: 'Ajoutez de 1 à 4 photos JPEG, PNG ou WebP, de 20 Mo maximum chacune.',
    mediaHidden: 'L’adresse exacte et les photos réelles sont réservées à l’équipe de révision.',
    consent: 'Je suis autorisé à soumettre ce projet et ses photos pour examen privé. Je demande la publication des renseignements publics après approbation.',
    rooms: 'Chambres de l’établissement (facultatif)', capacity: 'Places autorisées (facultatif)', unknown: 'À confirmer',
    withheld: 'Photos réelles non diffusées',
  },
  zh: {
    scope: '出售范围', choose: '请选择出售范围',
    private: '仅供团队审核', address: '准确地址', photos: '项目实拍照片', preview: '公开展示预览',
    hint: '团队私下审核准确地址和实拍照片。买家可以看到城市、区域和公开项目信息。',
    publicHint: '公开标题和描述请省略准确地址、商家名称及其他可识别项目的细节。',
    photoHint: '添加 1 至 4 张 JPEG、PNG 或 WebP 照片，每张不超过 20 MB。',
    mediaHidden: '准确地址和实拍照片仅交给审核团队。',
    consent: '我有权提交本项目及照片供团队私下审核，并申请在审核通过后发布公开项目信息。',
    rooms: '客房数量（选填）', capacity: '许可名额（选填）', unknown: '待确认',
    withheld: '实拍照片未公开',
  },
};
