# Buyer / seller enquiries — pending activation

English: Public buyer and seller forms require name and email only. No login is needed. Contact information is private. The requested notification policy is one email per enquiry, processed in FIFO order with a one-minute scheduled check once activated. Each email contains one enquiry as a CSV and goes only to `achat.vente.garderie@gmail.com`. Provider acceptance is recorded separately from form collection; it does not prove Gmail inbox delivery. Notification activation is still pending as described below.

Français : Les formulaires d’achat et de vente exigent uniquement le nom et le courriel, sans connexion. Après activation, chaque demande déclenchera son propre courriel avec un fichier CSV, dans l’ordre d’arrivée. La tâche prévue vérifie la file chaque minute et traite une demande par exécution. La collecte et l’acceptation par le service de courriel sont distinctes. L’activation reste à terminer.

中文：买卖表单仅姓名、邮箱必填，不需要登录。用户已改为每条询盘单独通知一次：启用后每分钟检查队列，每次处理一条，并将该条 CSV 发到指定邮箱，不再等待凑满十条。队列积压时依次处理。表单保存成功不等于邮件已送达 Gmail；邮件通知仍待完成启用。

## Current status / État actuel / 当前状态

Verified 16 October 2026: `submit-enquiry` version 11 is deployed to `usngcexxobcpjncuwaxo`, including numeric public listing references and UUID references. The modern browser publishable key reaches validation: approved-origin malformed input returns 400. A numeric reference with a deliberately conflicting existing internal-test request ID reached the database's pre-write idempotency conflict. The enquiry count stayed at 8, its latest timestamp stayed 28 September 2026 16:39:45 UTC, and rate-limit state stayed unchanged. No fake lead was saved or email sent. RLS and private worker execution restrictions remain in force. This check does not claim a new successful save or Gmail delivery.

At that audit there were no email batches, no deployed `send-enquiry-batches`, no pg_cron/pg_net scheduler and no Vault cron token. Edge secret names and the current Resend sender were not independently verified. Sender/DNS setup is now in progress. The one-enquiry claim change in `supabase/enable-single-enquiry-notifications.sql`, updated worker and one-minute schedule are prepared source, not confirmation of production activation. Existing database logic continues to require ten enquiries until that SQL is applied. Collection and email delivery can be activated separately.

The follow-up queue audit found 5 active pending enquiries and 3 soft-deleted pending enquiries out of the 8 total. The worker excludes the 3 deleted entries. Do not force all 8 into notifications or restore entries merely to clear the backlog.

## Activation

1. Create Resend account, verify a sending domain/address, and store a sending API key as Supabase Edge Function secret `RESEND_API_KEY`. Never use a `VITE_` prefix for server secrets. The receiving Gmail address is not a sending-domain credential.
2. Migration 002 and later enquiry triage migrations are already applied. Do not replay historical migrations. Apply `supabase/enable-single-enquiry-notifications.sql` as the `single_enquiry_notifications` migration using the connected Supabase migration tool, then reconcile the generated migration history with source before any CLI `db push`. This pending file replaces only the claim function; it preserves existing rows, deleted-enquiry exclusion, leases and permissions.
3. Set Edge secrets `ENQUIRY_EMAIL_FROM` (verified sender), `ENQUIRY_RATE_SALT` (random secret), `ENQUIRY_CRON_TOKEN` (separate random secret), and `APP_ORIGIN` (actual website origin). Built-in Supabase service-role credentials stay server-side.
4. Deploy `submit-enquiry` and `send-enquiry-batches` using repository config. Public intake validates size, required fields, origin, honeypot and rate limits (5 per client/15 min; 1000 globally/day). Verify the hosting gateway's trusted client-IP forwarding before production; CORS is not an anti-bot guarantee. Consider CAPTCHA if abuse requires it.
5. Enable Supabase Cron/pg_net and Vault. Store the cron token in Vault as `enquiry_cron_token`, then run `supabase/schedule-enquiry-batches.sql`. It retains the named `propriete-enquiry-batches` job and checks once per minute. The worker requires this token, never the public browser key.
6. In a disposable/staging database verify that one enquiry becomes eligible immediately, a retry retains the same message ID, eight queued enquiries generate eight separate FIFO claims, and soft-deleted or already leased enquiries are not sent twice. Verify provider acceptance and the intended Gmail inbox separately. Do not populate production with fake leads. Existing non-deleted pending enquiries will be processed individually after activation; review the backlog before enabling the schedule.
7. Set `VITE_ENQUIRY_ENABLED=true`, rebuild and deploy the frontend. Configure a production origin before enabling real visitors. Publish finalized company/privacy contact details and decide retention before collecting real customer data.

The internal table/function names still say “batch”, but each new claim contains exactly one enquiry. The worker refuses a larger legacy claim rather than combining contacts. The audit found no existing batches requiring conversion. It uses atomic database claims, a 5-minute lease and stable provider idempotency keys. Failed attempts preserve their claim. After 23 hours of uncertain delivery a claim is marked `needs_review` rather than risking a duplicate after Resend's 24-hour idempotency window. Inspect provider records by claim ID; reconcile `provider_id`/`sent_at` before any manual retry. No personal information is logged by the handlers. Customer roles cannot read the inbox tables; only the server and database administrator can access them. CSV cells neutralize spreadsheet formulas and preserve UTF-8 Chinese/French.

References: [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Optional preferences

English: Hybrid sellers can select photography, video, listing presentation, price analysis, viewings and offer support, or choose unsure. Both buyer and seller forms offer contact language, method and availability. These remain optional and are included in validated enquiry payloads and CSV exports. The comparison describes proposed collaboration; scope and fees are agreed before commitment.

Français : Les vendeurs en mode collaboratif choisissent les aides souhaitées. Les préférences de langue, de contact et de disponibilité restent facultatives et sont incluses dans les fichiers CSV.

中文：协作卖房可多选所需帮助，也可选择暂时不确定。买卖表单均有联系语言、方式与方便联系时间，全部选填，并纳入各条询盘的 CSV。收集已启用，邮件发送仍待配置后启用。
