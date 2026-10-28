import {confidentialCopy} from './business-information';
import {cataloguePath} from "./seo";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Language } from './seller-copy';
import { backendConfigured } from './lib/supabase';
import './enquiry.css';
import { publicationCopy } from './publication-copy';
import { assistanceIds, enquiryOptions } from './enquiry-options';
import { useAuth } from './auth';
import {takePropertyQuestions} from './lib/discovery-handoff';
import {enquiryAnalyticsSource} from './lib/traffic-metrics';

type ContactMemory = { name: string; email: string; phone: string; contactLanguage: string; contactMethod: string; contactTime: string };
const contactMemoryKey = 'propriete-en-vente:last-contact:v1';
const emptyContactMemory: ContactMemory = { name: '', email: '', phone: '', contactLanguage: '', contactMethod: '', contactTime: '' };
function writeContactMemory(value: ContactMemory) {
  try { localStorage.setItem(contactMemoryKey, JSON.stringify(value)); } catch { /* Storage may be disabled in private browsing. */ }
}
function clearContactMemory() {
  try { localStorage.removeItem(contactMemoryKey); } catch { /* Storage may be disabled in private browsing. */ }
}

const copy = {
  en: { buy: 'Tell us about your home search', sell: 'Tell us about your property', intro: 'No account needed. Send your details to the Propriété En Vente team so we can follow up on your request.', basic: 'Your contact details', optional: 'Your project · optional', required: '* Required fields. All other fields are optional.', name: 'Full name', email: 'Email', phone: 'Phone', remember: 'Remember my contact details on this device', rememberHint: 'Only your name, email, phone and contact preferences are stored in this browser.', city: 'Preferred cities / neighbourhoods', sellerCity: 'Property city', min: 'Minimum budget (CAD)', max: 'Maximum budget (CAD)', price: 'Expected price (CAD)', address: 'Property address', type: 'Property type', types: ['Not specified', 'House', 'Condo', 'Plex', 'Commercial'], needs: 'Requirements / additional information', timing: 'Preferred timeline', mode: 'Preferred support', modes: ['Undecided', 'Self-sale / optional services', 'With a broker'], privacy: 'By sending this form, you ask Propriété En Vente to store your details and include them in a private email summary and contact you about this request. This does not subscribe you to marketing messages. Please do not include financial documents or other sensitive information.', submit: 'Send my request', sending: 'Sending…', done: 'Your request has been recorded.', receipt: 'The Propriété En Vente team will use the contact details you provided to follow up. This submission does not create a new account.', browse: 'View properties', home: 'Back to home', error: 'Your request could not be sent. Your entries are still here; please try again later.', range: 'The maximum budget must be greater than or equal to the minimum.', unavailable: 'This form is not connected yet. Your request has not been recorded.', rate: 'Too many attempts. Please try again later.' },
  fr: { buy: 'Parlez-nous de votre recherche', sell: 'Parlez-nous de votre propriété', intro: 'Aucun compte nécessaire. Transmettez vos coordonnées à l’équipe Propriété En Vente pour le suivi de votre demande.', basic: 'Vos coordonnées', optional: 'Votre projet · facultatif', required: '* Champs obligatoires. Tous les autres champs sont facultatifs.', name: 'Nom complet', email: 'Courriel', phone: 'Téléphone', remember: 'Mémoriser mes coordonnées sur cet appareil', rememberHint: 'Seuls votre nom, courriel, téléphone et préférences sont enregistrés dans ce navigateur.', city: 'Villes / quartiers recherchés', sellerCity: 'Ville de la propriété', min: 'Budget minimum (CAD)', max: 'Budget maximum (CAD)', price: 'Prix souhaité (CAD)', address: 'Adresse de la propriété', type: 'Type de propriété', types: ['Non précisé', 'Maison', 'Condo', 'Plex', 'Commercial'], needs: 'Critères / renseignements complémentaires', timing: 'Échéancier souhaité', mode: 'Accompagnement souhaité', modes: ['À déterminer', 'Vente autonome / services à la carte', 'Avec courtier'], privacy: 'En envoyant ce formulaire, vous demandez à Propriété En Vente de conserver vos renseignements et de les inclure dans un récapitulatif privé par courriel et de vous contacter au sujet de cette demande. Aucun abonnement publicitaire. Ne joignez pas de documents financiers ou de renseignements sensibles.', submit: 'Envoyer ma demande', sending: 'Envoi…', done: 'Votre demande a été enregistrée.', receipt: 'L’équipe Propriété En Vente utilisera les coordonnées fournies pour vous recontacter. Cette demande ne crée pas de nouveau compte.', browse: 'Voir les propriétés', home: 'Retour à l’accueil', error: 'Envoi impossible. Vos renseignements sont conservés dans ce formulaire; veuillez réessayer plus tard.', range: 'Le budget maximum doit être supérieur ou égal au minimum.', unavailable: 'Ce formulaire n’est pas encore connecté. Votre demande n’a pas été enregistrée.', rate: 'Trop de tentatives. Veuillez réessayer plus tard.' },
  zh: { buy: '告诉我们您的购房需求', sell: '告诉我们您的卖房计划', intro: '无需注册或登录。资料会保存给 Propriété En Vente 团队，用于跟进本次咨询。', basic: '基本联系信息', optional: '房产需求 · 选填', required: '* 为必填项，其余内容均可不填。', name: '姓名', email: '邮箱', phone: '电话', remember: '在此设备保存联系信息', rememberHint: '仅姓名、邮箱、电话和联系偏好保存在当前浏览器；公共设备请关闭。', city: '想购买的城市 / 社区', sellerCity: '房屋所在城市', min: '最低预算（加元）', max: '最高预算（加元）', price: '期望售价（加元）', address: '房屋地址', type: '房屋类型', types: ['暂未确定', '独立屋', '公寓', '多户住宅', '商业地产'], needs: '具体要求 / 补充信息', timing: '计划时间', mode: '希望获得的服务', modes: ['暂未确定', '自行出售 / 按需购买服务', '经纪服务'], privacy: '点击发送即表示您请 Propriété En Vente 保存这些资料并纳入内部邮件汇总，并就本次需求与您联系。不会因此订阅营销邮件。请勿填写财务文件或其他敏感信息。', submit: '发送需求', sending: '正在发送…', done: '您的需求已收录。', receipt: 'Propriété En Vente 团队将使用您填写的联系方式跟进。此次提交不会新建账号。', browse: '查看房源', home: '返回首页', error: '暂时无法发送，填写的内容仍保留在表单中，请稍后重试。', range: '最高预算不能低于最低预算。', unavailable: '表单收集服务尚未开通，您的需求尚未保存。', rate: '提交次数过多，请稍后重试。' },
};

const buyerPropertyTypes = {
  en: [['','Not specified'],['house','House'],['condo','Condo'],['plex','Plex'],['land','Land'],['hotel-motel','Hotel / Motel'],['daycare','Daycare'],['business','Business']],
  fr: [['','Non précisé'],['house','Maison'],['condo','Condo'],['plex','Plex'],['land','Terrain'],['hotel-motel','Hôtel / Motel'],['daycare','Garderie'],['business','Entreprise']],
  zh: [['','暂未确定'],['house','独立屋'],['condo','公寓'],['plex','多户住宅'],['land','土地'],['hotel-motel','酒店 / 汽车旅馆'],['daycare','托儿机构'],['business','企业']],
} as const;
const daycareCopy = {
  en: { title: 'Daycare subsidy status', subsidized: 'Subsidized', unsubsidized: 'Non-subsidized' },
  fr: { title: 'Statut de subvention de la garderie', subsidized: 'Subventionnée', unsubsidized: 'Non subventionnée' },
  zh: { title: '托儿机构补贴情况', subsidized: '有政府补贴', unsubsidized: '无政府补贴' },
};

const sellingCopy = {
  en: { title: 'How would you like to sell?', intro: 'Choose how you would like to work with a broker, then tell us about your property. No account needed.', broker: 'Sell with a broker', brokerText: 'Let a broker guide the sale and coordinate the next steps with you.', hybrid: 'Sell yourself + with a broker', hybridText: 'Stay involved in selling your home, with broker support at the stages you choose together.', choose: 'Choose this option', selected: 'Your selling approach', change: 'Change approach', note: 'This is an enquiry only. Public packages, prices and online payment are not available yet. We will confirm the scope and fees with you before any commitment.' },
  fr: { title: 'Comment souhaitez-vous vendre ?', intro: 'Choisissez votre façon de collaborer avec un courtier, puis présentez votre propriété. Aucun compte nécessaire.', broker: 'Vendre avec un courtier', brokerText: 'Confiez le suivi de la vente à un courtier qui coordonne les prochaines étapes avec vous.', hybrid: 'Vendre vous-même + avec un courtier', hybridText: 'Participez à la vente de votre propriété, avec l’accompagnement d’un courtier aux étapes définies ensemble.', choose: 'Choisir cette option', selected: 'Votre mode de vente', change: 'Changer de mode', note: 'Il s’agit uniquement d’une demande de renseignements. Les forfaits publics, les prix et le paiement en ligne ne sont pas encore offerts. La portée et les frais seront confirmés avant tout engagement.' },
  zh: { title: '您希望怎样卖房？', intro: '先选择卖房方式，再填写房屋和联系信息。无需注册或登录。', broker: '经纪卖', brokerText: '由经纪主导卖房流程，与您沟通并协调后续事项。', hybrid: '自己 + 经纪卖', hybridText: '您自己参与卖房，经纪按双方约定的分工提供专业协助。', choose: '选择此方式', selected: '已选卖房方式', change: '更改方式', note: '此处仅收集咨询需求。目前没有公开套餐、定价或在线付款；服务范围和费用会在合作前另行确认。' },
};

const publicationEntryCopy = {
  fr: { title: 'Publiez votre propriété sur Propriété En Vente', intro: 'La plateforme accueille les annonces des propriétaires et des courtiers. Préparez une fiche immobilière ; elle sera examinée avant toute publication.', points: ['Ajoutez le prix, le secteur, les caractéristiques et vos photos autorisées.', 'Vérifiez l’aperçu et transmettez vos coordonnées privées pour le suivi.', 'Conservez votre référence de soumission. L’annonce devient publique après approbation.'], note: 'La soumission d’une annonce ne constitue pas un mandat de courtage. Les coordonnées demandées dans le formulaire restent privées.', browse: 'Voir les annonces' },
  en: { title: 'List your property on Propriété En Vente', intro: 'The platform welcomes listings from owners and brokers. Prepare a property listing for review before publication.', points: ['Add the price, area, property features and photos you are authorised to use.', 'Check the preview and provide your private contact details for follow-up.', 'Keep your submission reference. The listing becomes public after approval.'], note: 'Submitting a listing does not create a brokerage contract. Contact details requested in the form remain private.', browse: 'Browse listings' },
  zh: { title: '在 Propriété En Vente 发布房源', intro: '平台面向房东和经纪人开放。填写物业资料并提交审核，通过后才会公开展示。', points: ['添加价格、所在区域、房屋配置，以及您有权使用的照片。', '查看房源预览，并留下用于后续联系的私密联系方式。', '保存提交编号。房源获批后才会公开展示。'], note: '提交房源不构成经纪委托。表单中的联系资料保持私密。', browse: '浏览房源' },
};

export function PublicationEntry({ lang }: { lang: Language }) {
  const t = publicationEntryCopy[lang];
  return <section className="enquiry-shell publication-intro">
    <p className="eyebrow">Propriété En Vente · {{fr:'Propriétaires et courtiers',en:'Owners and brokers',zh:'房东与经纪人'}[lang]}</p>
    <h1>{t.title}</h1><p>{t.intro}</p>
    <div className="enquiry-card"><ol>{t.points.map(point => <li key={point}>{point}</li>)}</ol><p className="enquiry-privacy">{t.note}</p><a className="wide-cta" href="#publier">{publicationCopy[lang].publish} →</a><a className="publication-intro-browse" href={cataloguePath(lang)}>{t.browse}</a></div>
  </section>;
}

const propertyEnquiryCopy = {
  fr: { title: 'Renseignez-vous sur cette propriété', intro: 'Demandez des précisions ou indiquez vos disponibilités pour une visite. La plateforme recueille votre demande avec la référence de l’annonce pour le suivi.', needs: 'Votre question / disponibilités pour une visite', submit: 'Envoyer ma demande sur ce bien' },
  en: { title: 'Ask about this property', intro: 'Ask for details or share your availability for a viewing. The platform collects your enquiry with the listing reference for follow-up.', needs: 'Your question / availability for a viewing', submit: 'Send my property enquiry' },
  zh: { title: '咨询这套房源', intro: '询问房屋详情，或说明您方便看房的时间。平台会收集您的需求，并保留所咨询的房源编号，方便后续跟进。', needs: '您的问题 / 方便看房的时间', submit: '发送这套房源的咨询' },
};

export function EnquiryForm({ kind, lang, onContinue, listingReference = '', initialAmount = '', initialPropertyType='', confidentialRequest=false }: { kind: 'buyer' | 'seller'; lang: Language; onContinue?: () => void; listingReference?: string; initialAmount?: string; initialPropertyType?:string; confidentialRequest?:boolean }) {
  const { user } = useAuth();
  const t = copy[lang];
  const nda=kind==='buyer'&&listingReference&&confidentialRequest?confidentialCopy[lang]:null;
  const propertyEnquiry = kind === 'buyer' && listingReference ? propertyEnquiryCopy[lang] : null;
  const selling = sellingCopy[lang];
  const options = enquiryOptions[lang];
  const [assistance, setAssistance] = useState<string[]>([]);
  const [service, setService] = useState<'broker' | 'hybrid' | null>(null);
  const [choosing, setChoosing] = useState(kind === 'seller');
  const intakeEnabled = backendConfigured && import.meta.env.VITE_ENQUIRY_ENABLED === 'true';
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<keyof Pick<typeof t, 'error' | 'range' | 'unavailable' | 'rate'> | null>(null);
  const [contact, setContact] = useState<ContactMemory>(() => ({ ...emptyContactMemory }));
  const [rememberContact, setRememberContact] = useState(false);
  const [propertyType, setPropertyType] = useState(kind==='buyer'&&initialPropertyType==='hotel-motel'?'hotel-motel':'');
  const hotelEnquiry=kind==='buyer'&&!listingReference&&propertyType==='hotel-motel'?{
    en:{title:'Tell us about your hotel or motel search',intro:'Share your acquisition budget, preferred regions and timeline. No account is needed; the team will follow up privately.',needs:'Your hotel project / questions to confirm'},
    fr:{title:'Décrivez votre recherche d’hôtel ou de motel',intro:'Précisez votre budget d’acquisition, vos régions et votre échéancier. Aucun compte nécessaire; l’équipe fera le suivi en privé.',needs:'Votre projet hôtelier / questions à confirmer'},
    zh:{title:'告诉我们您的酒店或汽车旅馆收购需求',intro:'请说明收购预算、目标地区和计划时间。无需创建账号，团队会私密跟进本次需求。',needs:'您的酒店收购计划 / 待确认问题'},
  }[lang]:null;
  const [initialQuestions]=useState(()=>kind==='buyer'?takePropertyQuestions(listingReference,lang):'');
  const emailEdited = useRef(false);
  const attempt = useRef({ body: '', id: '', source:'unknown' });
  const busy = useRef(false);
  const timelineInput = useRef<HTMLInputElement>(null);
  useEffect(() => { clearContactMemory(); }, []);
  useEffect(() => {
    if (!user?.email || emailEdited.current) return;
    setContact(current => {
      const next = { ...current, email: user.email! };
      if (rememberContact) writeContactMemory(next);
      return next;
    });
  }, [user?.email, rememberContact]);
  function updateContact(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, checked } = event.currentTarget as HTMLInputElement;
    if (name === 'rememberContact') {
      setRememberContact(checked);
      if (checked) writeContactMemory(contact); else clearContactMemory();
      return;
    }
    if (!(name in emptyContactMemory)) return;
    if (name === 'email') emailEdited.current = true;
    setContact(current => {
      const next = { ...current, [name]: value };
      if (rememberContact) writeContactMemory(next);
      return next;
    });
  }
  const today = new Date();
  const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const minimumDate = dateValue(today);
  const maximum = new Date(today);
  maximum.setFullYear(maximum.getFullYear() + 10);
  const maximumDate = dateValue(maximum);
  const openTimelinePicker = () => {
    const input = timelineInput.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else { input.focus(); input.click(); }
    } catch { input.focus(); input.click(); }
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || (kind === 'seller' && (!service || choosing))) return;
    const formData = new FormData(event.currentTarget);
    formData.delete('assistanceChoice');
    formData.delete('rememberContact');
    const values = Object.fromEntries(formData);
    if(nda)values.requirements=nda.prefix+'\n'+String(values.requirements||'').slice(0,3000-nda.prefix.length-1);
    if (!String(values.name).trim()) { setError('error'); return; }
    if (values.budgetMin && values.budgetMax && Number(values.budgetMin) > Number(values.budgetMax)) { setError('range'); return; }
    if (!intakeEnabled) { setError('unavailable'); return; }
    const body = JSON.stringify({ ...values, kind, language: lang, service: kind === 'seller' ? service : '', assistance: kind === 'seller' && service === 'hybrid' ? assistance.join(',') : '' });
    if (body !== attempt.current.body) attempt.current = { body, id: crypto.randomUUID(), source:enquiryAnalyticsSource() };
    busy.current = true; setState('sending'); setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-enquiry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ ...JSON.parse(body), requestId: attempt.current.id, analyticsSource:attempt.current.source }), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setError(response.status === 429 ? 'rate' : [404, 503].includes(response.status) ? 'unavailable' : 'error');
        setState('idle'); return;
      }
      setState('done');
    } catch { setError('error'); setState('idle'); }
    finally { busy.current = false; }
  }
  return <section className="enquiry-shell">
    <p className="eyebrow">Propriété En Vente · {kind === 'buyer' ? ({en:'Buy',fr:'Acheter',zh:'买房'}[lang]) : ({en:'Sell',fr:'Vendre',zh:'卖房'}[lang])}</p>
    {kind === 'seller' && <div className="publication-entry"><span>{publicationCopy[lang].listings}</span><a href="#publier">{publicationCopy[lang].publish} →</a></div>}
    <h1>{(nda?nda.request:null) || propertyEnquiry?.title || hotelEnquiry?.title || (kind === 'buyer' ? t.buy : choosing ? selling.title : t.sell)}</h1>
    {kind === 'buyer' && <a className="wide-cta enquiry-browse" href={cataloguePath(lang)}>{t.browse}</a>}
    {state === 'done' ? <div className="enquiry-card" role="status"><h2>{t.done}</h2><p>{t.receipt}</p>{onContinue && <button className="wide-cta" onClick={onContinue}>{t.browse}</button>}<a href="#top">{t.home}</a></div> : <>
      {kind === 'seller' && choosing ? <>
        <p>{selling.intro}</p>
        <div className="selling-options">
          {(['broker', 'hybrid'] as const).map(mode => <button key={mode} type="button" className="selling-option" onClick={() => { setService(mode); setChoosing(false); setError(null); }}>
            <span className="selling-option-title">{selling[mode]}</span>
            <span>{mode === 'broker' ? selling.brokerText : selling.hybridText}</span>
            <span className="selling-option-cta">{selling.choose} →</span>
          </button>)}
        </div>
        <div className="selling-comparison"><table><caption>{options.compare}</caption><thead><tr><th scope="col">{options.task}</th><th scope="col">{options.broker}</th><th scope="col">{options.hybrid}</th></tr></thead><tbody>{options.rows.map(([task, broker, hybrid]) => <tr key={task}><th scope="row">{task}</th><td>{broker}</td><td>{hybrid}</td></tr>)}</tbody></table></div>
        <p className="enquiry-privacy">{selling.note}</p>
      </> : <><p>{nda?.intro || propertyEnquiry?.intro || hotelEnquiry?.intro || t.intro}</p><p>{t.required}</p></>}
      {kind === 'seller' && !choosing && service && <div className="selling-selection"><div><span>{selling.selected}</span><strong>{selling[service]}</strong></div><button type="button" disabled={state === 'sending'} onClick={() => setChoosing(true)}>{selling.change}</button></div>}
      {!intakeEnabled && <p className="enquiry-preview" role="status">{{en:'Form preview · collection and email summaries will be enabled after setup.',fr:'Aperçu du formulaire · la collecte et les récapitulatifs par courriel seront activés après configuration.',zh:'表单预览 · 资料收集和邮件汇总将在配置完成后启用。'}[lang]}</p>}
      {nda&&<p className="enquiry-privacy">{nda.note}</p>}
      <form className="enquiry-card" onSubmit={submit} hidden={choosing}>
        <fieldset disabled={state === 'sending'}><legend>{t.basic}</legend><div className="enquiry-grid">
          <label>{t.name} *<input name="name" required maxLength={120} autoComplete="name" value={contact.name} onChange={updateContact} /></label>
          <label>{t.email} *<input name="email" required type="email" maxLength={254} autoComplete="email" value={contact.email} onChange={updateContact} /></label>
          <label>{t.phone}<input name="phone" type="tel" maxLength={40} autoComplete="tel" value={contact.phone} onChange={updateContact} /></label>
        </div></fieldset>
        <label className="enquiry-remember"><input name="rememberContact" type="checkbox" checked={rememberContact} onChange={updateContact} /><span><strong>{t.remember}</strong><small>{t.rememberHint}</small></span></label>
        <fieldset disabled={state === 'sending'}><legend>{t.optional}</legend><div className="enquiry-grid">
          {listingReference && kind === 'buyer' && <label>{({en:'Property reference',fr:'Référence de la propriété',zh:'房源编号'})[lang]}<input name="listingReference" value={listingReference} readOnly /></label>}
          <label>{kind === 'buyer' ? t.city : t.sellerCity}<input name="city" maxLength={200} /></label>
          <label>{t.type}<select name="propertyType" value={propertyType} onChange={event => setPropertyType(event.target.value)}>{(kind === 'buyer' ? buyerPropertyTypes[lang] : ['','house','condo','plex','commercial'].map((value,index)=>[value,t.types[index]])).map(([value,label])=><option key={value} value={value}>{kind === 'seller' && value === 'commercial' ? t.types[4] : label}</option>)}</select></label>
          {kind === 'buyer' && propertyType === 'daycare' && <fieldset className="enquiry-daycare"><legend>{daycareCopy[lang].title}</legend><div className="enquiry-daycare-choices"><label><input type="radio" name="daycareSubsidy" value="subsidized" required /><span>{daycareCopy[lang].subsidized}</span></label><label><input type="radio" name="daycareSubsidy" value="non-subsidized" required /><span>{daycareCopy[lang].unsubsidized}</span></label></div></fieldset>}
          {kind === 'buyer' ? <><label>{t.min}<input name="budgetMin" type="number" min="0" max="1000000000" step="1" /></label><label>{t.max}<input name="budgetMax" defaultValue={initialAmount} type="number" min="0" max="1000000000" step="1" /></label></> : <><label>{t.address}<input name="address" maxLength={300} autoComplete="street-address" /></label><label>{t.price}<input name="expectedPrice" defaultValue={initialAmount} type="number" min="0" max="1000000000" step="1" /></label></>}
          <label>{t.timing}<span className="enquiry-date-control"><input ref={timelineInput} name="timeline" type="date" min={minimumDate} max={maximumDate} /><button type="button" aria-label={lang === 'zh' ? '选择日期' : lang === 'fr' ? 'Choisir une date' : 'Choose a date'} onClick={openTimelinePicker}><CalendarDays aria-hidden="true" size={19} /></button></span></label>
          <label className="enquiry-full">{nda?.needs || propertyEnquiry?.needs || hotelEnquiry?.needs || t.needs}<textarea name="requirements" rows={4} maxLength={nda?3000-nda.prefix.length-1:3000} defaultValue={initialQuestions} /></label>
        </div></fieldset>
        {kind === 'seller' && service === 'hybrid' && <fieldset disabled={state === 'sending'}><legend>{options.assistance}</legend><p className="enquiry-privacy">{options.hint}</p><div className="enquiry-services">{assistanceIds.map((id, index) => <label key={id}><input type="checkbox" name="assistanceChoice" value={id} checked={assistance.includes(id)} onChange={event => setAssistance(current => event.target.checked ? id === 'unsure' ? ['unsure'] : [...current.filter(value => value !== 'unsure'), id] : current.filter(value => value !== id))} /><span>{options.services[index]}</span></label>)}</div></fieldset>}
        <fieldset disabled={state === 'sending'}><legend>{options.contact}</legend><div className="enquiry-grid">
          <label>{options.language}<select name="contactLanguage" value={contact.contactLanguage} onChange={updateContact}><option value="">{options.none}</option><option value="en">English</option><option value="fr">Français</option><option value="zh">中文</option></select></label>
          <label>{options.method}<select name="contactMethod" value={contact.contactMethod} onChange={updateContact}><option value="">{options.none}</option><option value="email">{options.email}</option><option value="phone">{options.phone}</option></select></label>
          <label className="enquiry-full">{options.availability}<input name="contactTime" maxLength={200} placeholder={options.timeHint} value={contact.contactTime} onChange={updateContact} /></label>
        </div><p className="enquiry-privacy">{options.phoneHint}</p></fieldset>
        <div className="enquiry-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <p className="enquiry-privacy">{t.privacy}</p>
        {error && <p role="alert">{t[error]}</p>}
        <button className="wide-cta" type="submit" disabled={state === 'sending'}>{state === 'sending' ? t.sending : nda?.submit || propertyEnquiry?.submit || t.submit}</button>
      </form>
    </>}
  </section>;
}
