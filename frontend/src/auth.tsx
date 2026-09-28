import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type FormEvent, type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ArrowRight, CheckCircle2, House, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import type { Language } from "./seller-copy";
import { authCallbackUrl, backendConfigured, supabase } from "./lib/supabase";
import "./auth.css";
import { recoveryCopy } from "./recovery-copy";

type StaffRole = "owner" | "operator" | null;
type Assurance = "aal1" | "aal2" | null;
type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  staffRole: StaffRole;
  aal: Assurance;
  adminVerified: boolean;
  error: string | null;
  callbackPending: boolean;
  callbackError: string | null;
  recoverySession: boolean;
  invitationSession: boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearRecovery: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error
    ? String(error.message) : "Unable to connect. Please try again.";
}

// Reuse a callback exchange during StrictMode remounts. Auth codes are single use.
let callbackExchange: Promise<{ invitation: boolean; recovery: boolean }> | null = null;
let callbackKey = "";
let callbackRecoveryObserved = false;
function exchangeCallback() {
  const url = new URL(window.location.href);
  // Supabase appends #access_token even when redirect_to already has a hash route.
  // Accept existing emailed links as well as ordinary root-fragment callbacks.
  const fragment = url.hash.replace(/^#/, "").replace(/^auth\/callback[#?]/, "");
  const fragmentParams = new URLSearchParams(fragment.includes("?") ? fragment.split("?").slice(1).join("?") : fragment);
  const code = url.searchParams.get("code") || fragmentParams.get("code");
  const error = url.searchParams.get("error_description") || fragmentParams.get("error_description");
  const accessToken = fragmentParams.get("access_token");
  const refreshToken = fragmentParams.get("refresh_token");
  if (!code && !accessToken && !refreshToken && !error) return null;
  const key = code || accessToken || error || "";
  if (callbackExchange && callbackKey === key) return callbackExchange;
  callbackKey = key;
  callbackRecoveryObserved = false;
  callbackExchange = (async () => {
    try {
      if (error) throw new Error(error);
      if (!supabase) throw new Error("Authentication is not configured.");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        if (!data.session) throw new Error("This link has expired. Please request another one.");
        return { invitation: false, recovery: callbackRecoveryObserved };
      }
      if (!accessToken || !refreshToken) throw new Error("This link is incomplete. Please request another one.");
      const { data, error: exchangeError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (exchangeError) throw exchangeError;
      if (!data.session) throw new Error("This link has expired. Please request another one.");
      // Supabase validates the supplied tokens; a hash route alone never grants a session.
      return { invitation: fragmentParams.get("type") === "invite", recovery: fragmentParams.get("type") === "recovery" };
    } finally {
      url.searchParams.delete("code");
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      url.hash = "auth/callback";
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  })();
  return callbackExchange;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(backendConfigured);
  const [staffRole, setStaffRole] = useState<StaffRole>(null);
  const [aal, setAal] = useState<Assurance>(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackPending, setCallbackPending] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [recoverySession, setRecoverySession] = useState(false);
  const [invitationSession, setInvitationSession] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const sessionUserId = useRef<string | null>(null);
  const applySession = useCallback(async (next: Session | null, version: number) => {
    if (!mounted.current || version !== generation.current) return;
    setSession(next);
    setStaffRole(null);
    setAal(null);
    setAdminVerified(false);
    setError(null);
    if (!next || !supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const [roleResult, assuranceResult] = await Promise.all([
        supabase.rpc("get_my_staff_role"),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (roleResult.error) throw roleResult.error;
      if (assuranceResult.error) throw assuranceResult.error;
      if (!mounted.current || version !== generation.current) return;
      const role = roleResult.data;
      const access = role === 'owner' || role === 'operator'
        ? await supabase.rpc('get_my_staff_access') : { data: false, error: null };
      if (!mounted.current || version !== generation.current) return;
      if (access.error) throw access.error;
      setAdminVerified(access.data === true);
      setStaffRole(role === "owner" || role === "operator" ? role : null);
      const level = assuranceResult.data.currentLevel;
      setAal(level === "aal1" ? "aal1" : level === "aal2" ? "aal2" : null);
    } catch (err) {
      if (mounted.current && version === generation.current) setError(messageOf(err));
    } finally {
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!supabase) return;
    const version = ++generation.current;
    setLoading(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (version !== generation.current || !mounted.current) return;
      if (sessionError) throw sessionError;
      await applySession(data.session, version);
    } catch (err) {
      if (version === generation.current && mounted.current) {
        setStaffRole(null); setAal(null); setError(messageOf(err)); setLoading(false);
      }
    }
  }, [applySession]);

  useEffect(() => {
    mounted.current = true;
    if (!supabase) return () => { mounted.current = false; };
    const client = supabase;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      const version = ++generation.current;
      if (sessionUserId.current !== (next?.user.id ?? null)) {
        setRecoverySession(false); setInvitationSession(false);
      }
      sessionUserId.current = next?.user.id ?? null;
      if (event === "PASSWORD_RECOVERY") { callbackRecoveryObserved = true; setRecoverySession(true); }
      if (event === "SIGNED_OUT") { setRecoverySession(false); setInvitationSession(false); }
      // Clear old account permissions immediately, before asynchronous RPC results.
      setSession(next);
      setStaffRole(null);
      setAal(null);
      setAdminVerified(false);
      setLoading(Boolean(next));
      // Do not await other auth calls inside the auth event callback (client lock).
      window.setTimeout(() => { void applySession(next, version); }, 0);
    });
    const callback = exchangeCallback();
    if (callback) {
      setCallbackPending(true);
      callback.then(result => {
        if (!mounted.current) return;
        if (result.recovery) { setRecoverySession(true); window.location.hash = "reset-password"; }
        else if (result.invitation) { setInvitationSession(true); window.location.hash = "set-password"; }
        else { setRecoverySession(false); setInvitationSession(false); window.location.hash = "dashboard"; }
      }).catch(err => {
        if (mounted.current) setCallbackError(messageOf(err));
      }).finally(() => {
        if (mounted.current) { setCallbackPending(false); void refreshAuth(); }
      });
    } else void refreshAuth();
    return () => {
      mounted.current = false;
      ++generation.current;
      subscription.unsubscribe();
    };
  }, [applySession, refreshAuth]);

  useEffect(() => {
    if (!supabase || !session || !staffRole) return;
    let active = true;
    const client = supabase;
    const check = async () => {
      try {
        const { data, error: checkError } = await client.rpc('get_my_staff_access');
        if (active) setAdminVerified(!checkError && data === true);
      } catch { if (active) setAdminVerified(false); }
    };
    const timer = window.setInterval(() => { void check(); }, 30000);
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [session?.access_token, staffRole]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) { setError(signOutError.message); throw signOutError; }
    ++generation.current;
    setSession(null); setStaffRole(null); setAal(null); setError(null);
    setAdminVerified(false);
    setRecoverySession(false); setInvitationSession(false); setLoading(false);
  }, []);
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, staffRole, aal, adminVerified, error,
    callbackPending, callbackError, recoverySession, invitationSession, signOut, refreshAuth,
    clearRecovery: () => { setRecoverySession(false); setInvitationSession(false); },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

const copy = {
  fr: {
    waitingTitle: "Confirmez votre adresse courriel", waitingText: "Consultez votre boîte courriel et cliquez sur le dernier lien de confirmation. Une fois le courriel validé, votre espace s’ouvrira automatiquement dans le navigateur où vous ouvrez le lien.", waitingOther: "Si vous avez déjà un compte, revenez à la connexion ou utilisez « Mot de passe oublié ». Pour protéger la confidentialité des comptes, cette page ne confirme pas si l’adresse est déjà inscrite. Pour un nouveau compte, vérifiez aussi les courriers indésirables.", verifiedLogin: "J’ai confirmé mon courriel — me connecter", resend: "Renvoyer le courriel", resent: "Demande envoyée. Consultez votre boîte courriel et utilisez le lien le plus récent.", changeEmail: "Modifier l’adresse courriel",
    eyebrow: "VOTRE ESPACE PROPRIÉTÉ EN VENTE", title: "Votre projet,\nà votre rythme.",
    intro: "Un seul compte pour préparer votre vente, retrouver vos documents et choisir l’aide dont vous avez besoin.",
    benefit1: "Vos projets sauvegardés", benefit2: "Des services à la carte", benefit3: "Un accès personnel sécurisé",
    login: "Retrouver mon espace", register: "Créer mon compte", forgot: "Mot de passe oublié", reset: "Choisir un nouveau mot de passe", invite: "Activer votre accès",
    loginText: "Connectez-vous pour poursuivre votre projet.", registerText: "Commencez gratuitement. Choisissez vos services plus tard.", forgotText: "Nous vous enverrons un lien pour choisir un nouveau mot de passe.", resetText: "Choisissez un mot de passe d’au moins 8 caractères.",
    email: "Adresse courriel", password: "Mot de passe", confirm: "Confirmer le mot de passe", passwordHint: "Au moins 8 caractères", submit: "Se connecter", create: "Créer mon compte", send: "Envoyer le lien", save: "Enregistrer le mot de passe", busy: "Un instant…",
    noAccount: "Vous commencez votre projet ?", already: "Vous avez déjà un compte ?", back: "Revenir à la connexion", home: "Retour à l’accueil",
    verify: "Vérifiez votre boîte courriel pour confirmer votre adresse, puis connectez-vous. Ouvrez le lien dans ce navigateur.",
    sent: "Si cette adresse est associée à un compte, vous recevrez un lien de réinitialisation. Ouvrez-le dans ce navigateur.", saved: "Votre mot de passe a été enregistré.", mismatch: "Les mots de passe ne correspondent pas.",
    unavailable: "L’espace sécurisé sera bientôt disponible.", unavailableText: "Le service de connexion n’est pas encore configuré. Aucun compte ne peut être créé pour le moment.",
    linkFailed: "Connexion par lien interrompue", linkHelp: "Ce lien ne peut pas terminer la connexion dans ce navigateur. Si vous venez de confirmer votre courriel, essayez de vous connecter avec votre mot de passe. Pour réinitialiser le mot de passe, demandez un nouveau lien ici et ouvrez-le dans le même navigateur, sur ce même site.",
    callback: "Vérification de votre lien…", invalid: "Ce lien n’est pas valide ou a expiré. Demandez un nouveau lien.", retry: "Réessayer", issue: "La demande n’a pas pu être traitée.",
    privacy: "Votre compte est personnel. Aucune souscription payante n’est requise pour le créer.",
    mfaTitle: "Protégez votre accès administrateur", mfaText: "La double authentification est obligatoire pour accéder à l’administration.",
    mfaSetup: "Activer la double authentification", mfaScan: "Dans Google Authenticator ou Microsoft Authenticator, ajoutez un compte et scannez ce QR code. N’utilisez pas l’appareil photo du téléphone. Saisissez ensuite le code à 6 chiffres ici. Vous pouvez aussi utiliser la clé manuelle ci-dessous.",
    mfaCode: "Code à 6 chiffres", mfaVerify: "Vérifier et continuer", mfaExisting: "Saisissez le code de votre application d’authentification.", mfaSecret: "Clé de configuration manuelle", mfaComplete: "Votre accès est vérifié.", needLogin: "Connectez-vous pour continuer.",
  },
  en: {
    waitingTitle: "Confirm your email address", waitingText: "Check your inbox and click the latest confirmation link. Once your email is verified, your account opens automatically in the browser where you open the link.", waitingOther: "If you already have an account, return to sign in or use “Forgot your password?”. To protect account privacy, this page does not confirm whether an email is registered. For a new account, check your spam folder too.", verifiedLogin: "I confirmed my email — sign in", resend: "Resend confirmation email", resent: "Request sent. Check your inbox and use the newest link.", changeEmail: "Change email address",
    eyebrow: "YOUR PROPRIÉTÉ EN VENTE SPACE", title: "Your project,\nat your own pace.",
    intro: "One account to prepare your sale, keep your documents together and choose the help you need.",
    benefit1: "Your projects, saved", benefit2: "Services when you need them", benefit3: "Secure, personal access",
    login: "Welcome back", register: "Create your account", forgot: "Forgot your password?", reset: "Choose a new password", invite: "Activate your access",
    loginText: "Sign in to pick up where you left off.", registerText: "Start for free. Choose your services later.", forgotText: "We’ll email you a link to choose a new password.", resetText: "Choose a password with at least 8 characters.",
    email: "Email address", password: "Password", confirm: "Confirm password", passwordHint: "At least 8 characters", submit: "Sign in", create: "Create account", send: "Send reset link", save: "Save password", busy: "One moment…",
    noAccount: "Starting your project?", already: "Already have an account?", back: "Back to sign in", home: "Back to home",
    verify: "Check your email to confirm your address, then sign in. Open the confirmation link in this browser.", sent: "If this email belongs to an account, you’ll receive a reset link. Open it in this browser.", saved: "Your password has been saved.", mismatch: "The passwords do not match.",
    unavailable: "Your secure space is coming soon.", unavailableText: "Sign-in has not been configured yet. Accounts cannot be created at this time.",
    linkFailed: "Link sign-in could not finish", linkHelp: "This link cannot finish signing you in with this browser. If you just confirmed your email, try signing in with your password. To reset your password, request a new link here and open it in the same browser, on this same website.",
    callback: "Verifying your link…", invalid: "This link is invalid or has expired. Please request a new link.", retry: "Try again", issue: "We couldn’t complete your request.",
    privacy: "Your account is personal. Creating one does not require a paid subscription.",
    mfaTitle: "Protect your administrator access", mfaText: "Two-factor authentication is required to access administration.", mfaSetup: "Enable two-factor authentication", mfaScan: "In Google Authenticator or Microsoft Authenticator, add an account and scan this QR code. Do not use the phone camera app. Enter the 6-digit code here. You can also use the manual setup key below.", mfaCode: "6-digit code", mfaVerify: "Verify and continue", mfaExisting: "Enter the code from your authenticator app.", mfaSecret: "Manual setup key", mfaComplete: "Your access is verified.", needLogin: "Sign in to continue.",
  },
  zh: {
    waitingTitle: "等待邮箱验证", waitingText: "请前往邮箱，点击最新邮件中的验证链接。邮箱验证成功后，会在打开链接的浏览器中自动进入账号。", waitingOther: "如果你已经有账号，请返回登录或点“找回密码”。为保护账号隐私，页面不会确认这个邮箱是否已注册；如果是新账号，请检查收件箱和垃圾邮件。", verifiedLogin: "我已验证邮箱，登录", resend: "重新发送验证邮件", resent: "发送请求已成功，请检查邮箱并使用最新链接。", changeEmail: "修改邮箱地址",
    eyebrow: "PROPRIÉTÉ EN VENTE · 您的专属空间", title: "您的卖房计划，\n由您掌握节奏。",
    intro: "一个账号，保存房屋资料、管理卖房进度，在需要时选择专业帮助。",
    benefit1: "项目资料持续保存", benefit2: "按需选择专业服务", benefit3: "独立且安全的个人空间",
    login: "欢迎回来", register: "创建您的账号", forgot: "找回密码", reset: "设置新密码", invite: "激活您的访问权限",
    loginText: "登录账号，继续您的卖房计划。", registerText: "免费开始准备，需要帮助时再选择服务。", forgotText: "输入注册邮箱，我们会向您发送密码重置链接。", resetText: "请设置至少 8 个字符的新密码。",
    email: "邮箱地址", password: "密码", confirm: "确认密码", passwordHint: "至少 8 个字符", submit: "登录工作室", create: "创建账号", send: "发送重置链接", save: "保存新密码", busy: "正在处理…",
    noAccount: "第一次开始卖房计划？", already: "已经有账号？", back: "返回登录", home: "返回首页",
    verify: "请查看邮箱并验证邮箱地址，再登录您的账号。请使用当前浏览器打开验证链接。", sent: "如果此邮箱已注册，您将收到密码重置链接。请使用当前浏览器打开链接。", saved: "您的密码已保存。", mismatch: "两次输入的密码不一致。",
    unavailable: "安全账号功能即将开放。", unavailableText: "登录服务尚未完成配置，目前暂时无法创建账号。",
    linkFailed: "链接登录未完成", linkHelp: "这个链接无法在当前浏览器完成登录。如果刚刚验证了邮箱，请尝试用原密码登录。若要重置密码，请在这里重新申请链接，并在同一个浏览器、同一个网站中打开，不要在本地版和线上版之间切换。",
    callback: "正在验证您的链接…", invalid: "此链接无效或已过期，请重新申请链接。", retry: "重试", issue: "请求未能完成。",
    privacy: "账号仅供本人使用。创建账号无需购买套餐。",
    mfaTitle: "保护您的管理员账号", mfaText: "进入管理后台前，需要完成双重验证。", mfaSetup: "启用双重验证", mfaScan: "请打开 Google Authenticator 或 Microsoft Authenticator，选择添加账号并扫描二维码，不要使用手机相机。将应用显示的 6 位码填到这里；也可以使用下方的手动设置密钥。", mfaCode: "6 位验证码", mfaVerify: "验证并继续", mfaExisting: "请输入身份验证器应用中的验证码。", mfaSecret: "手动设置密钥", mfaComplete: "您的访问身份已验证。", needLogin: "请先登录账号。",
  },
};

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const listener = () => setHash(window.location.hash);
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  return hash;
}

const pendingSignupKey = "propriete-en-vente.pending-signup";
function readPendingSignup(): string {
  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingSignupKey) || "null");
    return pending && typeof pending.email === "string" && Date.now() - pending.at < 3600000 ? pending.email : "";
  } catch { return ""; }
}
function savePendingSignup(email: string) {
  try {
    if (email) sessionStorage.setItem(pendingSignupKey, JSON.stringify({ email, at: Date.now() }));
    else sessionStorage.removeItem(pendingSignupKey);
  } catch { /* Waiting still works in memory if browser storage is unavailable. */ }
}

export function AuthPage({ lang }: { lang: Language }) {
  const c = copy[lang];
  const recovery = recoveryCopy[lang];
  const auth = useAuth();
  const hash = useHash();
  const mode = hash.startsWith("#register") ? "register" : hash.startsWith("#forgot-password") ? "forgot" : hash.startsWith("#reset-password") ? "reset" : hash.startsWith("#set-password") ? "invite" : hash.startsWith("#auth/callback") ? "callback" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingEmail, setPendingEmail] = useState(readPendingSignup);
  const [resendWait, setResendWait] = useState(0);
  const [resetAddress, setResetAddress] = useState("");
  const [resetWait, setResetWait] = useState(0);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const resetSending = useRef(false);
  const waiting = mode === "register" && Boolean(pendingEmail);
  const unconfirmedMessage = {
    en: 'Your email has not been confirmed. Open the latest confirmation email before signing in.',
    fr: 'Votre courriel n’est pas encore confirmé. Ouvrez le dernier courriel de confirmation avant de vous connecter.',
    zh: '邮箱尚未验证成功，请先打开最新邮件完成验证，再登录。',
  }[lang];
  useEffect(() => { setError(""); setNotice(""); setPassword(""); setConfirm(""); setResetAddress(""); setPasswordSaved(false); }, [mode]);
  useEffect(() => {
    if (!resetWait) return;
    const timer = window.setTimeout(() => setResetWait(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resetWait]);
  useEffect(() => {
    if (!resendWait) return;
    const timer = window.setTimeout(() => setResendWait(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendWait]);
  useEffect(() => {
    if (!waiting || !auth.user?.email_confirmed_at || auth.user.email?.toLowerCase() !== pendingEmail.toLowerCase()) return;
    savePendingSignup(""); setPendingEmail("");
    // Supabase broadcasts verified sessions across same-origin tabs.
    window.location.hash = "dashboard";
  }, [waiting, auth.user, pendingEmail]);
  const resend = async () => {
    if (!supabase || busy || resendWait || !pendingEmail) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email: pendingEmail, options: { emailRedirectTo: authCallbackUrl() } });
      if (resendError) throw resendError;
      setNotice(c.resent); setResendWait(60);
    } catch (err) { setError(messageOf(err)); setResendWait(60); }
    finally { setBusy(false); }
  };
  const passwordMode = mode === "reset" || mode === "invite";
  const canSetPassword = Boolean(auth.user && (mode === "reset" ? auth.recoverySession : auth.invitationSession));
  const sendReset = async () => {
    if (!supabase || busy || resetWait || resetSending.current) return;
    resetSending.current = true;
    setBusy(true); setError(""); setNotice("");
    const address = (resetAddress || email).trim();
    try {
      const { error: resultError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: authCallbackUrl() });
      if (resultError) throw resultError;
      setResetAddress(address); setResetWait(60);
    } catch (err) {
      const code = (err as { code?: string; status?: number })?.code;
      const limited = code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || (err as { status?: number })?.status === 429;
      setError(limited ? recovery.rateLimit : recovery.failed);
      if (limited) setResetWait(60);
    } finally { resetSending.current = false; setBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    if (mode === "forgot") { await sendReset(); return; }
    setError(""); setNotice("");
    if (((mode === "register" && !waiting) || passwordMode) && password !== confirm) { setError(c.mismatch); return; }
    setBusy(true);
    try {
      if (mode === "login" || waiting) {
        auth.clearRecovery();
        const address = waiting ? pendingEmail : email.trim();
        const { data, error: resultError } = await supabase.auth.signInWithPassword({ email: address, password });
        if (resultError?.code === "email_not_confirmed") {
          savePendingSignup(address); setPendingEmail(address);
          setPassword(""); setConfirm(""); setError(unconfirmedMessage);
          window.alert(unconfirmedMessage);
          return;
        }
        if (resultError) throw resultError;
        if (!data.session) throw new Error(c.issue);
        setPassword(""); setConfirm("");
        savePendingSignup(""); setPendingEmail("");
        window.location.hash = "dashboard";
      } else if (mode === "register") {
        auth.clearRecovery();
        const { data, error: resultError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authCallbackUrl(), data: { preferred_language: lang } } });
        if (resultError) throw resultError;
        if (data.session) window.location.hash = "dashboard";
        else { const address = email.trim(); savePendingSignup(address); setPendingEmail(address); setResendWait(60); setPassword(""); setConfirm(""); }
      } else if (passwordMode) {
        if (!canSetPassword) throw new Error(c.invalid);
        const { error: resultError } = await supabase.auth.updateUser({ password });
        if (resultError) throw resultError;
        auth.clearRecovery(); setPassword(""); setConfirm("");
        setPasswordSaved(true);
      }
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };
  return <main className="auth-page">
    <section className="auth-story">
      <span className="auth-eyebrow">{c.eyebrow}</span>
      <h1>{c.title.split("\n").map((line, index) => <span key={index}>{line}</span>)}</h1>
      <p>{c.intro}</p>
      <ul>{[c.benefit1, c.benefit2, c.benefit3].map(text => <li key={text}><CheckCircle2 size={19} />{text}</li>)}</ul>
      <div className="auth-story-mark"><House size={35} /><span>La technologie pour avancer.<br />Un humain pour décider.</span></div>
    </section>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-symbol"><LockKeyhole size={25} /></div>
      <h2 id="auth-title">{passwordSaved ? recovery.success : mode === "forgot" && resetAddress ? recovery.checkEmail : waiting ? c.waitingTitle : mode === "callback" ? (auth.callbackError || (!auth.callbackPending && !auth.loading) ? c.linkFailed : c.callback) : c[mode]}</h2>
      {!backendConfigured ? <div className="auth-notice"><strong>{c.unavailable}</strong><p>{c.unavailableText}</p></div>
      : passwordSaved ? <><div className="auth-notice" role="status">{c.saved}</div><a className="auth-primary" href="#dashboard">{recovery.continue}<ArrowRight size={18} /></a></>
      : mode === "forgot" && resetAddress ? <>
          <div className="auth-notice" role="status"><strong>{resetAddress}</strong><p>{recovery.sent}</p></div>
          <p className="auth-subtitle">{recovery.hint}</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-primary" type="button" disabled={busy || resetWait > 0} onClick={() => void sendReset()}>{busy ? c.busy : recovery.resend}{resetWait > 0 ? ` (${resetWait}s)` : ""}</button>
          <button className="auth-text-button" type="button" disabled={busy} onClick={() => { setResetAddress(""); setError(""); }}>{recovery.change}</button>
          <a className="auth-back" href="#login">{c.back}</a>
        </>
      : waiting ? <>
          <div className="auth-notice" role="status"><strong>{pendingEmail}</strong><p>{c.waitingText}</p></div>
          <p className="auth-subtitle">{c.waitingOther}</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          <form onSubmit={submit} className="auth-form">
            <label>{c.email}<input type="email" name="email" autoComplete="username" value={pendingEmail} readOnly /></label>
            <label>{c.password}<input type="password" name="password" autoComplete="current-password" required minLength={1} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
            <a className="auth-forgot" href="#forgot-password" onClick={() => setEmail(pendingEmail)}>{c.forgot}</a>
            <button className="auth-primary" type="submit" disabled={busy}>{busy ? c.busy : c.verifiedLogin}<ArrowRight size={18} /></button>
          </form>
          <a className="auth-back" href="#login" onClick={() => setEmail(pendingEmail)}>{c.back}</a>
          <button className="auth-text-button" type="button" disabled={busy || resendWait > 0} onClick={() => { void resend(); }}>{c.resend}{resendWait > 0 ? ` (${resendWait}s)` : ""}</button>
          <button className="auth-text-button" type="button" disabled={busy} onClick={() => { savePendingSignup(""); setPendingEmail(""); setPassword(""); setConfirm(""); setNotice(""); setError(""); }}>{c.changeEmail}</button>
        </>
      : mode === "callback" ? <div role={auth.callbackError ? "alert" : "status"} className={auth.callbackError ? "auth-error" : "auth-notice"}>
          {auth.callbackPending || auth.loading ? c.callback : <>
            <p>{c.linkHelp}</p>
            <a href="#login">{c.back}</a>
            <a href="#forgot-password">{c.forgot}</a>
          </>}
        </div>
      : passwordMode && !canSetPassword ? <div className="auth-notice" role="status">{auth.loading ? c.callback : c.invalid}<a href="#forgot-password">{c.forgot}</a></div>
      : <>
        <p className="auth-subtitle">{mode === "register" ? c.registerText : mode === "forgot" ? c.forgotText : passwordMode ? c.resetText : c.loginText}</p>
        <form onSubmit={submit} className="auth-form">
          {!passwordMode && <label>{c.email}<span className="auth-input-wrap"><Mail size={18} /><input type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></span></label>}
          {mode !== "forgot" && <label>{c.password}<input type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />{mode !== "login" && <small>{c.passwordHint}</small>}</label>}
          {(mode === "register" || passwordMode) && <label>{c.confirm}<input type="password" name="password-confirm" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy} /></label>}
          {mode === "login" && <a className="auth-forgot" href="#forgot-password">{c.forgot}</a>}
          {(error || auth.error) && <div className="auth-error" role="alert">{error || auth.error}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          <button className="auth-primary" type="submit" disabled={busy || (mode === "forgot" && resetWait > 0)}>{busy ? c.busy : mode === "register" ? c.create : mode === "forgot" ? c.send : passwordMode ? c.save : c.submit}{mode === "forgot" && resetWait > 0 ? ` (${resetWait}s)` : ""}<ArrowRight size={18} /></button>
        </form>
        {(mode === "login" || mode === "register") && <p className="auth-switch">{mode === "login" ? c.noAccount : c.already} <a href={mode === "login" ? "#register" : "#login"}>{mode === "login" ? c.register : c.submit}</a></p>}
        {(mode === "forgot" || passwordMode) && <a className="auth-back" href="#login">{c.back}</a>}
        <p className="auth-privacy"><ShieldCheck size={16} />{c.privacy}</p>
      </>}
      <a className="auth-home" href="#top">{c.home}</a>
    </section>
  </main>;
}

export function MfaPanel({ lang, onVerified }: { lang: Language; onVerified?: () => void }) {
  const c = copy[lang];
  const auth = useAuth();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const currentUserId = useRef(auth.user?.id);
  currentUserId.current = auth.user?.id;
  useEffect(() => {
    let active = true;
    setFactorId(""); setQr(""); setSecret(""); setCode(""); setError(""); setBusy(false);
    if (!supabase || !auth.user) { setLoading(false); return; }
    setLoading(true);
    supabase.auth.mfa.listFactors().then(({ data, error: resultError }) => {
      if (!active) return;
      if (resultError) setError(resultError.message);
      else setFactorId(data.totp.find(factor => factor.status === "verified")?.id || "");
    }).catch(err => { if (active) setError(messageOf(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.user?.id, retry]);

  const enroll = async () => {
    if (!supabase || busy) return;
    const requestUserId = currentUserId.current;
    setBusy(true); setError("");
    try {
      // Check again in case a second tab just finished enrolling this account.
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (requestUserId !== currentUserId.current) return;
      if (factorError) throw factorError;
      const verified = factors.totp.find(factor => factor.status === "verified");
      if (verified) { setFactorId(verified.id); return; }
      for (const factor of factors.all.filter(item => item.status === "unverified" && item.factor_type === "totp" && item.friendly_name === "Propriété En Vente administration")) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (requestUserId !== currentUserId.current) return;
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Propriété En Vente administration" });
      if (requestUserId !== currentUserId.current) return;
      if (enrollError) throw enrollError;
      setFactorId(data.id);
      setQr(data.totp.qr_code.startsWith("data:image/") ? data.totp.qr_code : "");
      setSecret(data.totp.secret);
    } catch (err) { if (requestUserId === currentUserId.current) setError(messageOf(err)); }
    finally { if (requestUserId === currentUserId.current) setBusy(false); }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !factorId || busy) return;
    const requestUserId = currentUserId.current;
    setBusy(true); setError("");
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (requestUserId !== currentUserId.current) return;
      if (verifyError) throw verifyError;
      setQr(""); setSecret(""); setCode("");
      await auth.refreshAuth();
      onVerified?.();
    } catch (err) { if (requestUserId === currentUserId.current) setError(messageOf(err)); }
    finally { if (requestUserId === currentUserId.current) setBusy(false); }
  };
  return <section className="auth-card mfa-card" aria-labelledby="mfa-title">
    <div className="auth-symbol"><ShieldCheck size={26} /></div>
    <h2 id="mfa-title">{c.mfaTitle}</h2><p className="auth-subtitle">{c.mfaText}</p>
    {!backendConfigured ? <div className="auth-notice">{c.unavailableText}</div>
    : !auth.user ? <a href="#login">{c.needLogin}</a>
    : auth.aal === "aal2" ? <div className="auth-notice" role="status">{c.mfaComplete}</div>
    : loading ? <p role="status">{c.busy}</p>
    : <>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {factorId ? <form onSubmit={verify} className="auth-form">
        <p>{secret ? c.mfaScan : c.mfaExisting}</p>
        {qr && <img className="mfa-qr" src={qr} alt={c.mfaSetup} />}
        {secret && <details className="mfa-secret"><summary>{c.mfaSecret}</summary><code>{secret}</code></details>}
        <label>{c.mfaCode}<input name="totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={busy} /></label>
        <button type="submit" className="auth-primary" disabled={busy}>{busy ? c.busy : c.mfaVerify}<ArrowRight size={18} /></button>
      </form> : <button className="auth-primary" type="button" disabled={busy} onClick={() => { void enroll(); }}>{busy ? c.busy : c.mfaSetup}</button>}
      {error && !factorId && <button className="auth-text-button" type="button" onClick={() => setRetry(value => value + 1)}>{c.retry}</button>}
    </>}
  </section>;
}
