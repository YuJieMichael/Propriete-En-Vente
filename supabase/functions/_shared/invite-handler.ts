import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.0";
import {
  appointmentConfig,
  appointmentInput,
  readSmallJson,
} from "./invitation.ts";

// The platform JWT gate is disabled for asymmetric signing-key compatibility.
// Both identity and cryptographically verified claims are checked below on EVERY request.
type Runtime = {
  env: (name: string) => string | undefined;
  createClient: (url: string, secret: string) => SupabaseClient;
  log: (event: { requestId: string; stage: string; code?: string }) => void;
};
export function createStaffAppointmentHandler(runtime: Runtime) {
  return async (request: Request) => {
    const requestId = crypto.randomUUID();
    let config: ReturnType<typeof appointmentConfig>;
    try {
      config = appointmentConfig(runtime.env("APP_ORIGIN"));
    } catch {
      return Response.json(
        { error: "service_unavailable", requestId },
        { status: 503 },
      );
    }
    const origin = request.headers.get("origin");
    const headers = {
      "Access-Control-Allow-Origin": config.origin,
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const respond = (status: number, error?: string) =>
      Response.json(error ? { error, requestId } : { ok: true }, {
        status,
        headers,
      });
    if (origin && origin !== config.origin) return respond(403, "forbidden");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return respond(405, "method_not_allowed");

    try {
      const url = runtime.env("SUPABASE_URL");
      const secret =
        runtime.env("SUPABASE_SERVICE_ROLE_KEY") ||
        runtime.env("SUPABASE_SECRET_KEY");
      if (!url || !secret) return respond(503, "service_unavailable");
      const authorization = request.headers.get("authorization");
      const match = authorization?.match(/^Bearer ([^\s]+)$/i);
      if (!match || match[1].length > 16384)
        return respond(401, "authentication_required");
      const token = match[1];
      const admin = runtime.createClient(url, secret);

      // getUser checks the user against Auth. getClaims verifies the JWT signature;
      // an unverified base64-decoded claim must never authorize staff operations.
      const [
        { data: userData, error: userError },
        { data: claimData, error: claimError },
      ] = await Promise.all([
        admin.auth.getUser(token),
        admin.auth.getClaims(token),
      ]);
      const user = userData.user;
      const claims = claimData?.claims;
      if (userError || claimError || !user || !claims || claims.sub !== user.id)
        return respond(401, "authentication_required");
      if (!user.email_confirmed_at)
        return respond(403, "forbidden");
      const { data: staff, error: staffError } = await admin
        .from("staff_members")
        .select("role,active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (staffError || !staff?.active || staff.role !== "owner")
        return respond(403, "forbidden");

      let input: ReturnType<typeof appointmentInput>;
      try {
        input = appointmentInput(await readSmallJson(request));
      } catch {
        return respond(400, "invalid_request");
      }
      if (!input || input.email === user.email?.trim().toLowerCase())
        return respond(400, "invalid_request");

      // The service-only RPC finds an existing Auth account by email, rechecks
      // the active owner, and atomically appoints an operator + writes an audit.
      // It never creates an Auth user or sends an email.
      const { error: assignmentError } = await admin.rpc(
        "appoint_existing_staff",
        {
          p_actor_id: user.id,
          p_email: input.email,
        },
      );
      if (assignmentError) {
        runtime.log({ requestId, stage: "appoint", code: assignmentError.code });
        if (assignmentError.code === "P0002") return respond(404, "account_not_found");
        if (assignmentError.code === "23505") return respond(409, "already_staff");
        if (assignmentError.code === "22023") return respond(400, "invalid_request");
        return respond(409, "appointment_not_completed");
      }
      return respond(200);
    } catch {
      runtime.log({ requestId, stage: "unexpected" });
      return respond(500, "invitation_not_completed");
    }
  };
}
