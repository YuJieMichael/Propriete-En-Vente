// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const mock = vi.hoisted(() => ({
  configured: true,
  session: null as Session | null,
  callbacks: new Set<(event: string, session: Session | null) => void>(),
  rpc: vi.fn(), getSession: vi.fn(), signOut: vi.fn(), assurance: vi.fn(),
  factors: vi.fn(), enroll: vi.fn(), verify: vi.fn(), exchange: vi.fn(), setSession: vi.fn(),
  signUp: vi.fn(), resend: vi.fn(), signIn: vi.fn(), resetPassword: vi.fn(), updateUser: vi.fn(),
  invoke: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  get backendConfigured() { return mock.configured; },
  get supabase() { return mock.configured ? {
    rpc: mock.rpc,
    functions: { invoke: mock.invoke },
    auth: {
      getSession: mock.getSession, signOut: mock.signOut,
      getUser: mock.getUser,
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        mock.callbacks.add(callback);
        return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } };
      },
      exchangeCodeForSession: mock.exchange, setSession: mock.setSession,
      signUp: mock.signUp, resend: mock.resend, signInWithPassword: mock.signIn,
      resetPasswordForEmail: mock.resetPassword, updateUser: mock.updateUser,
      mfa: { getAuthenticatorAssuranceLevel: mock.assurance, listFactors: mock.factors, enroll: mock.enroll, challengeAndVerify: mock.verify },
    },
  } : null; },
  authCallbackUrl: () => "http://localhost/#auth/callback",
}));
import { AuthPage, AuthProvider, MfaPanel, useAuth } from "../src/auth";
import { AdminPage } from "../src/admin";
import { AdminEmailPanel } from "../src/admin-email";

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useAuth>;
function Probe() { state = useAuth(); return null; }
function session(id: string): Session {
  return { user: { id, email: `${id}@example.test` }, access_token: `token-${id}`, refresh_token: `refresh-${id}`, token_type: "bearer", expires_in: 3600 } as Session;
}
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 12)); }); }
async function emit(event: string, next: Session | null) {
  await act(async () => { mock.session = next; for (const callback of mock.callbacks) callback(event, next); });
  await flush();
}
async function render(child = <AuthPage lang="en" />, strict = false) {
  const app = <AuthProvider><Probe />{child}</AuthProvider>;
  await act(async () => root.render(strict ? <StrictMode>{app}</StrictMode> : app));
  await flush();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  sessionStorage.clear();
  mock.signIn.mockReset();
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mock.resend.mockResolvedValue({ error: null });
  mock.resetPassword.mockReset().mockResolvedValue({ error: null });
  mock.updateUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  mock.exchange.mockReset(); mock.setSession.mockReset(); mock.enroll.mockReset(); mock.verify.mockReset();
  mock.callbacks.clear(); mock.session = null; mock.configured = true;
  mock.rpc.mockResolvedValue({ data: null, error: null });
  mock.invoke.mockReset();
  mock.getUser.mockResolvedValue({data:{user:null},error:null});
  mock.getSession.mockImplementation(async () => ({ data: { session: mock.session }, error: null }));
  mock.assurance.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.factors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
  window.history.replaceState(null, "", "/#login");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("password reset", () => {
  async function fill(name: string, value: string) {
    const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await flush();
  }
  async function recoveryForm() {
    window.history.replaceState(null, "", "/#reset-password");
    await render();
    await emit("PASSWORD_RECOVERY", session("reset-user"));
    await fill("password", "new-test-password-2026");
    await fill("password-confirm", "new-test-password-2026");
  }

  it("preserves the login email and sends one reset request with a cooldown", async () => {
    await render();
    await fill("email", "seller@example.test");
    await act(async () => {
      window.history.replaceState(null, "", "/#forgot-password");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe("seller@example.test");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    await submit();
    expect(mock.resetPassword).toHaveBeenCalledWith("seller@example.test", { redirectTo: "http://localhost/#auth/callback" });
    expect(container.textContent).toContain("Check your email");
    expect(container.textContent).toContain("spam folder");
    const resend = container.querySelector<HTMLButtonElement>("button.auth-primary")!;
    expect(resend.disabled).toBe(true);
    await act(async () => resend.click());
    expect(mock.resetPassword).toHaveBeenCalledTimes(1);
  });

  it("keeps the email editable and does not claim success when sending fails", async () => {
    window.history.replaceState(null, "", "/#forgot-password");
    mock.resetPassword.mockResolvedValue({ error: { message: "SMTP unavailable" } });
    await render();
    await fill("email", "seller@example.test");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn’t send");
    expect(container.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe("seller@example.test");
    expect(container.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(false);
    expect(container.textContent).not.toContain("SMTP");
  });

  it("shows a localized cooldown when the email service rate-limits requests", async () => {
    window.history.replaceState(null, "", "/#forgot-password");
    mock.resetPassword.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });
    await render(<AuthPage lang="zh" />);
    await fill("email", "seller@example.test");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("等待一分钟");
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it("requires matching passwords before calling the password update API", async () => {
    await recoveryForm();
    await fill("password-confirm", "different-password-2026");
    await submit();
    expect(mock.updateUser).not.toHaveBeenCalled();
    expect(container.textContent).toContain("passwords do not match");
  });

  it("confirms a successful password change and clears recovery access", async () => {
    await recoveryForm();
    await submit();
    expect(mock.updateUser).toHaveBeenCalledWith({ password: "new-test-password-2026" });
    expect(container.textContent).toContain("Your password has been updated");
    expect(container.querySelector('a[href="#dashboard"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(state.recoverySession).toBe(false);
  });

  it("keeps recovery access available when saving the new password fails", async () => {
    mock.updateUser.mockResolvedValue({ error: { message: "Choose a different password" } });
    await recoveryForm();
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Choose a different password");
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(state.recoverySession).toBe(true);
    expect(container.textContent).not.toContain("Your password has been updated");
  });
});

describe("authentication boundaries", () => {
  it('accepts tokens appended after the callback hash route and removes credentials from the URL',async()=>{
    const confirmed=session('nested-confirmed');
    mock.setSession.mockImplementation(async()=>{mock.session=confirmed;return {data:{session:confirmed},error:null};});
    window.history.replaceState(null,'','/#auth/callback#access_token=nested-test-token&refresh_token=nested-test-refresh&type=signup');
    await render(undefined,true);
    expect(mock.setSession).toHaveBeenCalledTimes(1);
    expect(mock.setSession).toHaveBeenCalledWith({access_token:'nested-test-token',refresh_token:'nested-test-refresh'});
    expect(window.location.hash).toBe('#dashboard');
    expect(window.location.href).not.toContain('nested-test');
  });
  it('keeps a nested recovery callback on the password reset route',async()=>{
    const recovered=session('nested-recovery');
    mock.setSession.mockResolvedValue({data:{session:recovered},error:null});
    window.history.replaceState(null,'','/#auth/callback#access_token=recovery-test-token&refresh_token=recovery-test-refresh&type=recovery');
    await render();
    expect(window.location.hash).toBe('#reset-password');expect(state.recoverySession).toBe(true);
  });
  async function waitingSignIn() {
    window.history.replaceState(null, '', '/#register');
    sessionStorage.setItem('propriete-en-vente.pending-signup', JSON.stringify({email: 'waiting@example.test', at: Date.now()}));
    await render();
    const field = container.querySelector<HTMLInputElement>('input[name=password]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, 'test-only-password');
      field.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    await flush();
  }
  it('signs in after confirmation in another browser without a pre-existing local session', async () => {
    const verified = session('waiting');
    verified.user.email_confirmed_at = new Date().toISOString();
    mock.signIn.mockImplementation(async () => {
      mock.session = verified;
      for (const callback of mock.callbacks) callback('SIGNED_IN', verified);
      return {data: {session: verified}, error: null};
    });
    await waitingSignIn();
    expect(mock.signIn).toHaveBeenCalledWith({email: 'waiting@example.test', password: 'test-only-password'});
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('#dashboard');
    expect(state.user?.id).toBe('waiting');
    expect(sessionStorage.getItem('propriete-en-vente.pending-signup')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name=password]')?.value ?? '').toBe('');
  });
  it('keeps an unconfirmed account on the waiting screen with a resend option', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mock.signIn.mockResolvedValue({data: {session: null}, error: {code: 'email_not_confirmed', message: 'Email not confirmed'}});
    try {
      await waitingSignIn();
      expect(window.location.hash).toBe('#register');
      expect(container.querySelector('[role=alert]')?.textContent).toContain('Your email has not been confirmed');
      expect(alert).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('Resend confirmation email');
      expect(container.querySelector<HTMLInputElement>('input[name=password]')!.value).toBe('');
      expect(state.user).toBeNull();
    } finally { alert.mockRestore(); }
  });
  it.each(['Invalid login credentials', 'Network request failed'])('does not describe %s as an unconfirmed email', async message => {
    mock.signIn.mockRejectedValue(new Error(message));
    await waitingSignIn();
    expect(window.location.hash).toBe('#register');
    expect(container.querySelector('[role=alert]')?.textContent).toBe(message);
    expect(container.textContent).not.toContain('Your email has not been confirmed');
    expect(sessionStorage.getItem('propriete-en-vente.pending-signup')).not.toContain('test-only-password');
    expect(container.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(false);
  });
  it('clears the waiting password when changing the registration email', async () => {
    mock.signIn.mockResolvedValue({data: {session: null}, error: {message: 'Invalid login credentials'}});
    await waitingSignIn();
    const change = [...container.querySelectorAll('button')].find(button => button.textContent === 'Change email address')!;
    await act(async () => change.click());
    expect(container.querySelector<HTMLInputElement>('input[name=password]')!.value).toBe('');
    expect(container.querySelector('input[name=password-confirm]')).not.toBeNull();
    expect(sessionStorage.getItem('propriete-en-vente.pending-signup')).toBeNull();
  });
  it('requires a server session before leaving the waiting screen', async () => {
    mock.signIn.mockResolvedValue({data: {session: null}, error: null});
    await waitingSignIn();
    expect(window.location.hash).toBe('#register');
    expect(container.querySelector('[role=alert]')).not.toBeNull();
    expect(sessionStorage.getItem('propriete-en-vente.pending-signup')).toContain('waiting@example.test');
  });
  it('uses email verification without QR codes and only opens access after server approval', async () => {
    mock.session=session('owner');
    let approved=false;
    mock.rpc.mockImplementation(async name=>({data:name==='get_my_staff_role'?'owner':approved,error:null}));
    mock.invoke.mockImplementation(async (_name,{body})=>body.action==='send'
      ? {data:{ok:true,challengeId:'challenge'},error:null}
      : {data:{ok:false,error:'invalid_code'},error:null});
    await render(<AdminEmailPanel lang="en"/>);
    expect(container.querySelector('img')).toBeNull();
    expect(state.adminVerified).toBe(false);
    await act(async()=>container.querySelector<HTMLButtonElement>('button')!.click());
    expect(container.textContent).toContain('Email sent');
    expect(mock.invoke.mock.calls[0][1].body).toEqual({action:'send',language:'en'});
    await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(state.adminVerified).toBe(false);
    expect(container.textContent).toContain('incorrect, expired');
    approved=true;
    mock.invoke.mockResolvedValue({data:{ok:true},error:null});
    await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(state.adminVerified).toBe(true);
    await emit('SIGNED_OUT',null);
    expect(state.adminVerified).toBe(false);
  });
  it('does not claim an email was sent when the provider is unconfigured',async()=>{
    mock.session=session('owner');
    mock.rpc.mockImplementation(async name=>({data:name==='get_my_staff_role'?'owner':false,error:null}));
    mock.invoke.mockResolvedValue({data:null,error:{context:{json:async()=>({error:'email_not_configured'})}}});
    await render(<AdminEmailPanel lang="en"/>);
    await act(async()=>container.querySelector<HTMLButtonElement>('button')!.click());
    expect(container.textContent).toContain('not configured yet');
    expect(container.querySelector('input[name=email-code]')).toBeNull();
    expect(state.adminVerified).toBe(false);
  });
  it("replaces successful signup with a waiting screen and advances only for the matching verified session", async () => {
    window.history.replaceState(null, "", "/#register");
    await render();
    const input = async (name: string, value: string) => {
      const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await input("email", "waiting@example.test");
    await input("password", "test-only-password");
    await input("password-confirm", "test-only-password");
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await flush();
    expect(mock.signUp).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Confirm your email address");
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[type=password]')!.value).toBe('');
    expect(sessionStorage.getItem("propriete-en-vente.pending-signup")).not.toContain("test-only-password");
    await emit("SIGNED_IN", session("waiting"));
    expect(window.location.hash).toBe("#register");
    const verified = session("waiting"); verified.user.email_confirmed_at = new Date().toISOString();
    await emit("SIGNED_IN", verified);
    expect(window.location.hash).toBe("#dashboard");
    expect(sessionStorage.getItem("propriete-en-vente.pending-signup")).toBeNull();
  });

  it("restores the waiting screen after refresh and does not report a failed resend as sent", async () => {
    sessionStorage.setItem("propriete-en-vente.pending-signup", JSON.stringify({ email: "waiting@example.test", at: Date.now() }));
    window.history.replaceState(null, "", "/#register");
    mock.resend.mockResolvedValue({ error: { message: "Email rate limit exceeded" } });
    await render();
    const button = [...container.querySelectorAll('button')].find(el => el.textContent?.includes("Resend confirmation"))!;
    await act(async () => button.click()); await flush();
    expect(mock.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "waiting@example.test" }));
    expect(container.textContent).toContain("Email rate limit exceeded");
    expect(container.textContent).not.toContain("Request sent.");
    expect(button.disabled).toBe(true);
  });

  it("consumes a confirmed email session in a fresh browser without a PKCE exchange", async () => {
    const confirmed = session("confirmed-link"); confirmed.user.email_confirmed_at = new Date().toISOString();
    mock.setSession.mockImplementation(async () => {
      mock.session = confirmed;
      for (const callback of mock.callbacks) callback("SIGNED_IN", confirmed);
      return { data: { session: confirmed }, error: null };
    });
    window.history.replaceState(null, "", "/#access_token=confirmation-token&refresh_token=confirmation-refresh&type=signup");
    await render(<AuthPage lang="en" />, true);
    expect(mock.setSession).toHaveBeenCalledTimes(1);
    expect(mock.exchange).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#dashboard");
    expect(window.location.href).not.toContain("confirmation-token");
    expect(state.recoverySession).toBe(false);
    expect(state.invitationSession).toBe(false);
  });

  it("shows an honest unavailable state without backend settings", async () => {
    mock.configured = false;
    await render();
    expect(container.textContent).toContain("Sign-in has not been configured yet");
    expect(container.querySelector("form")).toBeNull();
    expect(state.user).toBeNull();
  });

  it("does not allow a normal signed-in session to masquerade as password recovery", async () => {
    mock.session = session("seller");
    window.history.replaceState(null, "", "/#reset-password");
    await render();
    expect(container.textContent).toContain("This link is invalid or has expired");
    expect(container.querySelector("input[type=password]")).toBeNull();
  });

  it("requires a real recovery event and preserves it through same-user tab-focus events", async () => {
    const seller = session("seller");
    window.history.replaceState(null, "", "/#reset-password");
    await render();
    await emit("PASSWORD_RECOVERY", seller);
    expect(container.querySelectorAll("input[type=password]")).toHaveLength(2);
    await emit("SIGNED_IN", seller);
    expect(state.recoverySession).toBe(true);
    await emit("SIGNED_IN", session("another-seller"));
    expect(state.recoverySession).toBe(false);
    expect(container.querySelector("input[type=password]")).toBeNull();
  });

  it("discards late administrator permissions after an account switch", async () => {
    let resolveOld!: (value: { data: string; error: null }) => void;
    mock.session = session("owner");
    mock.rpc.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    await render();
    await emit("SIGNED_IN", session("seller"));
    await act(async () => resolveOld({ data: "owner", error: null }));
    await flush();
    expect(state.user?.id).toBe("seller");
    expect(state.staffRole).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("fails closed and reports a permissions service error", async () => {
    mock.session = session("owner");
    mock.rpc.mockResolvedValue({ data: null, error: { message: "Permissions unavailable" } });
    await render();
    expect(state.staffRole).toBeNull();
    expect(state.error).toBe("Permissions unavailable");
  });

  it("shows a retryable administrator permission error instead of a no-access verdict", async () => {
    mock.session = session("owner");
    mock.rpc.mockResolvedValue({ data: null, error: { message: "Permissions unavailable" } });
    await render(<AdminPage lang="en" />);
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    expect(container.textContent).not.toContain("This account is not an active staff account");
    const retry = container.querySelector<HTMLButtonElement>("button");
    expect(retry?.textContent).toContain("Refresh");
    mock.rpc.mockResolvedValue({ data: "owner", error: null });
    await act(async () => retry!.click());
    await flush();
    expect(state.error).toBeNull();
    expect(container.textContent).toContain("Verify your administrator access");
  });

  it("does not claim a successful logout when the server rejects it", async () => {
    mock.session = session("seller");
    mock.signOut.mockResolvedValue({ error: { message: "Sign-out failed" } });
    await render();
    await act(async () => { await expect(state.signOut()).rejects.toMatchObject({ message: "Sign-out failed" }); });
    expect(state.user?.id).toBe("seller");
    expect(state.error).toBe("Sign-out failed");
  });

  it("exchanges a PKCE callback once under StrictMode and removes its code from the URL", async () => {
    const seller = session("recovered");
    mock.exchange.mockImplementation(async () => {
      mock.session = seller;
      for (const callback of mock.callbacks) callback("PASSWORD_RECOVERY", seller);
      return { data: { session: seller }, error: null };
    });
    window.history.replaceState(null, "", "/?code=single-use-test-code#auth/callback");
    await render(<AuthPage lang="en" />, true);
    expect(mock.exchange).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#reset-password");
    expect(state.recoverySession).toBe(true);
  });

  it("reuses an existing verified MFA factor and never enrolls automatically", async () => {
    mock.session = session("owner");
    mock.rpc.mockResolvedValue({ data: "owner", error: null });
    mock.factors.mockResolvedValue({ data: { totp: [{ id: "existing", status: "verified" }], all: [] }, error: null });
    await render(<MfaPanel lang="en" />);
    expect(container.querySelector("input[name=totp]")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(mock.enroll).not.toHaveBeenCalled();
  });

  it("sends a normal confirmation callback to the dashboard without enabling password recovery", async () => {
    const seller = session("confirmed");
    mock.exchange.mockImplementation(async () => {
      mock.session = seller;
      for (const callback of mock.callbacks) callback("SIGNED_IN", seller);
      return { data: { session: seller }, error: null };
    });
    window.history.replaceState(null, "", "/?code=confirmation-code#auth/callback");
    await render();
    expect(window.location.hash).toBe("#dashboard");
    expect(state.recoverySession).toBe(false);
  });

  it("validates invitation tokens and opens the separate password-setup route", async () => {
    const staff = session("invited-staff");
    mock.setSession.mockImplementation(async () => {
      mock.session = staff;
      for (const callback of mock.callbacks) callback("SIGNED_IN", staff);
      return { data: { session: staff }, error: null };
    });
    window.history.replaceState(null, "", "/#access_token=invite-token&refresh_token=invite-refresh&type=invite");
    await render();
    expect(mock.setSession).toHaveBeenCalledWith({ access_token: "invite-token", refresh_token: "invite-refresh" });
    expect(window.location.hash).toBe("#set-password");
    expect(state.invitationSession).toBe(true);
    expect(state.recoverySession).toBe(false);
    expect(container.querySelectorAll("input[type=password]")).toHaveLength(2);
  });

  it("rejects invalid invitation tokens and removes them from the address", async () => {
    mock.setSession.mockResolvedValue({ data: { session: null }, error: { message: "Invalid token" } });
    window.history.replaceState(null, "", "/#access_token=invalid-token&refresh_token=invalid-refresh&type=invite");
    await render();
    expect(window.location.hash).toBe("#auth/callback");
    expect(state.invitationSession).toBe(false);
    expect(state.user).toBeNull();
    expect(state.callbackError).toBe("Invalid token");
  });

  it("offers safe recovery after a missing PKCE verifier without granting access or showing SDK internals", async () => {
    mock.exchange.mockResolvedValue({ data: { session: null }, error: { message: "PKCE code verifier not found in storage. Use @supabase/ssr." } });
    window.history.replaceState(null, "", "/?code=missing-verifier-test#auth/callback");
    await render(<AuthPage lang="zh" />, true);
    expect(window.location.search).toBe("");
    expect(state.user).toBeNull();
    expect(state.recoverySession).toBe(false);
    expect(state.invitationSession).toBe(false);
    expect(container.textContent).toContain("链接登录未完成");
    expect(container.textContent).toContain("同一个浏览器");
    expect(container.textContent).not.toContain("PKCE");
    expect(container.textContent).not.toContain("@supabase/ssr");
    expect(container.querySelector('a[href="#login"]')).not.toBeNull();
    expect(container.querySelector('a[href="#forgot-password"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
});
