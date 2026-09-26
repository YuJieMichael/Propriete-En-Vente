import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ShieldCheck,
  ClipboardCheck,
  History,
  UserPlus,
  RefreshCw,
  ArrowLeft,
  LockKeyhole,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "./auth";
import { AdminEmailPanel } from "./admin-email";
import { BuyerEnquiries } from "./buyer-enquiries";
import { supabase } from "./lib/supabase";
import {apiUrl,apiResult,projectRequest} from './lib/project-api';
import type { Language } from "./seller-copy";
import "./admin.css";
import { ListingReview } from "./listing-review";

const copy = {
  fr: {
    title: "Espace administration",
    eyebrow: "PROPRIETEAVENDRE · ÉQUIPE",
    intro:
      "Traitez les dossiers vendeurs et les annonces publiques depuis un seul endroit.",
    back: "Retour au site",
    login: "Se connecter",
    loginTitle: "Connectez-vous avec votre compte d’équipe",
    loginText:
      "Cet espace est réservé aux membres autorisés. Les comptes clients n’ont pas accès aux dossiers des autres vendeurs.",
    noAccess: "Accès réservé à l’équipe",
    noAccessText:
      "Ce compte n’est pas un compte d’administration actif. Demandez une invitation au propriétaire de la plateforme.",
    setup: "Connexion au serveur à configurer",
    setupText:
      "L’administration réelle sera disponible après la configuration du projet Supabase. Aucun dossier client n’est affiché en mode démonstration.",
    loading: "Chargement…",
    work: "Travail",
    management: "Gestion",
    operations: "Équipe et activité",
    roleOwner: "Propriétaire",
    roleOperator: "Opérations",
    queue: "Centre d’examen",
    buyerRequests: "Demandes d’achat",
    projectReviews: "Dossiers vendeurs",
    listingReviews: "Annonces publiques",
    audit: "Journal des opérations",
    invite: "Inviter un membre",
    auditTab: "Activité",
    inviteTab: "Équipe",
    refresh: "Actualiser",
    empty: "Aucun projet en attente d’examen.",
    emptyAudit: "Aucune opération à afficher.",
    error:
      "Impossible de charger les dossiers. Réessayez après avoir vérifié votre connexion et vos droits d’accès.",
    project: "Projet",
    submitted: "Soumis",
    revision: "Version",
    review: "Examiner",
    close: "Fermer le dossier",
    details: "Détails du dossier",
    private: "Informations privées — réservées à l’examen du dossier.",
    notes: "Note d’examen",
    notesHint:
      "Expliquez les corrections demandées. Cette note sera visible par le vendeur.",
    approve: "Approuver le dossier",
    return: "Demander des corrections",
    required: "Une explication est nécessaire pour demander des corrections.",
    approved:
      "Dossier approuvé. Ses renseignements restent privés. Une annonce publique soumise séparément est publiée dès son approbation dans la section des annonces publiques.",
    returned: "Demande de corrections enregistrée.",
    conflict:
      "La décision n’a pas été enregistrée. Le dossier a pu changer ou vos droits ont expiré. La liste a été actualisée ; ouvrez sa dernière version avant de réessayer.",
    approvalHint:
      "L’approbation exige un dossier terminé et au moins une photo enregistrée.",
    files: "Fichiers du projet",
    noFiles: "Aucun fichier enregistré.",
    openFile: "Ouvrir le fichier",
    fileError: "Impossible d’ouvrir ce fichier privé.",
    inviteTitle: "Inviter un administrateur des opérations",
    inviteText:
      "L’invitation donne accès aux dossiers soumis et aux opérations. Elle ne permet pas d’inviter d’autres administrateurs ni de gérer la configuration du serveur.",
    email: "Adresse courriel professionnelle",
    sendInvite: "Envoyer l’invitation",
    inviteSent:
      "Invitation envoyée. Le membre devra accepter le courriel, définir son mot de passe et activer la double authentification.",
    inviteError:
      "L’invitation n’a pas pu être finalisée. Vérifiez la configuration des courriels. Pour un compte déjà inscrit, utilisez la procédure sécurisée du propriétaire.",
    inviteHint:
      "Nouveaux comptes uniquement. Chaque membre utilise son propre compte et la double authentification.",
    action: "Opération",
    date: "Date",
    actor: "Compte responsable",
    viewOnly: "Historique en lecture seule",
    ownerOnly:
      "Seul le propriétaire de la plateforme peut inviter des membres.",
    completed: "Dossier terminé",
    yes: "Oui",
    no: "Non",
    plan: "Mode de service",
    with: "Accompagnement par courtier",
    without: "Vente autonome",
    services: "Services souhaités",
    unset: "Non renseigné",
    reviewNote: "Note",
    original: "Voir le projet vendeur",
    labels: {
      address: "Adresse",
      city: "Ville",
      postal: "Code postal",
      type: "Type de propriété",
      price: "Prix souhaité",
      broker: "Courtier actuel",
      timeline: "Échéance de vente",
      name: "Nom",
      email: "Courriel",
      phone: "Téléphone",
      date: "Date souhaitée",
      time: "Créneau",
      language: "Langue",
      notes: "Commentaire du vendeur",
      consent: "Consentement",
    },
    types: ["Maison", "Condo", "Plex", "Commercial"],
    brokers: ["Non", "Oui", "À discuter"],
    timelines: [
      "Dès que possible",
      "Dans 1 à 3 mois",
      "Dans 3 à 6 mois",
      "Je me renseigne",
    ],
    times: ["Matin", "Après-midi", "Soir"],
    serviceNames: {
      photo: "Photographie",
      video: "Vidéo",
      analysis: "Analyse de marché",
      consult: "Consultation",
      listing: "Présentation de l’annonce",
    },
    actions: {
      project_reviewed: "Dossier examiné",
      staff_invited: "Membre invité",
      project_submitted: "Dossier soumis",
      staff_assigned: "Accès d’équipe attribué",
    },
  },
  en: {
    title: "Administration",
    eyebrow: "PROPRIETEAVENDRE · TEAM",
    intro: "Review seller projects and public listings from one place.",
    back: "Back to website",
    login: "Sign in",
    loginTitle: "Sign in with your team account",
    loginText:
      "This area is for authorized staff. Customer accounts cannot access other sellers’ files.",
    noAccess: "Team access only",
    noAccessText:
      "This account is not an active staff account. Request an invitation from the platform owner.",
    setup: "Server connection required",
    setupText:
      "Administration becomes available after the Supabase project is configured. No customer files are shown in demonstration mode.",
    loading: "Loading…",
    work: "Work",
    management: "Management",
    operations: "Team and activity",
    roleOwner: "Owner",
    roleOperator: "Operations",
    queue: "Review center",
    buyerRequests: "Buyer enquiries",
    projectReviews: "Seller projects",
    listingReviews: "Public listings",
    audit: "Activity log",
    invite: "Invite a member",
    auditTab: "Activity",
    inviteTab: "Team",
    refresh: "Refresh",
    empty: "No projects are awaiting review.",
    emptyAudit: "No activity to show.",
    error:
      "We could not load the records. Check your connection and access rights, then retry.",
    project: "Project",
    submitted: "Submitted",
    revision: "Revision",
    review: "Review",
    close: "Close record",
    details: "Project details",
    private: "Private information — for reviewing this project only.",
    notes: "Review note",
    notesHint:
      "Explain any requested corrections. The seller will see this note.",
    approve: "Approve project",
    return: "Request changes",
    required: "Explain the corrections before returning this project.",
    approved:
      "Project approved. Its details remain private. A separately submitted public listing goes live as soon as it is approved in Public listings.",
    returned: "The request for changes has been saved.",
    conflict:
      "Your decision was not saved. The project may have changed or your permissions expired. The list was refreshed; open the latest version before trying again.",
    approvalHint:
      "Approval requires a completed project with at least one saved photo.",
    files: "Project files",
    noFiles: "No saved files.",
    openFile: "Open file",
    fileError: "This private file could not be opened.",
    inviteTitle: "Invite an operations administrator",
    inviteText:
      "This invitation grants access to submitted projects and operations. It does not allow inviting other administrators or managing the server configuration.",
    email: "Work email address",
    sendInvite: "Send invitation",
    inviteSent:
      "Invitation sent. The member must accept the email, set a password and enable two-factor authentication.",
    inviteError:
      "The invitation could not be completed. Check the email configuration. For an existing account, use the owner’s secure assignment procedure.",
    inviteHint:
      "New accounts only. Each member needs their own account and two-factor authentication.",
    action: "Action",
    date: "Date",
    actor: "Responsible account",
    viewOnly: "Read-only history",
    ownerOnly: "Only the platform owner can invite staff.",
    completed: "Completed project",
    yes: "Yes",
    no: "No",
    plan: "Service mode",
    with: "Broker assistance",
    without: "Self-directed sale",
    services: "Requested services",
    unset: "Not provided",
    reviewNote: "Note",
    original: "Seller workspace",
    labels: {
      address: "Address",
      city: "City",
      postal: "Postal code",
      type: "Property type",
      price: "Desired price",
      broker: "Current broker",
      timeline: "Sale timeline",
      name: "Name",
      email: "Email",
      phone: "Phone",
      date: "Preferred date",
      time: "Time slot",
      language: "Language",
      notes: "Seller comment",
      consent: "Consent",
    },
    types: ["House", "Condo", "Plex", "Commercial"],
    brokers: ["No", "Yes", "To discuss"],
    timelines: [
      "As soon as possible",
      "In 1–3 months",
      "In 3–6 months",
      "Exploring options",
    ],
    times: ["Morning", "Afternoon", "Evening"],
    serviceNames: {
      photo: "Photography",
      video: "Video",
      analysis: "Market analysis",
      consult: "Consultation",
      listing: "Listing presentation",
    },
    actions: {
      project_reviewed: "Project reviewed",
      staff_invited: "Staff invited",
      project_submitted: "Project submitted",
      staff_assigned: "Staff access assigned",
    },
  },
  zh: {
    title: "管理工作台",
    eyebrow: "PROPRIETEAVENDRE · 团队",
    intro: "在同一个入口审核卖家项目和待发布房源。",
    back: "返回网站",
    login: "登录",
    loginTitle: "使用团队账号登录",
    loginText:
      "此区域仅向获得授权的工作人员开放。普通客户无法访问其他卖家的资料。",
    noAccess: "仅限授权团队成员",
    noAccessText: "此账号不是有效的管理员账号。请向平台所有者申请邀请。",
    setup: "需要配置后端连接",
    setupText:
      "连接 Supabase 项目后才可使用真实管理后台。演示模式不会展示任何客户档案。",
    loading: "加载中…",
    work: "工作",
    management: "管理",
    operations: "团队与记录",
    roleOwner: "平台所有者",
    roleOperator: "运营管理员",
    queue: "审核中心",
    buyerRequests: "买家咨询",
    projectReviews: "卖家项目",
    listingReviews: "公开房源",
    audit: "操作记录",
    invite: "邀请成员",
    auditTab: "操作记录",
    inviteTab: "团队成员",
    refresh: "刷新",
    empty: "目前没有待审核的项目。",
    emptyAudit: "暂无操作记录。",
    error: "无法加载资料。请检查网络和账号权限后重试。",
    project: "项目",
    submitted: "已提交",
    revision: "版本",
    review: "审核",
    close: "关闭详情",
    details: "项目资料",
    private: "私人资料，仅供审核此项目使用。",
    notes: "审核说明",
    notesHint: "请说明需要修改的内容。卖家可以看到此说明。",
    approve: "审核通过",
    return: "退回修改",
    required: "退回修改时必须填写原因。",
    approved: "项目审核通过，资料仍保存在卖家私有工作台。单独提交的公开房源在“公开房源”审核页通过后会立即上线。",
    returned: "已保存修改要求。",
    conflict:
      "审核未保存。项目可能已被修改，或你的权限已失效。列表已刷新，请打开最新版本后重试。",
    approvalHint: "审核通过需要资料已完成，并至少保存一张房屋照片。",
    files: "项目文件",
    noFiles: "暂无已保存文件。",
    openFile: "打开文件",
    fileError: "无法打开此私人文件。",
    inviteTitle: "邀请运营管理员",
    inviteText:
      "成员可以审核已提交项目、跟进运营。此权限不包含邀请其他管理员或修改服务器配置。",
    email: "工作邮箱",
    sendInvite: "发送邀请",
    inviteSent: "邀请已发送。成员需要接受邮件邀请、设置密码，并启用双重验证。",
    inviteError:
      "未能完成邀请。请检查邮件服务配置；已注册账号请按所有者的安全授权流程处理。",
    inviteHint: "仅邀请新账号。每位成员使用独立账号，并启用双重验证。",
    action: "操作",
    date: "时间",
    actor: "操作人账号",
    viewOnly: "只读操作历史",
    ownerOnly: "只有平台所有者可以邀请成员。",
    completed: "资料已完成",
    yes: "是",
    no: "否",
    plan: "服务模式",
    with: "经纪协助",
    without: "自主出售",
    services: "意向服务",
    unset: "未填写",
    reviewNote: "说明",
    original: "卖家工作台",
    labels: {
      address: "地址",
      city: "城市",
      postal: "邮编",
      type: "房屋类型",
      price: "期望售价",
      broker: "现有经纪",
      timeline: "出售时间",
      name: "姓名",
      email: "邮箱",
      phone: "电话",
      date: "期望日期",
      time: "时段",
      language: "语言",
      notes: "卖家备注",
      consent: "资料使用同意",
    },
    types: ["独立住宅", "公寓", "多户住宅", "商业物业"],
    brokers: ["没有", "已有", "需要讨论"],
    timelines: ["尽快", "1–3个月内", "3–6个月内", "先了解"],
    times: ["上午", "下午", "晚上"],
    serviceNames: {
      photo: "专业摄影",
      video: "房屋视频",
      analysis: "市场分析",
      consult: "专业咨询",
      listing: "房源展示设计",
    },
    actions: {
      project_reviewed: "项目审核",
      staff_invited: "邀请团队成员",
      project_submitted: "卖家提交审核",
      staff_assigned: "授予团队权限",
    },
  },
};
type ReviewProject = {
  id: string;
  owner_id: string;
  details: Record<string, unknown>;
  plan: "with" | "without";
  services: string[];
  completed: boolean;
  status: string;
  revision: number;
  updated_at: string;
  review_note: string | null;
};
type AuditEvent = {
  id: string;
  actor_id: string | null;
  project_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
type ProjectFile = {
  id: string;
  kind: string;
  name: string;
  storage_path: string;
};
type Tab = "queue" | "operations";
type ReviewTab = "projects" | "listings" | "buyers";
type OperationsTab = "audit" | "invite";

export function AdminPage({ lang }: { lang: Language }) {
  const t = copy[lang];
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("queue");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("projects");
  const [operationsTab, setOperationsTab] = useState<OperationsTab>("audit");
  const [enquiryRefresh, setEnquiryRefresh] = useState(0);
  const [projects, setProjects] = useState<ReviewProject[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<ReviewProject | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const fetchVersion = useRef(0);
  const fileVersion = useRef(0);
  const canRead = !!auth.user && !!auth.staffRole && auth.adminVerified;

  useEffect(() => {
    if (auth.staffRole !== "owner" && operationsTab === "invite") {
      setOperationsTab("audit");
    }
  }, [auth.staffRole, operationsTab]);

  const refresh = useCallback(async () => {
    if (!supabase || !canRead) return;
    const version = ++fetchVersion.current;
    setLoading(true);
    const [p, a] = await Promise.all([
      apiUrl ? apiResult('/admin/projects') : supabase
        .from("projects")
        .select(
          "id,owner_id,details,plan,services,completed,status,revision,updated_at,review_note",
        )
        .eq("status", "submitted")
        .order("updated_at", { ascending: true })
        .limit(100),
      apiUrl ? apiResult('/admin/audit') : supabase
        .from("audit_events")
        .select("id,actor_id,project_id,action,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (version !== fetchVersion.current) return;
    setLoading(false);
    if (p.error || a.error) {
      setProjects([]);
      setEvents([]);
      setMessage({ text: t.error, error: true });
      return;
    }
    setProjects((p.data || []) as ReviewProject[]);
    setEvents((a.data || []) as AuditEvent[]);
  }, [canRead, auth.user?.id, t.error]);

  useEffect(() => {
    void refresh();
    return () => {
      fetchVersion.current++;
    };
  }, [refresh]);
  useEffect(() => {
    setSelected(null);
    setFiles([]);
    setMessage(null);
  }, [auth.user?.id, auth.staffRole, auth.adminVerified]);

  async function selectProject(project: ReviewProject) {
    if (!supabase || busy) return;
    const version = ++fileVersion.current;
    setSelected(project);
    setNote("");
    setFiles([]);
    setMessage(null);
    setFilesLoading(true);
    const { data, error } = apiUrl ? await apiResult(`/admin/projects/${project.id}/files`) : await supabase
      .from("project_files")
      .select("id,kind,name,storage_path")
      .eq("project_id", project.id)
      .order("created_at");
    if (version !== fileVersion.current) return;
    setFilesLoading(false);
    if (error) {
      setMessage({ text: t.fileError, error: true });
      return;
    }
    setFiles((data || []) as ProjectFile[]);
  }

  async function review(decision: "approved" | "changes_requested") {
    if (!supabase || !selected || busy) return;
    if (decision === "changes_requested" && !note.trim()) {
      setMessage({ text: t.required, error: true });
      return;
    }
    if (
      decision === "approved" &&
      (!selected.completed || !files.some((f) => f.kind === "photo"))
    ) {
      setMessage({ text: t.approvalHint, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = apiUrl ? await apiResult(`/admin/projects/${selected.id}/review`,{method:'POST',body:JSON.stringify({revision:selected.revision,decision,note:note.trim()})}) : await supabase.rpc("review_project", {
      p_project_id: selected.id,
      p_expected_revision: selected.revision,
      p_decision: decision,
      p_note: note.trim(),
    });
    setBusy(false);
    setSelected(null);
    setFiles([]);
    fileVersion.current++;
    await refresh();
    setMessage({
      text: error
        ? t.conflict
        : decision === "approved"
          ? t.approved
          : t.returned,
      error: !!error,
    });
    if (error) void auth.refreshAuth();
  }

  async function openFile(file: ProjectFile) {
    if (!supabase) return;
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    if(apiUrl){try{if(!selected)throw Error();const response=await projectRequest(`/admin/projects/${selected.id}/files/${file.id}/content`);const url=URL.createObjectURL(await response.blob());if(popup)popup.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),60000);}catch{popup?.close();setMessage({text:t.fileError,error:true});}return;}
    const { data, error } = await supabase.storage
      .from("project-files")
      .createSignedUrl(file.storage_path, 60);
    if (error || !data?.signedUrl) {
      popup?.close();
      setMessage({ text: t.fileError, error: true });
      return;
    }
    if (popup) popup.location.replace(data.signedUrl);
    else {
      setMessage({ text: t.fileError, error: true });
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !auth.session || auth.staffRole !== "owner" || busy)
      return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.functions.invoke("invite-staff", {
      body: { email: email.trim(), role: "operator" },
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    });
    setBusy(false);
    if (error) {
      setMessage({ text: t.inviteError, error: true });
      return;
    }
    setEmail("");
    await refresh();
    setMessage({ text: t.inviteSent, error: false });
  }

  function detailValue(key: string, value: unknown) {
    if (key === "consent") return value ? t.yes : t.no;
    if (value === null || value === undefined || value === "") return t.unset;
    const options =
      key === "type"
        ? t.types
        : key === "broker"
          ? t.brokers
          : key === "timeline"
            ? t.timelines
            : key === "time"
              ? t.times
              : null;
    if (options) return options[Number(value)] || String(value);
    if (key === "language")
      return (
        (
          { fr: "Français", en: "English", zh: "中文" } as Record<
            string,
            string
          >
        )[String(value)] || String(value)
      );
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : t.unset;
  }
  const date = (value: string) =>
    new Date(value).toLocaleString(
      lang === "zh" ? "zh-CN" : lang === "fr" ? "fr-CA" : "en-CA",
      { dateStyle: "medium", timeStyle: "short" },
    );
  const gate = (title: string, description: string, login = false) => (
    <main className="admin-gate">
      <LockKeyhole size={32} />
      <h1>{title}</h1>
      <p>{description}</p>
      {login && (
        <a className="admin-primary" href="#login">
          {t.login}
        </a>
      )}
      <a href="#">{t.back}</a>
    </main>
  );
  if (!supabase) return gate(t.setup, t.setupText);
  if (auth.loading)
    return (
      <main className="admin-gate" aria-busy="true">
        {t.loading}
      </main>
    );
  if (auth.error)
    return (
      <main className="admin-gate">
        <LockKeyhole size={32} />
        <h1>{t.title}</h1>
        <p role="alert">{t.error}</p>
        <button className="admin-primary" type="button" onClick={() => void auth.refreshAuth()}>
          <RefreshCw size={16} />{t.refresh}
        </button>
        <a href="#">{t.back}</a>
      </main>
    );
  if (!auth.user) return gate(t.loginTitle, t.loginText, true);
  if (!auth.staffRole) return gate(t.noAccess, t.noAccessText);
  if (!auth.adminVerified)
    return (
      <main className="admin-gate">
        <AdminEmailPanel lang={lang} />
        <a href="#">{t.back}</a>
      </main>
    );

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <a href="#" className="admin-back">
          <ArrowLeft size={16} />
          {t.back}
        </a>
        <div className="admin-brand">
          <ShieldCheck size={30} />
          <strong>
            Propriété En Vente<small>{t.title}</small>
          </strong>
        </div>
        <div className="admin-role">
          {auth.staffRole === "owner" ? t.roleOwner : t.roleOperator}
          <span>{auth.user.email}</span>
        </div>
        <nav aria-label={t.title}>
          <div className="admin-nav-section">
            <span className="admin-nav-heading">{t.work}</span>
            <button
              className={tab === "queue" ? "active" : ""}
              aria-current={tab === "queue" ? "page" : undefined}
              onClick={() => setTab("queue")}
            >
              <ClipboardCheck size={18} />
              {t.queue}
            </button>
          </div>
          <div className="admin-nav-section">
            <span className="admin-nav-heading">{t.management}</span>
            <button
              className={tab === "operations" ? "active" : ""}
              aria-current={tab === "operations" ? "page" : undefined}
              onClick={() => setTab("operations")}
            >
              <History size={18} />
              {t.operations}
            </button>
          </div>
        </nav>
        <a className="admin-seller-link" href="#dashboard">
          {t.original}
          <ExternalLink size={14} />
        </a>
      </aside>
      <section className="admin-content">
        <header className="admin-heading">
          <div>
            <span>{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
          </div>
          <button
            className="admin-secondary admin-refresh-button"
            onClick={() => {
              setMessage(null);
              setEnquiryRefresh(value => value + 1);
              void refresh();
            }}
            disabled={loading || busy}
          >
            <RefreshCw size={16} />
            {t.refresh}
          </button>
        </header>
        {message && (
          <p
            className={`admin-message ${message.error ? "error" : "success"}`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
        {tab === "queue" && (
          <>
            <div className="admin-review-tabs" role="tablist" aria-label={t.queue}>
              <button
                type="button"
                role="tab"
                aria-selected={reviewTab === "projects"}
                className={reviewTab === "projects" ? "active" : ""}
                onClick={() => setReviewTab("projects")}
              >
                {t.projectReviews}<span>{projects.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={reviewTab === "listings"}
                className={reviewTab === "listings" ? "active" : ""}
                onClick={() => setReviewTab("listings")}
              >
                {t.listingReviews}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={reviewTab === "buyers"}
                className={reviewTab === "buyers" ? "active" : ""}
                onClick={() => setReviewTab("buyers")}
              >
                {t.buyerRequests}
              </button>
            </div>
            {reviewTab === "listings" ? (
              <ListingReview key={auth.user.id} lang={lang} email={auth.user.email || ''} refreshKey={enquiryRefresh} />
            ) : reviewTab === "buyers" ? (
              <BuyerEnquiries key={auth.user.id} lang={lang} refreshKey={enquiryRefresh} />
            ) : <>
            <div className="admin-panel">
              <h2>
                {t.projectReviews} <span className="admin-count">{projects.length}</span>
              </h2>
              {loading ? (
                <p aria-live="polite">{t.loading}</p>
              ) : projects.length === 0 ? (
                <p className="admin-empty">{t.empty}</p>
              ) : (
                <div className="admin-project-list">
                  {projects.map((project) => (
                    <article key={project.id}>
                      <div>
                        <strong>
                          {String(project.details.address || t.project)}
                        </strong>
                        <p>
                          {String(project.details.city || "")} ·{" "}
                          {date(project.updated_at)}
                        </p>
                        <small>
                          {t.revision} {project.revision} ·{" "}
                          {project.id.slice(0, 8)}
                        </small>
                      </div>
                      <button
                        className="admin-secondary"
                        disabled={busy}
                        onClick={() => void selectProject(project)}
                      >
                        {t.review}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <section
                className="admin-panel admin-detail"
                aria-labelledby="admin-detail-title"
              >
                <div className="admin-detail-heading">
                  <h2 id="admin-detail-title">{t.details}</h2>
                  <button
                    className="admin-text-button"
                    disabled={busy}
                    onClick={() => {
                      setSelected(null);
                      fileVersion.current++;
                    }}
                  >
                    {t.close}
                  </button>
                </div>
                <p className="admin-private">
                  <LockKeyhole size={15} />
                  {t.private}
                </p>
                <dl className="admin-detail-grid">
                  <div>
                    <dt>{t.plan}</dt>
                    <dd>{selected.plan === "with" ? t.with : t.without}</dd>
                  </div>
                  <div>
                    <dt>{t.completed}</dt>
                    <dd>{selected.completed ? t.yes : t.no}</dd>
                  </div>
                  {Object.entries(t.labels).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{detailValue(key, selected.details[key])}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>{t.services}</dt>
                    <dd>
                      {selected.services
                        .map(
                          (service) =>
                            (t.serviceNames as Record<string, string>)[
                              service
                            ] || service,
                        )
                        .join(", ") || t.unset}
                    </dd>
                  </div>
                </dl>
                <h3>{t.files}</h3>
                {filesLoading ? (
                  <p>{t.loading}</p>
                ) : files.length === 0 ? (
                  <p>{t.noFiles}</p>
                ) : (
                  <ul className="admin-files">
                    {files.map((file) => (
                      <li key={file.id}>
                        <span>{file.name}</span>
                        <button
                          className="admin-text-button"
                          onClick={() => void openFile(file)}
                        >
                          {t.openFile}
                          <ExternalLink size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="admin-field">
                  {t.notes}
                  <textarea
                    maxLength={2000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t.notesHint}
                    rows={3}
                    disabled={busy}
                  />
                </label>
                <p className="admin-help">{t.approvalHint}</p>
                <div className="admin-review-actions">
                  <button
                    className="admin-secondary"
                    onClick={() => void review("changes_requested")}
                    disabled={busy || filesLoading}
                  >
                    {busy ? t.loading : t.return}
                  </button>
                  <button
                    className="admin-primary"
                    onClick={() => void review("approved")}
                    disabled={
                      busy ||
                      filesLoading ||
                      !selected.completed ||
                      !files.some((file) => file.kind === "photo")
                    }
                  >
                    {busy ? t.loading : t.approve}
                  </button>
                </div>
              </section>
            )}
            </>}
          </>
        )}
        {tab === "operations" && (
          <>
          <div className="admin-review-tabs admin-operation-tabs" role="tablist" aria-label={t.management}>
            <button type="button" role="tab" aria-selected={operationsTab === "audit"} className={operationsTab === "audit" ? "active" : ""} onClick={() => setOperationsTab("audit")}>
              <History size={16} />{t.auditTab}
            </button>
            {auth.staffRole === "owner" && <button type="button" role="tab" aria-selected={operationsTab === "invite"} className={operationsTab === "invite" ? "active" : ""} onClick={() => setOperationsTab("invite")}>
              <UserPlus size={16} />{t.inviteTab}
            </button>}
          </div>
          {operationsTab === "audit" && (
          <section className="admin-panel">
            <h2>{t.audit}</h2>
            <p className="admin-help">{t.viewOnly}</p>
            {loading ? (
              <p>{t.loading}</p>
            ) : events.length === 0 ? (
              <p className="admin-empty">{t.emptyAudit}</p>
            ) : (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.action}</th>
                      <th>{t.actor}</th>
                      <th>{t.project}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>{date(event.created_at)}</td>
                        <td>
                          {(t.actions as Record<string, string>)[
                            event.action
                          ] || event.action}
                          {typeof event.metadata.note === "string" &&
                            event.metadata.note && (
                              <small>{event.metadata.note}</small>
                            )}
                        </td>
                        <td>
                          <code>{event.actor_id?.slice(0, 8) || "—"}</code>
                        </td>
                        <td>
                          <code>{event.project_id?.slice(0, 8) || "—"}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}
          </>
        )}
        {tab === "operations" && operationsTab === "invite" && auth.staffRole === "owner" && (
          <section className="admin-panel admin-invite">
            <UserPlus size={28} />
            <h2>{t.inviteTitle}</h2>
            <p>{t.inviteText}</p>
            <form onSubmit={(event) => void invite(event)}>
              <label className="admin-field">
                {t.email}
                <input
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </label>
              <p className="admin-help">{t.inviteHint}</p>
              <button className="admin-primary" type="submit" disabled={busy}>
                {busy ? t.loading : t.sendInvite}
              </button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
