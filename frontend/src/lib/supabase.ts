import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export function validPublicConfig(projectUrl?: string, publicKey?: string): boolean {
  if (!projectUrl || !publicKey) return false;
  try {
    const parsed = new URL(projectUrl);
    const validUrl = !parsed.username && !parsed.password && (parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)));
    if (!validUrl) return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)) return true;
    // Older projects use a JWT anon key. This is only a configuration guard;
    // authorization is still verified by Supabase, never by this decoded claim.
    const parts = publicKey.split(".");
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
    return typeof claims === "object" && claims !== null && "role" in claims && claims.role === "anon";
  } catch {
    return false;
  }
}

export const backendConfigured = validPublicConfig(url, key);
export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, key!, {
      auth: {
        // Client-only email links may open in another browser. Supabase verifies
        // the email before issuing the fragment session; AuthProvider consumes it.
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,
        // AuthProvider subscribes first, then exchanges callbacks explicitly so
        // PASSWORD_RECOVERY cannot be lost during the client's initialization.
        detectSessionInUrl: false,
      },
    })
  : null;

// Validate destructive-action confirmation without replacing the active MFA session.
export async function verifyAccountPassword(email: string, password: string): Promise<boolean> {
  if (!backendConfigured || !url || !key) return false;
  const verifier = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  return !error && data.user?.email?.toLowerCase() === email.toLowerCase();
}

export function authCallbackUrl(): string {
  return `${window.location.origin}${window.location.pathname}#auth/callback`;
}
