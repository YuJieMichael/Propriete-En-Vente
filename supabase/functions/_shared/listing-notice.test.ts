import test from 'node:test';
import assert from 'node:assert/strict';
import { createListingNoticeHandler } from './listing-notice-handler.ts';
import { noticeEmail, parseNotice } from './listing-notice.ts';

const queued = [
  { id: '00000000-0000-4000-8000-000000000720', kind: 'reminder', reference: 100050, title: 'Maison Brossard', expiresAt: '2026-12-09T15:00:00.123456+00:00', email: 'owner@example.test', name: 'Owner' },
  { id: '00000000-0000-4000-8000-000000000721', kind: 'expired', reference: 100051, title: 'Condo', expiresAt: '2026-11-08T15:00:00+00:00', email: 'other@example.test', name: 'Other' },
];

function setup(options: { token?: string; delivery?: boolean; configured?: boolean } = {}) {
  const calls: { name: string; args: any }[] = [];
  const db = { rpc: async (name: string, args: any) => { calls.push({ name, args }); return name === 'claim_listing_notices' ? { data: queued, error: null } : { data: null, error: null }; } };
  const handler = createListingNoticeHandler({
    env: name => ({ ENQUIRY_CRON_TOKEN: 'cron', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: options.configured === false ? undefined : 'r', ENQUIRY_EMAIL_FROM: 'site@example.test' } as Record<string, string | undefined>)[name],
    createClient: () => db as any,
    fetch: async (_url, init) => { calls.push({ name: 'send', args: { body: JSON.parse(init!.body as string), headers: init!.headers } }); return Response.json({ id: 'm' }, { status: options.delivery === false ? 503 : 200 }); },
  });
  const run = () => handler(new Request('https://x.test', { method: 'POST', headers: { authorization: `Bearer ${options.token ?? 'cron'}` } }));
  return { run, calls };
}

test('rejects calls without the cron token', async () => {
  const s = setup({ token: 'wrong' });
  assert.equal((await s.run()).status, 401);
  assert.equal(s.calls.length, 0);
});

test('sends each notice to the listing owner, then marks it sent', async () => {
  const s = setup();
  const response = await s.run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, sent: 2, failed: 0 });
  const sends = s.calls.filter(c => c.name === 'send');
  assert.deepEqual(sends.map(c => c.args.body.to[0]), ['owner@example.test', 'other@example.test']);
  assert.equal(sends[0].args.body.reply_to, 'achat.vente.garderie@gmail.com');
  assert.match(sends[0].args.headers['Idempotency-Key'], /^listing-notice\/00000000-0000-4000-8000-000000000720\/reminder\/\d+$/);
  const done = s.calls.filter(c => c.name === 'complete_listing_notice');
  assert.deepEqual(done.map(c => c.args.p_kind), ['reminder', 'expired']);
  assert.equal(done[0].args.p_expires_at, queued[0].expiresAt);
});

test('provider failure is not marked sent', async () => {
  const s = setup({ delivery: false });
  assert.equal((await s.run()).status, 503);
  assert.equal(s.calls.filter(c => c.name === 'complete_listing_notice').length, 0);
});

test('missing email configuration fails before reading the queue', async () => {
  const s = setup({ configured: false });
  assert.equal((await s.run()).status, 503);
  assert.equal(s.calls.length, 0);
});

test('emails are trilingual, say nothing is charged and give the renewal contact', () => {
  for (const raw of queued) {
    const mail = noticeEmail(parseNotice(raw));
    assert.match(mail.text, /Aucun paiement/);
    assert.match(mail.text, /Nothing (will be|was) charged/);
    assert.match(mail.text, /不会收取任何费用|没有收取任何费用/);
    assert.match(mail.text, /514-758-8358/);
    assert.match(mail.subject, new RegExp(`#${raw.reference}|已下架`));
  }
});

test('rejects malformed queue rows', () => {
  assert.throws(() => parseNotice({ ...queued[0], email: 'not-an-email' }));
  assert.throws(() => parseNotice({ ...queued[0], kind: 'other' }));
});
