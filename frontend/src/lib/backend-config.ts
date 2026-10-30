// Kept apart from the Supabase SDK so the first page render does not have to download it.
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

export function authCallbackUrl(): string {
  return `${window.location.origin}/#auth/callback`;
}
