import test from "node:test";
import assert from "node:assert/strict";
import { appointmentConfig, appointmentInput, readSmallJson } from "./invitation.ts";
import { createStaffAppointmentHandler } from "./invite-handler.ts";

test("appointment origin is server-controlled and rejects unsafe configuration", () => {
  assert.deepEqual(appointmentConfig("https://example.com/propriete-en-vente"), {
    origin: "https://example.com",
  });
  assert.deepEqual(appointmentConfig("http://127.0.0.1:5173"), {
    origin: "http://127.0.0.1:5173",
  });
  for (const value of [
    undefined,
    "http://example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/?redirect=evil",
    "https://example.com/#admin",
  ]) assert.throws(() => appointmentConfig(value));
});

test("appointment input accepts only a valid registered-account email", () => {
  assert.deepEqual(appointmentInput({ email: " Team@Example.com " }), {
    email: "team@example.com",
  });
  for (const value of [
    null,
    [],
    { email: "a@example.com", role: "owner" },
    { email: "a@example.com", redirectTo: "https://evil.com" },
    { email: "no-email" },
    { email: "a@example.com\nBcc:x@evil.com" },
    { email: "a".repeat(255) + "@example.com" },
  ]) assert.equal(appointmentInput(value), null);
});

test("JSON body parser enforces size and content type", async () => {
  await assert.rejects(readSmallJson(new Request("https://api.example.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "x".repeat(5000) }),
  })));
  await assert.rejects(readSmallJson(new Request("https://api.example.com", {
    method: "POST", body: "{}",
  })));
  assert.deepEqual(await readSmallJson(new Request("https://api.example.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: '{"email":"staff@example.com"}',
  })), { email: "staff@example.com" });
});

type Scenario = {
  emailSession?: boolean;
  aal?: string;
  role?: string;
  active?: boolean;
  verified?: boolean;
  identityError?: boolean;
  claimError?: boolean;
  claimUser?: string;
  assignmentCode?: string;
};
function scenario(options: Scenario = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const fake = {
    auth: {
      getUser: async (token: string) => {
        calls.push({ name: "getUser", args: [token] });
        return { data: { user: options.identityError ? null : {
          id: "owner-id", email: "owner@example.com",
          email_confirmed_at: options.verified === false ? null : "2026-01-01",
        } }, error: options.identityError ? new Error("untrusted") : null };
      },
      getClaims: async (token: string) => {
        calls.push({ name: "getClaims", args: [token] });
        return { data: { claims: {
          sub: options.claimUser || "owner-id", aal: options.aal || "aal2",
          session_id: "00000000-0000-4000-8000-000000000001",
        } }, error: options.claimError ? new Error("bad signature") : null };
      },
      admin: {},
    },
    from: (name: string) => {
      calls.push({ name: "from", args: [name] });
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { role: options.role || "owner", active: options.active !== false }, error: null,
      }) }) }) };
    },
    rpc: async (...args: unknown[]) => {
      calls.push({ name: "rpc", args });
      if (args[0] === "check_staff_email_session") return { data: options.emailSession === true, error: null };
      return { error: options.assignmentCode ? { code: options.assignmentCode, message: "PRIVATE DATABASE ERROR" } : null };
    },
  };
  const runtime: Parameters<typeof createStaffAppointmentHandler>[0] = {
    env: (name) => ({
      APP_ORIGIN: "https://example.com/propriete-en-vente/",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "private-test-key",
    })[name],
    createClient: () => fake as unknown as ReturnType<Parameters<typeof createStaffAppointmentHandler>[0]["createClient"]>,
    log: () => {},
  };
  return { handler: createStaffAppointmentHandler(runtime), calls };
}
function request(body: unknown = { email: "staff@example.com" }, headers: Record<string, string> = {}) {
  return new Request("https://project.supabase.co/functions/v1/invite-staff", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Origin: "https://example.com",
      Authorization: "Bearer signed-token", ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("verified platform owner appoints a registered account through the atomic RPC", async () => {
  const { handler, calls } = scenario();
  const result = await handler(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(result.headers.get("Access-Control-Allow-Origin"), "https://example.com");
  assert.deepEqual(calls.find((call) => call.name === "rpc")?.args, [
    "appoint_existing_staff", { p_actor_id: "owner-id", p_email: "staff@example.com" },
  ]);
  assert.equal(calls.some((call) => call.name === "invite"), false);
});

test("a confirmed active owner can appoint with password-only authentication", async () => {
  const {handler,calls}=scenario({aal:"aal1",emailSession:false});
  assert.equal((await handler(request())).status,200);
  assert.equal(calls.some(call=>call.name==="rpc"&&call.args[0]==="check_staff_email_session"),false);
});

for (const [label, options] of Object.entries({
  "operator role": { role: "operator" }, "inactive owner": { active: false },
  "unconfirmed email": { verified: false },
  "invalid identity": { identityError: true }, "forged aal2 claims": { claimError: true },
  "mismatched claim identity": { claimUser: "another-user" },
})) test(`${label} cannot appoint staff`, async () => {
  const { handler, calls } = scenario(options);
  assert.ok([401, 403].includes((await handler(request())).status));
  assert.equal(calls.some((call) => call.name === "rpc" && call.args[0] === "appoint_existing_staff"), false);
});

test("unknown origins and missing bearer authentication are rejected before staff operations", async () => {
  for (const headers of [{ Origin: "https://evil.example" }, { Authorization: "" }]) {
    const { handler, calls } = scenario();
    assert.ok([401, 403].includes((await handler(request(undefined, headers))).status));
    assert.equal(calls.length, 0);
  }
});

test("the endpoint accepts no role override or caller-controlled redirect", async () => {
  for (const body of [
    { email: "staff@example.com", role: "owner" },
    { email: "staff@example.com", redirectTo: "https://evil.example" },
  ]) {
    const { handler, calls } = scenario();
    assert.equal((await handler(request(body))).status, 400);
    assert.equal(calls.some((call) => call.name === "rpc"), false);
  }
});

test("unregistered accounts and existing staff receive safe, specific errors", async () => {
  for (const [code, expected] of [["P0002", "account_not_found"], ["23505", "already_staff"]]) {
    const { handler } = scenario({ assignmentCode: code });
    const result = await handler(request());
    assert.equal(result.status, code === "P0002" ? 404 : 409);
    const payload = await result.json();
    assert.equal(payload.error, expected);
    assert.equal(typeof payload.requestId, "string");
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE|private-test-key/);
  }
});

test("unexpected database errors stay private", async () => {
  const { handler } = scenario({ assignmentCode: "XX000" });
  const result = await handler(request());
  assert.equal(result.status, 409);
  assert.doesNotMatch(await result.text(), /PRIVATE|XX000|private-test-key/);
});

test("preflight is CORS-only and GET cannot appoint staff", async () => {
  const { handler, calls } = scenario();
  assert.equal((await handler(new Request("https://api.example.com", {
    method: "OPTIONS", headers: { Origin: "https://example.com" },
  }))).status, 204);
  assert.equal((await handler(new Request("https://api.example.com", {
    headers: { Origin: "https://example.com" },
  }))).status, 405);
  assert.equal(calls.length, 0);
});
