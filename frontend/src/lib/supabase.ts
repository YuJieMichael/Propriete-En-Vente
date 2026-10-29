import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { backendConfigured } from "./backend-config";

export { authCallbackUrl, backendConfigured, validPublicConfig } from "./backend-config";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

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
