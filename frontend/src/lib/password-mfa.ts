import type { SupabaseClient } from "@supabase/supabase-js";

// Read factors from the server: a recovery token may predate MFA enrollment.
export async function passwordMfa(client: SupabaseClient) {
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) throw factorError;
  const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  const verified = factors.all.filter(factor => factor.status === "verified");
  return {
    required: assurance.currentLevel !== "aal2" && (assurance.nextLevel === "aal2" || verified.length > 0),
    factors: factors.totp.filter(factor => factor.status === "verified"),
  };
}
