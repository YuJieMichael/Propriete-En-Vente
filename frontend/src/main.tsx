import {Reveal} from './reveal';
import {CategoryLinks} from "./category-guide";
import {homePath, cataloguePath, catalogueHref, categoryPath, languageHref, pathLanguage, routeHash, normalizePublicLocation, updateSeo} from "./seo";
import {readCalculatorAmount} from "./lib/calculator-handoff";
import {queueSearchIntent} from './lib/discovery-handoff';
import {captureAcquisitionSource} from './lib/acquisition-source';
import {trackSiteVisit} from './lib/traffic-metrics';
import {readEnquiryPreset} from './lib/enquiry-route';
import {inSiteHref,openInSite,savedScroll} from './lib/public-navigation';
import {SiteUpdate} from "./site-update";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Check,
  Earth,
  House,
  KeyRound,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import homeCopy from "./home-copy.json";
import { ProjectProvider, useProject } from "./project";
import { AuthProvider, AuthPage, useAuth } from "./auth";
import { ProjectStatus } from "./project-status";
import type { Language } from "./seller-copy";
import "./original.css";
import "./styles.css";
import "./dashboard.css";
import "./publication.css";
import "./workspace.css";
import { publicationCopy } from "./publication-copy";
import { WorkspaceErrorBoundary } from "./workspace-error-boundary";

const loadPublish = () => import("./publish-property");
const loadListings = () => import("./listings");
const loadEnquiry = () => import("./enquiry");
const loadAdmin = () => import("./admin");
const loadProjects = () => import("./projects");
const loadWanted = () => import('./wanted-board');
function warmRoute(href:string){
  const target=new URL(href,location.href);
  const hash=routeHash(target.pathname,target.search,target.hash).slice(1);
  const load=hash.startsWith("propriet")?loadListings:hash.startsWith("recherches")?loadWanted:hash.startsWith("acheter")||hash.startsWith("vendre")?loadEnquiry:hash.startsWith("admin")?loadAdmin:hash.startsWith("projects")||hash.startsWith("dashboard")?loadProjects:hash.startsWith("publier")?loadPublish:null;
  if(load)void load().catch(()=>{});
}
const PublishProperty = lazy(() => loadPublish().then(module => ({ default: module.PublishProperty })));
const Dashboard = lazy(() => import("./dashboard").then(module => ({ default: module.Dashboard })));
const Projects = lazy(() => loadProjects().then(module => ({default:module.Projects})));
const SellerFlow = lazy(() => import("./seller-flow").then(module => ({default:module.SellerFlow})));
const AdminPage = lazy(() => loadAdmin().then(module => ({ default: module.AdminPage })));
const EnquiryForm = lazy(() => loadEnquiry().then(module => ({ default: module.EnquiryForm })));
const PublicationEntry = lazy(() => loadEnquiry().then(module => ({ default: module.PublicationEntry })));
const ListingsPage = lazy(() => loadListings().then(module => ({ default: module.ListingsPage })));
const FeaturedProperties = lazy(() => loadListings().then(module => ({ default: module.FeaturedProperties })));
const HomeOverview = lazy(() => loadListings().then(module => ({ default: module.HomeOverview })));
const WantedBoard = lazy(() => loadWanted().then(module=>({default:module.WantedBoard})));

const labels = { en: "EN", fr: "FR", zh: "中文" };
const notices = {
  fr: {
    search: "La recherche de propriétés n’est pas encore disponible.",
    portal: "L’espace client n’est pas encore disponible.",
    form: "Formulaire de démonstration : aucune information ne sera envoyée.",
    sent: "Démonstration terminée. Votre demande n’a pas été envoyée.",
    nav: "Navigation principale",
  },
  en: {
    search: "Property search is not available yet.",
    portal: "The client portal is not available yet.",
    form: "Demo form: no information will be sent.",
    sent: "Demo completed. Your request has not been sent.",
    nav: "Main navigation",
  },
  zh: {
    search: "房源搜索尚未开放。",
    portal: "客户后台尚未开放。",
    form: "演示表单：不会发送任何资料。",
    sent: "演示完成，您的咨询尚未发送。",
    nav: "主导航",
  },
};

// The header compacts once the page moves; the back-to-top button appears after a long scroll.
function useScrolled() {
  const [state, setState] = useState({ compact: false, far: false });
  useEffect(() => {
    const update = () => {
      const compact = window.scrollY > 24, far = window.scrollY > 1200;
      setState(previous => previous.compact === compact && previous.far === far ? previous : { compact, far });
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, []);
  return state;
}

function BackToTop({ lang, visible }: { lang: Language; visible: boolean }) {
  const label = { en: "Back to top", fr: "Retour en haut", zh: "回到顶部" }[lang];
  return <button type="button" className="back-to-top" data-visible={visible || undefined} aria-label={label} title={label} tabIndex={visible ? 0 : -1} aria-hidden={!visible} onClick={() => { window.scrollTo({ top: 0 }); document.getElementById("root")?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }); }}><ArrowUp aria-hidden="true" /></button>;
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href={homePath(pathLanguage(location.pathname))}
      className={`brand ${footer ? "footer-brand" : ""}`}
      aria-label="Propriété En Vente"
    >
      <span className="brand-mark">
        <House aria-hidden="true" />
      </span>
      <span>Propriété En Vente</span>
    </a>
  );
}

function App() {
  const auth = useAuth();
  const [lang, setLang] = useState<Language>(() => pathLanguage(location.pathname));
  const [hash, setHash] = useState(()=>{captureAcquisitionSource();return normalizePublicLocation();});
  const publishing = hash.startsWith("#publier");
  const wanted = hash.startsWith('#recherches');
  const catalogue = hash.startsWith("#proprietes") || hash.startsWith("#propriete/");
  const selling = hash.startsWith("#vendre");
  const dashboard = hash.startsWith("#dashboard");
  const projects = hash.startsWith('#projects') || dashboard;
  const projectId = /^#projects\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?:\/|$)/i.exec(hash)?.[1] ?? null;
  const editingProject = !!projectId && hash.endsWith('/edit');
  const demo = hash.startsWith("#demo");
  const admin = hash.startsWith("#admin");
  const legalPage = hash === "#privacy" || hash === "#terms";
  const browsing = hash.startsWith("#acheter") || hash.startsWith("#propriete/");
  const enquiryReference = new URLSearchParams(hash.split('?')[1] || '').get('listing') || '';
  const enquiryPreset=readEnquiryPreset(hash);
  const authRoute = /^#(login|register|forgot-password|reset-password|set-password|auth\/callback)/.test(hash)
    || new URLSearchParams(location.search).has("code") || new URLSearchParams(location.search).has("error")
    || hash.includes("access_token=") || hash.includes("error_description=") || auth.callbackPending;
  const [menu, setMenu] = useState(false);
  const scrolled = useScrolled();
  const [signingOut, setSigningOut] = useState(false);
  const d = homeCopy[lang];
  useEffect(()=>{
    const publicView=!hash||['#top','#approche','#processus','#parcours'].includes(hash)||catalogue;
    if(!auth.loading&&!auth.error&&!authRoute&&!auth.staffRole&&publicView)void trackSiteVisit();
  },[auth.loading,auth.error,auth.staffRole,authRoute,hash,catalogue]);
  const restoreScroll=useRef<number|null>(null);
  const previousHash=useRef(hash);
  useEffect(() => {
    const change = (event:Event) => {
      restoreScroll.current=savedScroll(event);
      warmRoute(location.hash);
      setHash(normalizePublicLocation());
      setLang(pathLanguage(location.pathname));
      setMenu(false);
    };
    const intent=(event:Event)=>{const anchor=(event.target as Element)?.closest?.("a[href]");if(anchor)warmRoute(anchor.getAttribute("href")||"");};
    const follow=(event:MouseEvent)=>{const href=inSiteHref(event);if(href){event.preventDefault();openInSite(href,(event.target as Element|null)?.closest?.("a")?.querySelector<HTMLElement>(".listing-photo img"));}};
    history.scrollRestoration="manual";
    warmRoute(location.hash);
    addEventListener("hashchange", change);
    addEventListener("popstate", change);
    document.addEventListener("pointerover",intent);document.addEventListener("focusin",intent);document.addEventListener("click",follow);
    return () => {removeEventListener("hashchange", change);removeEventListener("popstate", change);document.removeEventListener("pointerover",intent);document.removeEventListener("focusin",intent);document.removeEventListener("click",follow);};
  }, []);
  useEffect(() => {
    if (!hash.startsWith("#propriete/") && !/^#proprietes\?(?:.*&)?ville=/.test(hash)) updateSeo(lang,hash);
  }, [lang,hash]);
  useEffect(() => {
    const from=previousHash.current;previousHash.current=hash;
    const restore=restoreScroll.current;restoreScroll.current=null;
    // Runs after the page's own effects, so it overrides their scroll to the top.
    if(restore!==null){window.scrollTo({top:restore,behavior:"instant"});return;}
    // Changing filters keeps the visitor where they are in the results.
    if(from!==hash&&from.startsWith("#proprietes")&&hash.startsWith("#proprietes"))return;
    if (publishing || wanted || catalogue || selling || browsing || dashboard || !hash || hash === "#top")
      window.scrollTo({ top: 0, behavior: "instant" });
    else
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [hash, publishing, wanted, catalogue, selling, browsing, dashboard]);
  return (
    <>
      {signingOut && <p className="account-session" role="status">{{ fr: "Enregistrement et déconnexion…", en: "Saving and signing out…", zh: "正在保存并退出…" }[lang]}</p>}
      <div inert={signingOut}>
      <ProjectProvider key={auth.user?.id ?? "guest"} projectId={projectId}>
      <header className={`site-header ${projects || admin || demo ? 'workspace-header' : ''} ${scrolled.compact ? 'is-scrolled' : ''}`}>
        <Brand />
        <nav
          id="main-navigation"
          className={`main-nav ${menu ? "is-open" : ""}`}
          aria-label={notices[lang].nav}
        >
          {d.nav.map((n, i) => (
            <React.Fragment key={i}><a
              href={
                i === 0
                  ? cataloguePath(lang)
                  : i === 1
                    ? "#publier"
                    : i === 2
                      ? `${homePath(lang)}#approche`
                      : `${homePath(lang)}#processus`
              }
              onClick={() => setMenu(false)}
              aria-current={i === 0 && catalogue || i === 1 && publishing ? "page" : undefined}
            >
              {n}
            </a>
            </React.Fragment>
          ))}
          <a
            className="mobile-workspace-link"
            href="#publier"
            onClick={() => setMenu(false)}
          >
            {
              {
                fr: "Publier une annonce",
                en: "Publish a listing",
                zh: "发布房源",
              }[lang]
            }
          </a>
        </nav>
        <div className="header-actions">
          <div className="language-switch" aria-label="Language">
            <Earth aria-hidden="true" />
            {(Object.keys(labels) as Language[]).map((l) => (
              <a
                key={l}
                href={languageHref(l,location.pathname,location.search,location.hash)}
                lang={l}
                className={lang === l ? "active" : ""}
                aria-current={lang === l ? "page" : undefined}
              >
                {labels[l]}
              </a>
            ))}
          </div>
          {auth.user ? <HeaderAccount lang={lang} onLeavingChange={setSigningOut} /> : <a className="header-login" href="#login" onClick={() => setMenu(false)}><KeyRound size={17} aria-hidden="true" />{{ fr: "Espace client", en: "User center", zh: "用户中心" }[lang]}</a>}
          <button
            className="menu-button"
            type="button"
            onClick={() => setMenu(!menu)}
            aria-label="Menu"
            aria-expanded={menu}
            aria-controls="main-navigation"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
        {(auth.user || dashboard || admin || authRoute) && <AccountSession lang={lang} />}
        <SiteUpdate lang={lang}/>
        <main>
          <WorkspaceErrorBoundary lang={lang}><Suspense fallback={<LoadingWorkspace lang={lang} />}>
          {authRoute ? <AuthPage lang={lang} /> : admin ? <AdminPage lang={lang} /> : legalPage ? <LegalPage lang={lang} kind={hash === "#privacy" ? "privacy" : "terms"} /> : wanted ? <WantedBoard lang={lang}/> : demo ? <ProjectProvider mode="demo"><Dashboard lang={lang} /></ProjectProvider> : publishing ? <PublishProperty lang={lang} /> : catalogue ? <ListingsPage lang={lang} hash={hash} handoffReady={!auth.loading} metricsReady={!auth.loading&&!auth.error&&!auth.staffRole&&!authRoute} /> : selling ? <PublicationEntry lang={lang} /> : projects ? (
            auth.loading ? <LoadingWorkspace lang={lang} /> : !auth.user ? <AuthPage lang={lang} /> : !projectId ? <Projects lang={lang}/> : <PrivateWorkspace lang={lang}>{editingProject?<SellerFlow key={projectId} lang={lang}/>:<Dashboard key={projectId} lang={lang} />}</PrivateWorkspace>
          ) : browsing ? auth.loading ? <LoadingWorkspace lang={lang}/> : <EnquiryForm key={`buyer-${enquiryReference}-${enquiryPreset}-${readCalculatorAmount(hash,"buyer")}`} kind="buyer" lang={lang} initialAmount={readCalculatorAmount(hash,"buyer")} listingReference={enquiryReference} initialPropertyType={enquiryPreset} onContinue={() => {location.hash="proprietes";}} /> : <Home lang={lang} />}
          </Suspense></WorkspaceErrorBoundary>
        </main>
      {!(projects || admin || demo) && <BackToTop lang={lang} visible={scrolled.far} />}
      <footer hidden={projects || admin || demo}>
        <Brand footer />
        <p>{d.footer}</p>
        <CategoryLinks lang={lang} />
        <a className="wanted-footer-link" href={`${homePath(lang)}#recherches`}>{{en:'Anonymous property wanted cards',fr:'Recherches immobilières anonymes',zh:'匿名求购卡'}[lang]}</a>
        <nav className="footer-legal" aria-label={{en:"Legal links",fr:"Liens juridiques",zh:"法律链接"}[lang]}>
          <a href="#privacy">{{en:"Privacy policy",fr:"Confidentialité",zh:"隐私政策"}[lang]}</a><span aria-hidden="true">·</span>
          <a href="#terms">{{en:"Terms of use",fr:"Conditions d’utilisation",zh:"使用条款"}[lang]}</a><span aria-hidden="true">·</span>
          <a href={{en:"https://www.oaciq.com/en/general-public/",fr:"https://www.oaciq.com/fr/grand-public/",zh:"https://www.oaciq.com/en/general-public/"}[lang]} target="_blank" rel="noreferrer">OACIQ</a>
        </nav>
      </footer>
      </ProjectProvider>
      </div>
    </>
  );
}

function LegalPage({lang,kind}:{lang:Language;kind:'privacy'|'terms'}) {
  const content={
    fr:{privacy:['Confidentialité','Les renseignements soumis dans les formulaires servent à répondre à votre demande et à communiquer avec vous à ce sujet. Les coordonnées de contact d’une annonce restent privées; seuls les détails immobiliers et photos autorisés sont rendus publics après examen. Ne transmettez pas de documents financiers ni de renseignements sensibles. Pour demander l’accès, la correction ou le retrait de vos renseignements, écrivez à achat.vente.garderie@gmail.com.'],terms:['Conditions d’utilisation','Le catalogue peut contenir des annonces fournies par des vendeurs; vérifiez les renseignements et disponibilités directement avant toute décision. Une demande de contact n’est ni une offre d’achat, ni un mandat de courtage, ni une commande de service. Aucun paiement en ligne ou forfait payant n’est actuellement proposé. Une annonce n’est publiée qu’après examen et autorisation distincte.']},
    en:{privacy:['Privacy policy','Information submitted through forms is used to respond to your request and contact you about it. Contact details for a listing remain private; only approved property details and photos are made public after review. Do not send financial documents or sensitive information. To request access, correction or removal of your information, email achat.vente.garderie@gmail.com.'],terms:['Terms of use','The catalogue may contain seller-provided listings; verify details and availability directly before making a decision. A contact request is not an offer to purchase, a brokerage contract or an order for a service. Online payments and paid packages are not currently offered. Listings are published only after review and separate authorization.']},
    zh:{privacy:['隐私政策','表单中提交的信息用于回复您的需求并就此与您联系。房源联系信息保持私密；只有经过审核并获准的房屋资料和照片才会公开。请勿提交财务文件或敏感信息。如需查询、更正或删除个人信息，请发邮件至 achat.vente.garderie@gmail.com。'],terms:['使用条款','房源目录可能包含卖家提供的信息；作出决定前，请直接核实资料和房源状态。提交联系需求不构成购房报价、经纪委托或服务订单。目前网站不提供在线付款或付费套餐。房源须经审核及另行授权后才会发布。']}
  }[lang][kind];
  return <section className="legal-page"><a href="#top">← {{fr:'Accueil',en:'Home',zh:'首页'}[lang]}</a><h1>{content[0]}</h1><p>{content[1]}</p>{kind==='privacy'&&<><h2>{{en:'Anonymous wanted cards and private replies',fr:'Recherches anonymes et réponses privées',zh:'匿名求购卡与私密回复'}[lang]}</h2><p>{{en:'With your separate consent, the structured conditions in a wanted card are published after review. Your name, account identifier and email are not displayed on the public card. Replies are visible to the requester, their sender and authorized staff. You can withdraw your card from My wanted cards; it also expires after 90 days. Return to your cards to read replies; this feature does not automatically send notification emails.',fr:'Avec votre consentement distinct, les critères structurés d’une recherche sont publiés après examen. Votre nom, identifiant de compte et courriel ne figurent pas sur la carte publique. Les réponses sont visibles par le demandeur, leur auteur et l’équipe autorisée. Vous pouvez retirer votre carte dans Mes recherches; elle expire aussi après 90 jours. Revenez dans vos recherches pour lire les réponses; cette fonction n’envoie pas automatiquement de courriels.',zh:'经您另行同意，求购卡中的结构化条件会在审核后公开；公开卡片不显示姓名、账号标识或邮箱。回复仅对求购者、回复发送者及获授权团队可见。您可以在“我的求房”中撤回卡片，卡片也会在90天后到期。请返回求购板查看回复，此功能不会自动发送通知邮件。'}[lang]}</p></>}{kind==='privacy'&&<><h2>{{en:'Visit and channel counts',fr:'Comptage des visites et des sources',zh:'访问与渠道统计'}[lang]}</h2><p>{{en:'We record aggregate visit, property-view and confirmed-enquiry counts by broad source. This does not send your full URL, search sentence or contact fields to visit analytics. Limited channel labels and a short event ledger are stored only within this tab and used in fixed 30-minute windows. Automatic visit events respect Do Not Track and Global Privacy Control. The server processes the connection IP into a daily hash for abuse limits; confirmed enquiries are counted separately as operational records. Counts may include internal testing and are not unique people.',fr:'Nous comptons les visites, les consultations d’annonces et les demandes confirmées par source générale. Les statistiques de visite ne reçoivent ni l’URL complète, ni la phrase de recherche, ni les coordonnées. Des étiquettes de source limitées et un petit registre d’événements sont conservés dans cet onglet et utilisés par fenêtres fixes de 30 minutes. Les événements automatiques respectent Do Not Track et Global Privacy Control. Le serveur transforme l’adresse IP de connexion en empreinte quotidienne pour limiter les abus; les demandes confirmées sont comptées séparément comme opérations. Les comptes peuvent inclure des essais internes et ne représentent pas des personnes uniques.',zh:'我们按大类来源累计访问、房源浏览和已确认咨询的次数。访问统计不接收完整网址、找房句子或联系字段。有限渠道标记和简短事件记录仅保存在当前标签页，归因与去重使用固定30分钟窗口；自动访问事件尊重Do Not Track和Global Privacy Control。服务器为防滥用将连接IP转换为每日哈希，已确认咨询另作业务记录计数。统计可能包含内部测试，不代表独立访客人数。'}[lang]}</p></>}</section>;
}

function HeaderAccount({lang,onLeavingChange}:{lang:Language;onLeavingChange:(value:boolean)=>void}) {
  const auth=useAuth(); const p=useProject(); const [leaving,setLeaving]=useState(false); const [error,setError]=useState("");
  const copy={fr:{account:"Espace client",logout:"Déconnexion",busy:"Enregistrement…",failed:"Enregistrement impossible. Ouvrez votre espace et réessayez."},en:{account:"User center",logout:"Sign out",busy:"Saving…",failed:"Could not save. Open your workspace and retry."},zh:{account:"用户中心",logout:"退出登录",busy:"正在保存…",failed:"保存失败，请进入工作台重试。"}}[lang];
  async function leave(){if(leaving||p.busy)return;setLeaving(true);onLeavingChange(true);setError("");try{if(!p.isDemo&&p.project&&(p.saveState==="dirty"||p.saveState==="saving"||p.error)&&!await p.saveNow()){setError(copy.failed);return;}await auth.signOut();location.hash="login";}catch{setError(copy.failed);}finally{setLeaving(false);onLeavingChange(false);}}
  return <div className="header-account"><a className="header-account-info" href={auth.staffRole ? "#admin" : "#dashboard"} title={auth.user?.email||undefined}><KeyRound size={17} aria-hidden="true"/><span>{auth.staffRole ? ({fr:"Administration",en:"Administration",zh:"管理后台"}[lang]) : copy.account}</span></a><button className="header-logout" type="button" disabled={leaving||p.busy} onClick={()=>void leave()}>{leaving?copy.busy:copy.logout}</button>{error&&<span className="header-account-error" role="alert">{error}</span>}</div>;
}

function LoadingWorkspace({ lang }: { lang: Language }) {
  return <div className="workspace-loading" role="status">{{ fr: "Chargement de votre espace…", en: "Loading your workspace…", zh: "正在载入您的工作台…" }[lang]}</div>;
}

function PrivateWorkspace({ lang, children }: { lang: Language; children: React.ReactNode }) {
  const p = useProject();
  if (p.loading) return <LoadingWorkspace lang={lang} />;
  if (!p.project) return <div className="workspace-loading"><ProjectStatus lang={lang} /></div>;
  return <>{children}</>;
}

function AccountSession({ lang }: { lang: Language }) {
  const auth = useAuth();
  const t = (fr: string, en: string, zh: string) => ({ fr, en, zh })[lang];
  const authIssue = auth.error && <span role="alert">
    {t("Impossible de vérifier votre compte. Réessayez.", "We could not verify your account status. Please retry.", "无法确认您的账号状态，请重试。")}
    <button type="button" disabled={auth.loading} onClick={() => void auth.refreshAuth()}>{auth.loading ? t("Vérification…", "Checking…", "正在检查…") : t("Réessayer", "Retry", "重试")}</button>
  </span>;
  return authIssue ? <div className="account-session">{authIssue}</div> : null;
}

const heroCategories:[(lang:Language)=>string,Record<Language,string>][]=[
  [lang=>categoryPath(lang,'hotel-motel'),{fr:'Hôtels et motels',en:'Hotels and motels',zh:'酒店 / 汽车旅馆'}],
  [lang=>categoryPath(lang,'daycare'),{fr:'Garderies',en:'Daycares',zh:'托儿所'}],
  [lang=>categoryPath(lang,'land'),{fr:'Terrains',en:'Land',zh:'土地'}],
  [lang=>categoryPath(lang,'business'),{fr:'Entreprises',en:'Businesses',zh:'企业'}],
  [lang=>catalogueHref(lang,'?type=house'),{fr:'Maisons',en:'Houses',zh:'独立屋'}],
  [lang=>catalogueHref(lang,'?type=condo'),{fr:'Condos',en:'Condos',zh:'公寓'}],
];

function Home({ lang }: { lang: Language }) {
  const d = homeCopy[lang];
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHandoffError,setSearchHandoffError]=useState(false);
  const sentencePlaceholder={en:'A condo in Montreal under $700,000, 2 bedrooms, with parking',fr:'Un condo à Montréal, moins de 700 000 $, 2 chambres, avec stationnement',zh:'蒙特利尔70万以内、两间卧室、有车位的公寓'}[lang];
  return (
    <>
      <section id="top" className="hero-section">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow light">
            <Sparkles aria-hidden="true" />
            {d.eyebrow}
          </p>
          <h1>{d.heroTitle}</h1>
          <p className="hero-copy">{d.heroText}</p>
          <div className="hero-actions">
            <a className="primary-link" href={cataloguePath(lang)}>
              {d.buy}
              <ArrowRight />
            </a>
            <a className="secondary-link" href="#publier">
              {d.sell}
            </a>
          </div>
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchHandoffError(false);
              if(searchQuery.trim()&&!queueSearchIntent(searchQuery)){setSearchHandoffError(true);return;}
              openInSite(cataloguePath(lang));
            }}
          >
            <MapPin aria-hidden="true" />
            <input
              placeholder={sentencePlaceholder}
              aria-label={{en:'Describe your property search in one sentence',fr:'Décrivez votre recherche en une phrase',zh:'用一句话描述找房需求'}[lang]}
              value={searchQuery}
              maxLength={300}
              onChange={event => setSearchQuery(event.target.value)}
            />
            <button type="submit">
              <Search aria-hidden="true" />
              {{en:'Review my search',fr:'Préparer ma recherche',zh:'识别找房条件'}[lang]}
            </button>
          </form>
          {searchHandoffError&&<p className="hero-search-note" role="alert">{{en:'Open the property catalogue to enter your sentence there.',fr:'Ouvrez le catalogue pour y saisir votre recherche.',zh:'请打开房源目录，在那里输入找房需求。'}[lang]} <a href={cataloguePath(lang)}>{{en:'Open catalogue',fr:'Ouvrir le catalogue',zh:'打开房源目录'}[lang]}</a></p>}
          <p className="hero-search-note">{{en:'Review the recognized conditions before searching.',fr:'Vérifiez les conditions reconnues avant de lancer la recherche.',zh:'先核对识别出的条件，再搜索真实房源。'}[lang]} <a href={`${homePath(lang)}#recherches`}>{{en:'Post an anonymous wanted card',fr:'Publier une recherche anonyme',zh:'发布匿名求购卡'}[lang]} →</a></p>
          <nav className="hero-categories" aria-label={{en:'Property categories',fr:'Catégories de propriétés',zh:'物业分类'}[lang]}>
            {heroCategories.map(([href,label])=><a key={label.en} href={href(lang)}>{label[lang]}</a>)}
          </nav>
        </div>
        <div className="trust-row">
          {d.trust.map((t, i) => (
            <span key={i}>
              {i === 0 ? <BadgeCheck /> : i === 1 ? <ShieldCheck /> : <Earth />}
              {t}
            </span>
          ))}
        </div>
      </section>
      <Suspense fallback={<div className="featured-loading" role="status">{publicationCopy[lang].loading}</div>}><HomeOverview lang={lang} /><FeaturedProperties lang={lang} /></Suspense>
      <Reveal revealKey="home-path" id="parcours" className="section route-section">
        <div className="section-heading" id="approche">
          <div>
            <p className="eyebrow">{d.routeEyebrow}</p>
            <h2>{d.routeTitle}</h2>
            <p>{d.differenceText}</p>
          </div>
        </div>
        <div className="route-grid">
          {(["seller", "buyer"] as const).map((kind) => (
            <article key={kind} className={`route-card ${kind}-card`}>
              <div className="route-icon">
                {kind === "seller" ? <TrendingUp /> : <KeyRound />}
              </div>
              <h3>{d[`${kind}Title`]}</h3>
              <p>{d[`${kind}Text`]}</p>
              <ul>
                {d[`${kind}Points`].map((t) => (
                  <li key={t}>
                    <Check />
                    {t}
                  </li>
                ))}
              </ul>
              <a href={kind === "seller" ? "#publier" : cataloguePath(lang)}>
                {d[`${kind}Cta`]}
                <ArrowRight />
              </a>
            </article>
          ))}
        </div>
        <ol className="steps-grid home-steps" id="processus" aria-label={d.processTitle}>
          {d.steps.map(([n, title, text]) => (
            <li key={n}>
              <span>{n}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </Reveal>
    </>
  );
}

if (location.hostname === "www.proprieteenvente.ca") {
  location.replace(`https://proprieteenvente.ca${location.pathname}${location.search}${location.hash}`);
} else {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>,
  );
  if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
}
