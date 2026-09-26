import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Check,
  Earth,
  Handshake,
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

const PublishProperty = lazy(() => import("./publish-property").then(module => ({ default: module.PublishProperty })));
const Dashboard = lazy(() => import("./dashboard").then(module => ({ default: module.Dashboard })));
const Projects = lazy(() => import("./projects").then(module => ({default:module.Projects})));
const SellerFlow = lazy(() => import("./seller-flow").then(module => ({default:module.SellerFlow})));
const AdminPage = lazy(() => import("./admin").then(module => ({ default: module.AdminPage })));
const EnquiryForm = lazy(() => import("./enquiry").then(module => ({ default: module.EnquiryForm })));
const ListingsPage = lazy(() => import("./listings").then(module => ({ default: module.ListingsPage })));
const FeaturedProperties = lazy(() => import("./listings").then(module => ({ default: module.FeaturedProperties })));

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

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href="#top"
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
  const [lang, setLang] = useState<Language>("fr");
  const [hash, setHash] = useState(location.hash);
  const publishing = hash.startsWith("#publier");
  const catalogue = hash.startsWith("#proprietes") || hash.startsWith("#propriete/");
  const selling = hash.startsWith("#vendre");
  const [buyerSubmitted, setBuyerSubmitted] = useState(false);
  const dashboard = hash.startsWith("#dashboard");
  const projects = hash.startsWith('#projects') || dashboard;
  const projectId = /^#projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i.exec(hash)?.[1] ?? null;
  const editingProject = !!projectId && hash.endsWith('/edit');
  const demo = hash.startsWith("#demo");
  const admin = hash.startsWith("#admin");
  const browsing = hash.startsWith("#acheter") || hash.startsWith("#propriete/");
  const authRoute = /^#(login|register|forgot-password|reset-password|set-password|auth\/callback)/.test(hash)
    || new URLSearchParams(location.search).has("code") || new URLSearchParams(location.search).has("error")
    || hash.includes("access_token=") || hash.includes("error_description=") || auth.callbackPending;
  const [menu, setMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const d = homeCopy[lang];
  useEffect(() => {
    const change = () => {
      setHash(location.hash);
      setMenu(false);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  }, [lang]);
  useEffect(() => {
    if (publishing || catalogue || selling || browsing || dashboard || !hash || hash === "#top")
      window.scrollTo({ top: 0, behavior: "instant" });
    else
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [hash, publishing, catalogue, selling, browsing, dashboard]);
  return (
    <>
      {signingOut && <p className="account-session" role="status">{{ fr: "Enregistrement et déconnexion…", en: "Saving and signing out…", zh: "正在保存并退出…" }[lang]}</p>}
      <div inert={signingOut}>
      <ProjectProvider key={auth.user?.id ?? "guest"} projectId={projectId}>
      <header className={`site-header ${projects || admin || demo ? 'workspace-header' : ''}`}>
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
                  ? "#acheter"
                  : i === 1
                    ? "#vendre"
                    : i === 2
                      ? "#approche"
                      : "#processus"
              }
              onClick={() => setMenu(false)}
              aria-current={i === 0 && browsing ? "page" : undefined}
            >
              {n}
            </a>
            {i === 1 && <a href="#proprietes" onClick={() => setMenu(false)} aria-current={catalogue ? "page" : undefined}>{publicationCopy[lang].listings}</a>}
            </React.Fragment>
          ))}
          <a
            className="mobile-workspace-link"
            href="#vendre"
            onClick={() => setMenu(false)}
          >
            {
              {
                fr: "Mon projet de vente",
                en: "Start selling",
                zh: "填写卖房需求",
              }[lang]
            }
          </a>
        </nav>
        <div className="header-actions">
          <div className="language-switch" aria-label="Language">
            <Earth aria-hidden="true" />
            {(Object.keys(labels) as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                className={lang === l ? "active" : ""}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {labels[l]}
              </button>
            ))}
          </div>
          {auth.user ? <HeaderAccount lang={lang} onLeavingChange={setSigningOut} /> : <a className="header-login" href="#login" onClick={() => setMenu(false)}><KeyRound size={17} aria-hidden="true" />{{ fr: "Connexion", en: "Sign in", zh: "登录" }[lang]}</a>}
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
        <main>
          <Suspense fallback={<LoadingWorkspace lang={lang} />}>
          {authRoute ? <AuthPage lang={lang} /> : admin ? <AdminPage lang={lang} /> : demo ? <ProjectProvider mode="demo"><Dashboard lang={lang} /></ProjectProvider> : publishing ? <PublishProperty lang={lang} /> : catalogue ? <ListingsPage lang={lang} hash={hash} /> : selling ? <EnquiryForm key="seller" kind="seller" lang={lang} /> : projects ? (
            auth.loading ? <LoadingWorkspace lang={lang} /> : !auth.user ? <AuthPage lang={lang} /> : !projectId ? <Projects lang={lang}/> : <PrivateWorkspace lang={lang}>{editingProject?<SellerFlow key={projectId} lang={lang}/>:<Dashboard key={projectId} lang={lang} />}</PrivateWorkspace>
          ) : browsing ? buyerSubmitted ? <ListingsPage lang={lang} hash={hash} /> : <EnquiryForm key="buyer" kind="buyer" lang={lang} onContinue={() => setBuyerSubmitted(true)} /> : <Home lang={lang} />}
          </Suspense>
        </main>
      <footer hidden={projects || admin || demo}>
        <Brand footer />
        <p>{d.footer}</p>
        <p>{d.legal}</p>
      </footer>
      </ProjectProvider>
      </div>
    </>
  );
}

function HeaderAccount({lang,onLeavingChange}:{lang:Language;onLeavingChange:(value:boolean)=>void}) {
  const auth=useAuth(); const p=useProject(); const [leaving,setLeaving]=useState(false); const [error,setError]=useState("");
  const copy={fr:{account:"Mon espace",logout:"Déconnexion",busy:"Enregistrement…",failed:"Enregistrement impossible. Ouvrez votre espace et réessayez."},en:{account:"My account",logout:"Sign out",busy:"Saving…",failed:"Could not save. Open your workspace and retry."},zh:{account:"我的账号",logout:"退出登录",busy:"正在保存…",failed:"保存失败，请进入工作台重试。"}}[lang];
  async function leave(){if(leaving||p.busy)return;setLeaving(true);onLeavingChange(true);setError("");try{if(!p.isDemo&&p.project&&(p.saveState==="dirty"||p.saveState==="saving"||p.error)&&!await p.saveNow()){setError(copy.failed);return;}await auth.signOut();location.hash="login";}catch{setError(copy.failed);}finally{setLeaving(false);onLeavingChange(false);}}
  return <div className="header-account"><a className="header-account-info" href="#dashboard" title={auth.user?.email||undefined}><KeyRound size={17} aria-hidden="true"/><span>{auth.user?.email||copy.account}</span></a><button className="header-logout" type="button" disabled={leaving||p.busy} onClick={()=>void leave()}>{leaving?copy.busy:copy.logout}</button>{error&&<span className="header-account-error" role="alert">{error}</span>}</div>;
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
  if (!auth.user) return <div className="account-session"><a href="#login">{t("Connexion", "Sign in", "登录")}</a><a href="#demo">{t("Explorer un exemple", "Explore a sample", "查看示例工作台")}</a>{authIssue}</div>;
  return authIssue ? <div className="account-session">{authIssue}</div> : null;
}

function Home({ lang }: { lang: Language }) {
  const d = homeCopy[lang];
  const [value, setValue] = useState("650000");
  const [tab, setTab] = useState<"seller" | "buyer">("seller");
  const [searchQuery, setSearchQuery] = useState("");

  const formatted = new Intl.NumberFormat(
    lang === "zh" ? "zh-CN" : `${lang}-CA`,
    { style: "currency", currency: "CAD", maximumFractionDigits: 0 },
  ).format(Number(value) || 0);
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
            <a className="primary-link" href="#acheter">
              {d.buy}
              <ArrowRight />
            </a>
            <a className="secondary-link" href="#vendre">
              {d.sell}
            </a>
          </div>
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              location.hash = `acheter${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ""}`;
            }}
          >
            <MapPin aria-hidden="true" />
            <input
              placeholder={d.searchPlaceholder}
              aria-label={d.searchPlaceholder}
              value={searchQuery}
              maxLength={120}
              onChange={event => setSearchQuery(event.target.value)}
            />
            <button type="submit">
              <Search aria-hidden="true" />
              {d.searchButton}
            </button>
          </form>
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
      <FeaturedProperties lang={lang} />
      <section id="parcours" className="section route-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{d.routeEyebrow}</p>
            <h2>{d.routeTitle}</h2>
          </div>
          <p className="section-note">Propriété En Vente</p>
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
              <a href={kind === "seller" ? "#vendre" : "#acheter"}>
                {d[`${kind}Cta`]}
                <ArrowRight />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section id="approche" className="difference-section">
        <div className="difference-intro">
          <p className="eyebrow light">{d.differenceEyebrow}</p>
          <h2>{d.differenceTitle}</h2>
          <p>{d.differenceText}</p>
        </div>
        <div className="feature-list">
          {[Calculator, ShieldCheck, Earth].map((Icon, i) => (
            <article key={i}>
              <span>
                <Icon />
              </span>
              <div>
                <h3>{d.featureTitles[i]}</h3>
                <p>{d.featureTexts[i]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section calculator-section">
        <div className="calculator-copy">
          <p className="eyebrow">{d.calcEyebrow}</p>
          <h2>{d.calcTitle}</h2>
          <p>{d.calcText}</p>
        </div>
        <div className="calculator-card">
          <div
            className="calculator-tabs"
            role="tablist"
            aria-label={d.calcTitle}
          >
            {(["seller", "buyer"] as const).map((kind, i) => (
              <button
                key={kind}
                id={`tab-${kind}`}
                type="button"
                role="tab"
                aria-selected={tab === kind}
                aria-controls="calculator-panel"
                tabIndex={tab === kind ? 0 : -1}
                onClick={() => setTab(kind)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? "seller"
                        : e.key === "End"
                          ? "buyer"
                          : kind === "seller"
                            ? "buyer"
                            : "seller";
                    setTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
              >
                {i === 0 ? d.calcSeller : d.calcBuyer}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="calculator-panel"
            aria-labelledby={`tab-${tab}`}
          >
            <label htmlFor="property-value">
              {tab === "seller" ? d.propertyValue : d.buyerBudget}
            </label>
            <div className="money-input">
              <span>$</span>
              <input
                id="property-value"
                inputMode="numeric"
                value={value}
                onChange={(e) =>
                  setValue(e.target.value.replace(/\D/g, "").slice(0, 12))
                }
              />
            </div>
            <div className="result-box">
              <span>{tab === "seller" ? d.estimated : d.buyerBudget}</span>
              <strong aria-live="polite">{formatted}</strong>
            </div>
            <div className="strategy-row">
              <Handshake />
              <div>
                <span>{tab === "seller" ? d.strategy : d.buyerPlan}</span>
                <strong>
                  {tab === "seller" ? d.strategyText : d.buyerPlanText}
                </strong>
              </div>
            </div>
            <a
              href={tab === "seller" ? "#vendre" : "#acheter"}
              className="wide-cta"
            >
              {d.calcCta}
              <ArrowRight />
            </a>
          </div>
        </div>
      </section>
      <section id="processus" className="section process-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{d.processEyebrow}</p>
            <h2>{d.processTitle}</h2>
          </div>
        </div>
        <div className="steps-grid">
          {d.steps.map(([n, title, text]) => (
            <article key={n}>
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="contact" className="contact-section">
        <div className="contact-copy">
          <div className="contact-mark">
            <House />
          </div>
          <h2>{d.ctaTitle}</h2>
          <p>{d.ctaText}</p>
          <div className="mini-proof">
            <BadgeCheck />
            Français <span />
            English <span />
            中文
          </div>
        </div>
        <div className="contact-form"><a className="wide-cta" href="#acheter">{{en:"I want to buy",fr:"Je veux acheter",zh:"我要买房"}[lang]}</a><a className="wide-cta" href="#vendre">{{en:"I want to sell",fr:"Je veux vendre",zh:"我要卖房"}[lang]}</a></div>
      </section>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
