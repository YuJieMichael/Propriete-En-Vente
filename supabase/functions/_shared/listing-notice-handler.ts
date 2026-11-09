import { noticeEmail, NOTICE_REPLY_TO, parseNotice } from './listing-notice.ts';

type Runtime = {
  env: (name: string) => string | undefined;
  createClient: (url: string, key: string, options: any) => any;
  fetch: typeof fetch;
};

// Sends free-listing reminder/expiry emails. Expiry itself runs in pg_cron SQL.
export function createListingNoticeHandler(runtime: Runtime) {
  return async (request: Request): Promise<Response> => {
    const token = runtime.env('ENQUIRY_CRON_TOKEN');
    if (!token || request.headers.get('authorization') !== `Bearer ${token}`) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405 });
    const key = runtime.env('RESEND_API_KEY'), from = runtime.env('ENQUIRY_EMAIL_FROM');
    if (!key || !from) return Response.json({ error: 'email_not_configured' }, { status: 503 });
    const db = runtime.createClient(runtime.env('SUPABASE_URL')!, runtime.env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await db.rpc('claim_listing_notices');
    if (error || !Array.isArray(data)) return Response.json({ error: 'queue_unavailable' }, { status: 503 });
    let sent = 0, failed = 0;
    for (const raw of data) {
      try {
        const notice = parseNotice(raw);
        const mail = noticeEmail(notice);
        const response = await runtime.fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
            'Idempotency-Key': `listing-notice/${notice.id}/${notice.kind}/${Date.parse(notice.expiresAt)}`,
          },
          body: JSON.stringify({ from, to: [notice.email], reply_to: NOTICE_REPLY_TO, subject: mail.subject, text: mail.text }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw Error('provider_error');
        const done = await db.rpc('complete_listing_notice', { p_id: notice.id, p_kind: notice.kind, p_expires_at: notice.expiresAt });
        if (done.error) throw done.error;
        sent++;
      } catch { failed++; }
    }
    return Response.json({ ok: failed === 0, sent, failed }, { status: failed ? 503 : 200 });
  };
}
