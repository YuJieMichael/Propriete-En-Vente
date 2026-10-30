import { createClient } from "npm:@supabase/supabase-js@2.117.0";
import { createStaffAppointmentHandler } from "../_shared/invite-handler.ts";

Deno.serve(
  createStaffAppointmentHandler({
    env: (name) => Deno.env.get(name),
    createClient: (url, secret) =>
      createClient(url, secret, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
    log: (event) => console.error(JSON.stringify(event)),
  }),
);
