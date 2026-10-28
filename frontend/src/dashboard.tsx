import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Globe2,
  Handshake,
  Heart,
  House,
  ImagePlus,
  Info,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from "lucide-react";
import { isVisitSlotTaken, useProject } from "./project";
import { sellerCopy, type Language } from "./seller-copy";
import { ProjectStatus } from "./project-status";

type Section =
  | "overview"
  | "property"
  | "buyers"
  | "visits"
  | "offers"
  | "documents"
  | "services";
const sections = [
  "overview",
  "property",
  "buyers",
  "visits",
  "offers",
  "documents",
  "services",
] as const;
const icons = [
  LayoutDashboard,
  House,
  Users,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  Sparkles,
];
const navCopy = {
  fr: [
    "Vue d’ensemble",
    "Ma propriété",
    "Acheteurs",
    "Visites",
    "Offres",
    "Documents",
    "Mes services",
  ],
  en: [
    "Overview",
    "My property",
    "Buyers",
    "Viewings",
    "Offers",
    "Documents",
    "My services",
  ],
  zh: [
    "项目总览",
    "我的房源",
    "买家管理",
    "看房日历",
    "报价管理",
    "文件中心",
    "可选服务",
  ],
};
const navGroups = {
  fr: { property: "Propriété", activity: "Acheteurs et visites", files: "Documents" },
  en: { property: "Property", activity: "Buyers and visits", files: "Documents" },
  zh: { property: "房源管理", activity: "买家与交易", files: "资料" },
};
const serviceText = {
  fr: [
    [
      "Photos professionnelles",
      "Une présentation lumineuse, fidèle à votre propriété.",
    ],
    [
      "Vidéo de la propriété",
      "Une visite pour découvrir les lieux avant de se déplacer.",
    ],
    [
      "Analyse de marché",
      "Un éclairage professionnel sur les propriétés comparables.",
    ],
    [
      "Consultation individuelle",
      "Préparez vos questions avec un professionnel.",
    ],
    [
      "Fiche de propriété",
      "Vos informations, vos photos et une présentation en trois langues.",
    ],
  ],
  en: [
    [
      "Professional photography",
      "A bright, accurate presentation of your property.",
    ],
    ["Property video", "A walkthrough to discover the space before visiting."],
    ["Market analysis", "Professional insight into comparable properties."],
    [
      "One-to-one consultation",
      "Work through your questions with a professional.",
    ],
    [
      "Property presentation",
      "Your information and photos, presented in three languages.",
    ],
  ],
  zh: [
    ["专业房屋摄影", "展示真实空间、采光与房屋细节。"],
    ["房屋展示视频", "让买家在预约之前更了解房屋。"],
    ["市场分析", "由专业人士协助了解同类房产。"],
    ["一对一咨询", "把当前的问题交给专业人士一起梳理。"],
    ["三语房源制作", "整理资料和照片，制作法、英、中三语展示页面。"],
  ],
};
const serviceIcons = [Camera, Video, Search, Handshake, FileText];
const serviceIds = ["photo", "video", "analysis", "consult", "listing"];

export function Dashboard({ lang }: { lang: Language }) {
  const t = (fr: string, en: string, zh: string) => ({ fr, en, zh })[lang];
  const {
    plan,
    form,
    photos,
    services,
    setServices,
    completed,
    sample,
    buyers,
    setBuyers,
    visits,
    setVisits,
    docs,
    addFiles,
    deleteFile,
    downloadDocument,
    isDemo,
    busy,
    project,
    saveNow,
  } = useProject();
  const sectionFromHash = (): Section => {
    const value = location.hash.split("/")[location.hash.startsWith('#projects/')?2:1];
    return sections.includes(value as Section)
      ? (value as Section)
      : "overview";
  };
  const [section, setSection] = useState<Section>(sectionFromHash);
  const [period, setPeriod] = useState("14");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [editingVisitTime, setEditingVisitTime] = useState(false);
  const editVisitTimeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (showVisitForm && visitDate && visitTime && !editingVisitTime) editVisitTimeButton.current?.focus();
  }, [showVisitForm, visitDate, visitTime, editingVisitTime]);
  const [visitMonth, setVisitMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  useEffect(() => {
    const change = () => {
      setSection(sectionFromHash());
      setMessage("");
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  const go = (next: Section) => {
    const base = isDemo ? "demo" : `projects/${project?.id}`;
    location.hash = next === "overview" ? base : `${base}/${next}`;
  };
  const editLink = isDemo ? "#register" : `#projects/${project?.id}/edit`;
  const reviewLabel = {
    draft: t("Brouillon privé", "Private draft", "私有草稿"),
    submitted: t("À vérifier", "Awaiting review", "待审核"),
    approved: t("Dossier vérifié", "Review approved", "审核通过"),
    changes_requested: t("À modifier", "Changes requested", "待修改"),
  }[project?.status ?? "draft"];
  const names = navCopy[lang];
  const groups = navGroups[lang];
  const address = sample
    ? t("Votre maison au Québec", "Your home in Québec", "您的魁北克房屋")
    : form.address ||
      t("Votre projet immobilier", "Your property project", "您的卖房项目");
  const city = sample
    ? "Québec"
    : [form.city, form.postal.toUpperCase()].filter(Boolean).join(" · ") ||
      "Québec";
  const currency = (v: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-CN" : `${lang}-CA`, {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(v);
  const currentPrice = sample
    ? currency(650000)
    : form.price
      ? currency(Number(form.price))
      : t("Prix à définir", "Price to be set", "售价待定");
  const statuses = {
    fr: ["À contacter", "Visite prévue", "Suivi en cours"],
    en: ["To contact", "Viewing planned", "Following up"],
    zh: ["待联系", "已安排看房", "跟进中"],
  }[lang];
  const toggleService = (id: string) =>
    setServices((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  const serviceTitle = (id: string) =>
    serviceText[lang][serviceIds.indexOf(id)]?.[0] ?? id;
  const completion = sample
    ? 75
    : Math.round(
        ([
          !!form.address,
          photos.length > 0,
          !!form.name,
          services.length > 0,
        ].filter(Boolean).length /
          4) *
          100,
      );
  const displayedPhotos = sample ? [] : photos;
  const hero =
    displayedPhotos[0]?.url ??
    `${import.meta.env.BASE_URL}propriete-en-vente-hero.png`;
  const sampleVisits = [
    { date: "2026-10-03", time: "10:30", name: "Camille R." },
    { date: "2026-10-04", time: "14:00", name: "Alex M." },
  ];
  const visibleVisits = sample ? sampleVisits : visits;
  const localNote = isDemo ? t(
    "Démo interactive · Données réinitialisées au rechargement. Aucun envoi ni paiement.",
    "Interactive demo · Data resets on refresh. No submissions or payments.",
    "交互演示 · 刷新页面后数据清空，不会发送资料或产生付款。",
  ) : t("Votre espace privé · Informations et fichiers enregistrés dans votre compte.", "Your private workspace · Information and files saved to your account.", "您的私有工作台 · 资料和文件保存到您的账号。");
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : `${lang}-CA`, {
      day: "numeric",
      month: "short",
    }).format(new Date(date + "T12:00:00"));
  const locale = lang === "zh" ? "zh-CN" : `${lang}-CA`;
  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const visitYear = visitMonth.getFullYear();
  const visitMonthIndex = visitMonth.getMonth();
  const visitFirstWeekday = (new Date(visitYear, visitMonthIndex, 1).getDay() + 6) % 7;
  const visitDaysInMonth = new Date(visitYear, visitMonthIndex + 1, 0).getDate();
  const visitCalendarCells = Array.from(
    { length: visitFirstWeekday + visitDaysInMonth },
    (_, index) => index < visitFirstWeekday ? null : index - visitFirstWeekday + 1,
  );
  const visitMonthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(visitMonth);
  const visitCanGoBack =
    visitYear > todayDate.getFullYear() ||
    (visitYear === todayDate.getFullYear() && visitMonthIndex > todayDate.getMonth());
  const visitIsoDate = (day: number) =>
    `${visitYear}-${String(visitMonthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const visitWeekdays = {
    fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    zh: ["一", "二", "三", "四", "五", "六", "日"],
  }[lang];
  const visitSlots = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"];
  const occupiedVisitSlots = new Set(visitSlots.filter((slot) => isVisitSlotTaken(visibleVisits, visitDate, slot)));
  const formatVisitTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
      new Date(2000, 0, 1, hour, minute),
    );
  };

  return (
    <div className="dashboard-app">
      <aside className="dashboard-sidebar">
        <div className="workspace-label">
          <span className="workspace-monogram">M</span>
          <div>
            <strong>Propriété En Vente</strong>
            <small>
              {t("ESPACE VENDEUR", "SELLER WORKSPACE", "卖家工作台")}
            </small>
          </div>
        </div>
        <nav aria-label={t("Espace vendeur", "Seller workspace", "卖家工作台")}>
          <a href={`#${isDemo ? "demo" : `projects/${project?.id}`}`} className={section === "overview" ? "active" : ""} aria-current={section === "overview" ? "page" : undefined}><LayoutDashboard />{names[0]}</a>
          <details className="workspace-nav-group" open={section === "property" || section === "services"}>
            <summary><House />{groups.property}<ChevronDown className="workspace-nav-chevron" /></summary>
            <div>{(["property", "services"] as const).map((key) => {
              const i = sections.indexOf(key);
              const Icon = icons[i];
              return <a key={key} href={`#${isDemo ? "demo" : `projects/${project?.id}`}/${key}`} className={section === key ? "active" : ""} aria-current={section === key ? "page" : undefined}><Icon />{names[i]}{key === "services" && services.length > 0 && <span className="nav-count">{services.length}</span>}</a>;
            })}</div>
          </details>
          <details className="workspace-nav-group" open={section === "buyers" || section === "visits" || section === "offers"}>
            <summary><Users />{groups.activity}<ChevronDown className="workspace-nav-chevron" /></summary>
            <div>{(["buyers", "visits", "offers"] as const).map((key) => {
              const i = sections.indexOf(key);
              const Icon = icons[i];
              return <a key={key} href={`#${isDemo ? "demo" : `projects/${project?.id}`}/${key}`} className={section === key ? "active" : ""} aria-current={section === key ? "page" : undefined}><Icon />{names[i]}</a>;
            })}</div>
          </details>
          <a href={`#${isDemo ? "demo" : `projects/${project?.id}`}/documents`} className={section === "documents" ? "active" : ""} aria-current={section === "documents" ? "page" : undefined}><FolderOpen />{names[5]}</a>
        </nav>
        {!isDemo&&<a className="workspace-back" href="#projects" onClick={async e=>{e.preventDefault();if(await saveNow())location.hash='projects';}}><ChevronLeft/>{t('Tous les projets','All projects','全部项目')}</a>}
        <div className="sidebar-help">
          <Handshake />
          <strong>
            {t(
              "Vous avancez à votre rythme.",
              "Move at your own pace.",
              "按您的节奏，一步步来。",
            )}
          </strong>
          <p>
            {t(
              "Un peu d’aide, quand vous en avez besoin.",
              "A little help, whenever you need it.",
              "需要的时候，再增加专业帮助。",
            )}
          </p>
          <button onClick={() => go("services")}>
            {t("Voir les services", "Explore services", "查看可选服务")}
            <ArrowRight />
          </button>
        </div>
        <a className="sidebar-home" href="#top">
          ← {t("Retour au site", "Back to the website", "返回网站首页")}
        </a>
      </aside>
      <div className="dashboard-main">
        <div className="workspace-topline">
          <span>
            {t("Mon projet", "My project", "我的卖房项目")}
            <ChevronRight />
            {names[sections.indexOf(section)]}
          </span>
          <span className="mode-pill">
            <ShieldCheck />
            {plan === "with"
              ? t("Avec courtier", "With a broker", "经纪协助意向")
              : t("Autonome", "Self-directed", "自主出售")}
          </span>
        </div>
        <div className="workspace-heading">
          <div>
            <h1>
              {section === "overview"
                ? address
                : names[sections.indexOf(section)]}
            </h1>
            <p>
              {t(
                "Informations, documents et rendez-vous de cette propriété.",
                "Information, documents and viewings for this property.",
                "管理这套房产的资料、文件与看房安排。",
              )}
            </p>
          </div>
          <a className="workspace-primary" href={editLink}>
            <Plus />
            {completed
              ? t("Modifier mon dossier", "Edit my project", "编辑房屋资料")
              : t("Créer mon dossier", "Create my project", "建立我的项目")}
          </a>
        </div>
        {section === "overview" && <div className="workspace-demo">
          <Info />
          <span>{localNote}</span>
          <a className="text-button" href={isDemo ? "#dashboard" : "#demo"} target={isDemo ? undefined : "_blank"} rel="noopener">
            {isDemo
              ? t("Ouvrir mon espace", "Open my workspace", "进入我的工作台")
              : t("Voir un exemple", "See an example", "查看示例项目")}
          </a>
        </div>}
        {section === "overview" && <ProjectStatus lang={lang} review />}
        {section === "overview" && project?.status === "approved" && !isDemo && (
          <section className="approved-next-step" aria-labelledby="approved-next-title">
            <div><span>{t("Étape suivante", "Next step", "下一阶段")}</span><h2 id="approved-next-title">{t("Préparer une annonce publique", "Prepare a public listing", "准备公开房源")}</h2><p>{t("Votre dossier privé est vérifié. Choisissez les informations et photos à rendre publiques, puis envoyez l’annonce à l’examen séparément.", "Your private project has been reviewed. Choose which details and photos to make public, then submit the listing for its own review.", "您的私有项目已审核通过。您可以选择要公开的资料和照片，另行提交公开房源审核。")}</p></div>
            <a href="#publier">{t("开始准备房源", "Prepare listing", "开始准备房源")}<ArrowRight /></a>
          </section>
        )}
        {sample && (
          <p className="sample-label">
            {t(
              "PROJET EXEMPLE · Toutes les statistiques et tous les contacts ci-dessous sont fictifs.",
              "SAMPLE PROJECT · All statistics and contacts below are fictional.",
              "示例项目 · 以下统计、买家和报价均为虚构演示数据。",
            )}
          </p>
        )}
        {message && (
          <p role="status" className="dashboard-feedback">
            {message}
          </p>
        )}

        {section === "overview" && (
          <>
            <div className="metrics-heading">
              <h2>
                {t(
                  "Votre propriété en un coup d’œil",
                  "Your property at a glance",
                  "房源表现一览",
                )}
              </h2>
              <select
                aria-label={t("Période", "Period", "统计周期")}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="14">
                  {t("14 derniers jours", "Last 14 days", "最近 14 天")}
                </option>
                <option value="30">
                  {t("30 derniers jours", "Last 30 days", "最近 30 天")}
                </option>
              </select>
            </div>
            <div className="metrics-grid">
              {[Eye, Heart, MessageSquare, CalendarDays].map((Icon, i) => (
                <article key={i} className="metric-card">
                  <div>
                    <span>
                      {
                        [
                          t("Vues", "Views", "浏览"),
                          t("Favoris", "Saves", "收藏"),
                          t("Demandes", "Enquiries", "咨询"),
                          t("Visites", "Viewings", "看房"),
                        ][i]
                      }
                    </span>
                    <Icon />
                  </div>
                  <strong>
                    {sample
                      ? (period === "14"
                          ? ["1 240", "32", "8", "2"]
                          : ["2 180", "56", "15", "5"])[i]
                      : "—"}
                  </strong>
                  <small>
                    {sample
                      ? t(
                          "Données de démonstration",
                          "Demonstration data",
                          "演示数据",
                        )
                      : t(
                          "Après la mise en ligne",
                          "Available after publishing",
                          "发布并接入数据后显示",
                        )}
                  </small>
                </article>
              ))}
            </div>
            <div className="overview-columns">
              <div>
                <section className="dashboard-card property-overview">
                  <div className="property-image">
                    <img src={hero} alt={address} />
                    <span>{reviewLabel}</span>
                    {!displayedPhotos.length && (
                      <small>
                        {t(
                          "Image illustrative",
                          "Illustrative image",
                          "示意图片",
                        )}
                      </small>
                    )}
                  </div>
                  <div className="property-overview-copy">
                    <span className="tiny-label">
                      {t("MA PROPRIÉTÉ", "MY PROPERTY", "我的房源")}
                    </span>
                    <h2>{address}</h2>
                    <p>{city}</p>
                    <strong className="property-price">{currentPrice}</strong>
                    <div className="progress-label">
                      <span>
                        {t(
                          "Préparation du dossier",
                          "Project readiness",
                          "资料准备进度",
                        )}
                      </span>
                      <strong>{completion}%</strong>
                    </div>
                    <progress
                      max={100}
                      value={completion}
                      aria-label={t(
                        "Préparation du dossier",
                        "Project readiness",
                        "资料准备进度",
                      )}
                    />
                    <button
                      className="text-button"
                      onClick={() => go("property")}
                    >
                      {t(
                        "Voir ma propriété",
                        "View my property",
                        "查看房源资料",
                      )}
                      <ArrowUpRight />
                    </button>
                  </div>
                </section>
                <section className="dashboard-card next-actions">
                  <div className="card-title">
                    <h2>
                      {t(
                        "Votre prochaine étape",
                        "Your next step",
                        "建议下一步",
                      )}
                    </h2>
                    <Sparkles />
                  </div>
                  <p>
                    {sample
                      ? t(
                          "Votre annonce attire des regards. Explorez plusieurs pistes avant de modifier votre stratégie.",
                          "Your listing is attracting views. Explore a few options before changing your strategy.",
                          "房源已经获得关注。先了解不同原因，再决定是否调整策略。",
                        )
                      : t(
                          "Complétez les informations essentielles pour préparer votre mise en marché.",
                          "Complete the essentials to prepare your listing.",
                          "先补全关键资料，为正式发布做好准备。",
                        )}
                  </p>
                  <div className="action-row">
                    <span className="action-number">01</span>
                    <div>
                      <strong>
                        {t(
                          "Vérifier la présentation",
                          "Review your presentation",
                          "检查房源展示",
                        )}
                      </strong>
                      <small>
                        {t(
                          "Photos, description et informations utiles",
                          "Photos, description and useful details",
                          "检查照片、描述和必要资料",
                        )}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={t(
                        "Voir ma propriété",
                        "View my property",
                        "查看房源资料",
                      )}
                      onClick={() => go("property")}
                    >
                      <ArrowRight />
                    </button>
                  </div>
                  <div className="action-row">
                    <span className="action-number">02</span>
                    <div>
                      <strong>
                        {t(
                          "Choisir l’aide qui vous convient",
                          "Choose the help you need",
                          "选择当前需要的帮助",
                        )}
                      </strong>
                      <small>
                        {t(
                          "Photographie, analyse ou consultation",
                          "Photography, analysis or consultation",
                          "摄影、市场分析或专业咨询",
                        )}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={t(
                        "Voir les services",
                        "Explore services",
                        "查看可选服务",
                      )}
                      onClick={() => go("services")}
                    >
                      <ArrowRight />
                    </button>
                  </div>
                </section>
              </div>
              <div>

                <section className="dashboard-card">
                  <div className="card-title">
                    <h2>{t("À venir", "Coming up", "近期安排")}</h2>
                    <CalendarDays />
                  </div>
                  {visibleVisits.length ? (
                    visibleVisits.slice(0, 2).map((v, i) => (
                      <div className="upcoming-visit" key={i}>
                        <span>{formatDate(v.date)}</span>
                        <div>
                          <strong>
                            {v.time} · {v.name}
                          </strong>
                          <small>
                            {sample
                              ? t(
                                  "Visite exemple",
                                  "Sample viewing",
                                  "示例看房",
                                )
                              : t(
                                  "Note personnelle",
                                  "Personal note",
                                  "个人安排记录",
                                )}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-copy">
                      {t(
                        "Aucune visite prévue pour le moment.",
                        "No viewings planned yet.",
                        "暂时没有看房安排。",
                      )}
                    </p>
                  )}
                  <button className="text-button" onClick={() => go("visits")}>
                    {t("Ouvrir le calendrier", "Open calendar", "打开看房日历")}
                    <ArrowRight />
                  </button>
                </section>
              </div>
            </div>
          </>
        )}

        {section === "property" && (
          <div className="property-detail-layout">
            <section className="dashboard-card">
              <div className="large-property-photo">
                <img src={hero} alt={address} />
                {!displayedPhotos.length && (
                  <span>
                    {t("Image illustrative", "Illustrative image", "示意图片")}
                  </span>
                )}
              </div>
              <h2>{address}</h2>
              <p>{city}</p>
              <strong className="property-price">{currentPrice}</strong>
              <dl className="property-facts">
                <div>
                  <dt>{sellerCopy[lang].type}</dt>
                  <dd>
                    {sellerCopy[lang].types[sample ? 0 : Number(form.type)]}
                  </dd>
                </div>
                <div>
                  <dt>{sellerCopy[lang].timeline}</dt>
                  <dd>
                    {
                      sellerCopy[lang].timelines[
                        sample ? 1 : Number(form.timeline)
                      ]
                    }
                  </dd>
                </div>
                <div>
                  <dt>{t("Photos ajoutées", "Photos added", "已添加照片")}</dt>
                  <dd>{displayedPhotos.length}</dd>
                </div>
              </dl>
              {displayedPhotos.length > 0 && (
                <div className="dashboard-photos">
                  {displayedPhotos.map((p) => (
                    <img key={p.id} src={p.url} alt={p.name} />
                  ))}
                </div>
              )}
              <a className="workspace-primary" href={editLink}>
                {t(
                  "Modifier les informations",
                  "Edit information",
                  "编辑房屋资料",
                )}
                <ArrowRight />
              </a>
            </section>
            <section className="dashboard-card">
              <h2>
                {t("Avant la publication", "Before publishing", "发布前的准备")}
              </h2>
              <ul className="readiness-list">
                {[
                  [
                    !!form.address,
                    t(
                      "Adresse et caractéristiques",
                      "Address and property details",
                      "地址和房屋资料",
                    ),
                  ],
                  [
                    photos.length > 0,
                    t("Photos de la propriété", "Property photos", "房屋照片"),
                  ],
                  [
                    !!form.name,
                    t(
                      "Coordonnées du vendeur",
                      "Seller contact information",
                      "卖家联系方式",
                    ),
                  ],
                  [
                    services.length > 0,
                    t("Services souhaités", "Preferred services", "所需服务"),
                  ],
                ].map(([done, label], i) => (
                  <li key={i}>
                    {done ? (
                      <CheckCircle2 />
                    ) : (
                      <span className="unchecked-circle" />
                    )}
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
              <p className="empty-copy">
                {t(
                  "Votre dossier reste privé. La vérification ne publie aucune annonce.",
                  "Your project stays private. Review does not publish a listing.",
                  "您的项目保持私有，资料审核不会自动发布房源。",
                )}
              </p>
            </section>
          </div>
        )}

        {section === "buyers" && (
          <section className="dashboard-card">
            <div className="table-toolbar">
              <div className="search-control">
                <Search />
                <input
                  aria-label={t(
                    "Rechercher un acheteur",
                    "Search buyers",
                    "搜索买家",
                  )}
                  placeholder={t(
                    "Rechercher un acheteur…",
                    "Search buyers…",
                    "搜索买家…",
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                aria-label={t("Statut", "Status", "跟进状态")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">
                  {t("Tous les statuts", "All statuses", "全部状态")}
                </option>
                {statuses.map((s, i) => (
                  <option value={i} key={i}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Acheteur", "Buyer", "买家")}</th>
                    <th>{t("Origine", "Source", "来源")}</th>
                    <th>{t("Suivi", "Follow-up", "跟进")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(sample ? buyers : [])
                    .filter(
                      (b) =>
                        b.name.toLowerCase().includes(query.toLowerCase()) &&
                        (filter === "all" || String(b.status) === filter),
                    )
                    .map((b) => (
                      <tr key={b.name}>
                        <td>
                          <span className="buyer-avatar">{b.initials}</span>
                          <strong>{b.name}</strong>
                        </td>
                        <td>{b.source}</td>
                        <td>
                          <select
                            aria-label={`${t("Statut de", "Status of", "跟进状态：")} ${b.name}`}
                            value={b.status}
                            onChange={(e) =>
                              setBuyers((old) =>
                                old.map((x) =>
                                  x.name === b.name
                                    ? { ...x, status: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          >
                            {statuses.map((s, i) => (
                              <option value={i} key={i}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {(!sample ||
              !buyers.some(
                (b) =>
                  b.name.toLowerCase().includes(query.toLowerCase()) &&
                  (filter === "all" || String(b.status) === filter),
              )) && (
              <Empty
                icon={Users}
                text={t(
                  "Aucun acheteur à afficher.",
                  "No buyers to show.",
                  "暂无符合条件的买家。",
                )}
              />
            )}
          </section>
        )}

        {section === "visits" && (
          <section className="dashboard-card">
            <div className="card-title">
              <div>
                <h2>
                  {t(
                    "Mes prochains rendez-vous",
                    "Upcoming appointments",
                    "接下来的看房安排",
                  )}
                </h2>
                <p>
                  {t(
                    "Un calendrier personnel pour préparer vos visites.",
                    "A personal calendar to plan your viewings.",
                    "记录个人安排，方便准备每一次看房。",
                  )}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() => {
                  const opening = !showVisitForm;
                  setShowVisitForm(opening);
                  if (opening) {
                    setVisitDate("");
                    setVisitTime("");
                    setEditingVisitTime(false);
                    const now = new Date();
                    setVisitMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }
                }}
              >
                <Plus />
                {t("Ajouter", "Add", "添加安排")}
              </button>
            </div>
            {showVisitForm && (
              <form
                className="visit-form"
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  if (!visitDate || !visitTime) return;
                  if (isVisitSlotTaken(visibleVisits, visitDate, visitTime)) {
                    setMessage(t("Ce créneau figure déjà dans votre calendrier. Choisissez-en un autre.", "That time is already on this calendar. Choose another slot.", "这个时间已在日历中安排，请选择其他时段。"));
                    return;
                  }
                  setVisits((old) => [
                    ...old,
                    {
                      name: String(data.get("visitor")),
                      date: visitDate,
                      time: visitTime,
                    },
                  ]);
                  setShowVisitForm(false);
                  setMessage(
                    t(
                      "Note ajoutée. Consultez l’état d’enregistrement ci-dessus. Aucune invitation envoyée.",
                      "Note added. Check saving status above. No invitation sent.",
                      "已添加安排，保存状态见上方。没有发送任何邀请。",
                    ),
                  );
                }}
              >
                <label>
                  {t("Nom / note", "Name / note", "姓名／备注")}
                  <input name="visitor" required maxLength={100} />
                </label>
                {visitDate && visitTime && <div className="visit-time-summary">
                  <div id="visit-time-summary" role="status">
                    <strong>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${visitDate}T12:00:00`))} · {formatVisitTime(visitTime)}</strong>
                    <small>{t("Heure de l’Est · America/Toronto", "Eastern Time · America/Toronto", "北美东部时间 · America/Toronto")}</small>
                  </div>
                  <button type="button" ref={editVisitTimeButton} aria-expanded={editingVisitTime} aria-controls={editingVisitTime ? "visit-date-time-picker" : undefined} aria-describedby="visit-time-summary" onClick={() => setEditingVisitTime(!editingVisitTime)}>
                    {t("Modifier la date et l’heure", "Change date and time", "修改日期和时间")}
                  </button>
                </div>}
                {(!visitDate || !visitTime || editingVisitTime) && <section id="visit-date-time-picker" className="appointment-picker" aria-labelledby="visit-picker-title">
                  <div className="appointment-calendar">
                    <div className="calendar-heading">
                      <div>
                        <span className="calendar-kicker">{t("Date et heure", "Date and time", "日期和时间")}</span>
                        <h3 id="visit-picker-title">{t("Choisir un rendez-vous", "Select an appointment", "选择预约时间")}</h3>
                      </div>
                      {visitDate && (
                        <button className="text-button" type="button" onClick={() => { setVisitDate(""); setVisitTime(""); }}>
                          {t("Effacer", "Clear", "清除")}
                        </button>
                      )}
                    </div>
                    <div className="calendar-month-nav">
                      <button
                        type="button"
                        className="calendar-arrow"
                        aria-label={t("Mois précédent", "Previous month", "上个月")}
                        disabled={!visitCanGoBack}
                        onClick={() => setVisitMonth(new Date(visitYear, visitMonthIndex - 1, 1))}
                      >
                        <ChevronLeft />
                      </button>
                      <strong aria-live="polite">{visitMonthLabel}</strong>
                      <button
                        type="button"
                        className="calendar-arrow"
                        aria-label={t("Mois suivant", "Next month", "下个月")}
                        onClick={() => setVisitMonth(new Date(visitYear, visitMonthIndex + 1, 1))}
                      >
                        <ChevronRight />
                      </button>
                    </div>
                    <div className="calendar-weekdays" aria-hidden="true">
                      {visitWeekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
                    </div>
                    <div className="calendar-days" role="grid" aria-label={visitMonthLabel}>
                      {visitCalendarCells.map((day, index) => {
                        if (day === null) return <span className="calendar-empty" key={`empty-${index}`} />;
                        const value = visitIsoDate(day);
                        const selected = value === visitDate;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="gridcell"
                            className="calendar-day"
                            aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(`${value}T12:00:00`))}
                            aria-selected={selected}
                            disabled={value < today}
                            onClick={() => { setVisitDate(value); setVisitTime(""); }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="calendar-timezone"><Globe2 />{t("Heure de l’Est · America/Toronto", "Eastern Time · America/Toronto", "北美东部时间 · America/Toronto")}</p>
                  </div>
                  <div className="appointment-times" aria-label={t("Heure souhaitée", "Preferred time", "期望时间") }>
                    <span>{visitDate ? formatDate(visitDate) : t("Choisissez d’abord une date", "Choose a date first", "请先选择日期")}</span>
                    {occupiedVisitSlots.size > 0 && <small className="booked-slot-hint">{t("Les heures grisées sont déjà réservées.", "Disabled times are already scheduled.", "灰色时段已被安排。")}</small>}
                    {visitSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={visitTime === slot}
                        disabled={!visitDate || occupiedVisitSlots.has(slot)}
                        title={occupiedVisitSlots.has(slot) ? t("Déjà réservé", "Already scheduled", "已安排") : undefined}
                        onClick={() => { setVisitTime(slot); setEditingVisitTime(false); }}
                      >
                        {formatVisitTime(slot)}
                      </button>
                    ))}
                  </div>
                </section>}
                <button disabled={!visitDate || !visitTime}>{t("Ajouter la note", "Add note", "添加记录")}</button>
              </form>
            )}
            {visibleVisits.length ? (
              <div className="visit-list">
                {visibleVisits.map((v, i) => (
                  <article key={i}>
                    <div className="calendar-date">
                      <CalendarDays />
                      {formatDate(v.date)}
                    </div>
                    <div>
                      <h3>{v.name}</h3>
                      <p>
                        {v.time} ·{" "}
                        {sample && i < 2
                          ? t("Exemple", "Example", "示例")
                          : t("Note personnelle", "Personal note", "个人记录")}
                      </p>
                    </div>
                    <span className="soft-badge">
                      {t("Non confirmé", "Unconfirmed", "未确认")}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                icon={CalendarDays}
                text={t(
                  "Aucune visite enregistrée.",
                  "No viewings recorded.",
                  "暂时没有看房记录。",
                )}
              />
            )}
          </section>
        )}

        {section === "offers" && (
          <section className="dashboard-card">
            <h2>
              {t(
                "Toutes vos offres, bien organisées.",
                "Keep your offers organized.",
                "把每份报价整理清楚。",
              )}
            </h2>
            <p>
              {t(
                "Comparez les informations avant d’en discuter avec un professionnel.",
                "Review the details before discussing them with a professional.",
                "先了解报价细节，再与专业人士讨论。",
              )}
            </p>
            {sample ? (
              <>
                <div className="offer-card">
                  <span className="buyer-avatar">CR</span>
                  <div>
                    <h3>
                      Camille R.{" "}
                      <small>{t("Exemple", "Example", "示例")}</small>
                    </h3>
                    <p>
                      {t(
                        "Offre conditionnelle · financement et inspection",
                        "Conditional offer · financing and inspection",
                        "附条件报价 · 融资与验房",
                      )}
                    </p>
                  </div>
                  <strong>{currency(635000)}</strong>
                  <button
                    className="outline"
                    onClick={() => setOfferOpen(!offerOpen)}
                  >
                    {offerOpen
                      ? t("Réduire", "Collapse", "收起")
                      : t("Voir les détails", "View details", "查看详情")}
                  </button>
                </div>
                {offerOpen && (
                  <div className="offer-details">
                    <p>
                      {t(
                        "Date de possession souhaitée : à discuter. Aucune pièce justificative jointe.",
                        "Preferred possession date: to be discussed. No supporting documents attached.",
                        "期望交房日期：待协商。尚未附证明文件。",
                      )}
                    </p>
                    <p>
                      {t(
                        "Exemple uniquement : aucune offre réelle n’est reçue, acceptée ou transmise ici.",
                        "Example only: no real offer is received, accepted or transmitted here.",
                        "仅为示例：此处不会接收、接受或发送真实购房报价。",
                      )}
                    </p>
                    <button onClick={() => go("services")}>
                      {t(
                        "Préparer une consultation",
                        "Plan a consultation",
                        "选择咨询服务",
                      )}
                      <ArrowRight />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Empty
                icon={ClipboardList}
                text={t(
                  "Aucune offre reçue pour le moment.",
                  "No offers received yet.",
                  "暂时没有收到报价。",
                )}
              />
            )}
          </section>
        )}

        {section === "documents" && (
          <section className="dashboard-card">
            <div className="card-title">
              <div>
                <h2>
                  {t(
                    "Votre dossier, au même endroit.",
                    "Your documents, together.",
                    "房屋文件，集中整理。",
                  )}
                </h2>
                <p>
                  {t(
                    "Documents privés · PDF et images · 10 fichiers, 10 Mo maximum chacun.",
                    "Private documents · PDF and images · 10 files, up to 10 MB each.",
                    "私有文件 · PDF 或图片 · 最多 10 个，每个最大 10 MB。",
                  )}
                </p>
              </div>
            </div>
            <label className="document-drop">
              <ImagePlus />
              <strong>
                {t("Ajouter un document", "Add a document", "添加文件")}
              </strong>
              <input
                type="file"
                disabled={isDemo || busy}
                accept="application/pdf,image/jpeg,image/png,image/webp"
                aria-label={t(
                  "Ajouter un document",
                  "Add a document",
                  "添加文件",
                )}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  await addFiles([file], "document");
                }}
              />
            </label>
            {docs.length ? (
              docs.map((doc) => (
                <div className="document-row" key={doc.id}>
                  <FileText />
                  <div>
                    <strong>{doc.name}</strong>
                    <small>{Math.ceil(doc.size / 1024)} KB</small>
                  </div>
                  <button
                    className="icon-button"
                    disabled={busy}
                    onClick={() => void downloadDocument(doc)}
                    aria-label={`${t("Télécharger", "Download", "下载")} ${doc.name}`}
                  >
                    <Download />
                  </button>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${t("Retirer", "Remove", "移除")} ${doc.name}`}
                    onClick={() => void deleteFile(doc)}
                  >
                    <X />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                icon={FolderOpen}
                text={t(
                  "Aucun document ajouté.",
                  "No documents added.",
                  "尚未添加文件。",
                )}
              />
            )}
          </section>
        )}

        {section === "services" && (
          <>
            <div className="section-intro">
              <h2>
                {t(
                  "Un peu d’aide. Au bon moment.",
                  "The right help, at the right time.",
                  "在需要的时候，得到合适的帮助。",
                )}
              </h2>
              <p>
                {t(
                  "Composez votre sélection. Les tarifs et disponibilités seront confirmés avant tout engagement.",
                  "Build your selection. Prices and availability will be confirmed before any commitment.",
                  "先选出需要的服务，价格和可预约时间将在确认服务前另行确定。",
                )}
              </p>
            </div>
            <div className="service-catalog">
              {serviceIds.map((id, i) => {
                const Icon = serviceIcons[i];
                const selected = services.includes(id);
                return (
                  <article
                    className={`dashboard-card service-item ${selected ? "selected" : ""}`}
                    key={id}
                  >
                    <span className="catalog-icon">
                      <Icon />
                    </span>
                    <h3>{serviceText[lang][i][0]}</h3>
                    <p>{serviceText[lang][i][1]}</p>
                    <span className="service-price">
                      {t(
                        "Tarif à confirmer",
                        "Price to be confirmed",
                        "价格待定",
                      )}
                    </span>
                    <button
                      className={selected ? "outline" : ""}
                      aria-pressed={selected}
                      onClick={() => toggleService(id)}
                    >
                      {selected ? <Check /> : <Plus />}
                      {selected
                        ? t(
                            "Sélectionné · retirer",
                            "Selected · remove",
                            "已选择 · 移除",
                          )
                        : t(
                            "Ajouter à mon projet",
                            "Add to my project",
                            "加入我的计划",
                          )}
                    </button>
                  </article>
                );
              })}
            </div>
            <section className="dashboard-card selected-services">
              <h2>
                {t("Ma sélection", "My selection", "我的服务计划")}{" "}
                <span>{services.length}</span>
              </h2>
              {services.length ? (
                <ul>
                  {services.map((id) => (
                    <li key={id}>
                      <Check />
                      {serviceTitle(id)}
                      <span className="soft-badge">
                        {t("Non commandé", "Not ordered", "尚未下单")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {t(
                    "Choisissez seulement ce qui vous est utile.",
                    "Choose only what helps you.",
                    "按需要选择，随时调整。",
                  )}
                </p>
              )}
              <p className="empty-copy">
                {t(
                  "Votre sélection exprime un intérêt. Aucun achat ni paiement n’est effectué.",
                  "Your selection records interest. No order or payment is made.",
                  "选择仅代表服务意向，不会产生订单或付款。",
                )}
              </p>
              <button
                className="service-next-step"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await saveNow()) go("property");
                }}
              >
                {t(
                  "Continuer vers les renseignements",
                  "Continue to property details",
                  "下一步：完善房屋资料",
                )}
                <ArrowRight />
              </button>
            </section>
          </>
        )}


      </div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof House; text: string }) {
  return (
    <div className="dashboard-empty">
      <Icon />
      <p>{text}</p>
    </div>
  );
}
