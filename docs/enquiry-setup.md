# Buyer / seller enquiries — active

English: Public buyer and seller forms require name and email only, with no login. Each enquiry now has its own private CSV email notification to `achat.vente.garderie@gmail.com`. The active scheduler checks once per minute and processes one eligible enquiry per run in FIFO order. A queued enquiry can therefore wait longer than one minute. The first production notification and its CSV have been verified in Gmail INBOX.

Français : Les formulaires d’achat et de vente exigent uniquement le nom et le courriel, sans connexion. Chaque demande fait désormais l’objet d’un courriel privé distinct avec un fichier CSV à l’adresse ci-dessus. La tâche active vérifie la file chaque minute et traite une demande admissible par exécution, dans l’ordre d’arrivée. Une file d’attente peut entraîner un délai supplémentaire. Le premier courriel de production et son CSV ont été vérifiés dans la boîte de réception Gmail.

中文：买卖表单仅姓名、邮箱必填，无需登录。邮件通知已启用，每条询盘单独发送一封包含该条 CSV 的内部邮件。计划任务每分钟检查一次，每次按先后顺序处理一条；有积压时会继续等待下一轮。首封正式通知及 CSV 已在 Gmail 收件箱实际核实，不再等待凑满十条。

## Production status / État de production / 生产状态

Verified 16 October 2026 for Supabase project `usngcexxobcpjncuwaxo`:

- `submit-enquiry` version 11 accepts numeric public listing references and older UUID references. The modern browser publishable key reaches application validation. A non-writing numeric-reference check used an existing internal-test request ID to trigger the database’s pre-write idempotency conflict; malformed input returned 400. No fake enquiry was added.
- `send-enquiry-batches` version 1 is deployed. `verify_jwt = false` is intentional: the handler requires the private `ENQUIRY_CRON_TOKEN` in its Authorization header. A public browser key does not authorize the worker.
- The Resend sending domain is Verified, and the existing `RESEND_API_KEY` is valid. Edge secrets `ENQUIRY_EMAIL_FROM`, `STAFF_EMAIL_FROM`, `APP_ORIGIN` and `ENQUIRY_CRON_TOKEN` are saved. Their values are not recorded in source or this document. No independent `ENQUIRY_RATE_SALT` was added; intake currently uses its existing server-side service-role-key fallback for hashing.
- Vault secret `enquiry_cron_token` is saved and supplies the worker’s private authorization. Cron job 1, `propriete-enquiry-batches`, is active on `* * * * *`. pg_cron and pg_net are enabled.
- Native migrations `20261016153217_single_enquiry_notifications` and `20261016153220_enable_enquiry_schedule_extensions` were applied successfully. Their exact returned versions are recorded under `supabase/migrations/`. Do not replay historical migrations or the former activation script.
- The first pre-existing active enquiry was processed at **2026-10-16 15:32:35 UTC**. Its notification was actually present in **Gmail INBOX with the CSV attachment**. This was an existing enquiry, not a newly inserted fake lead. Provider acceptance alone would not establish inbox delivery; this first message was checked separately.
- Before activation there were 8 enquiries: 5 active pending and 3 soft-deleted pending. After the first confirmed notification, 4 active enquiries remained for successive one-minute runs. The 3 deleted entries stay excluded. These are activation-snapshot counts; use live database/worker records for the current queue.

Français : La collecte et les notifications sont actives. Le premier envoi d’une demande déjà présente a été reçu dans Gmail avec son CSV le 16 octobre 2026 à 15:32:35 UTC. Au moment de cette première confirmation, quatre demandes actives restaient à traiter à raison d’une par minute ; les trois demandes supprimées restent exclues. Aucun faux prospect n’a été créé pour cette vérification.

中文：收集和通知现已运行。2026 年 10 月 16 日 15:32:35 UTC，第一条历史有效询盘的通知及 CSV 已进入 Gmail 收件箱。首封确认时，另有 4 条有效询盘由每分钟的任务依次处理，3 条软删除记录继续排除；这些是启用时的快照数量，当前队列以实时后台为准。本次没有添加假客户来测试。

## Deployment and operation

The canonical claim-function change is `supabase/migrations/20261016153217_single_enquiry_notifications.sql`. The hosted scheduler extensions are recorded in `supabase/migrations/20261016153220_enable_enquiry_schedule_extensions.sql`. `supabase/enable-single-enquiry-notifications.sql` is now a comment-only compatibility reference, with no duplicate executable implementation. Reconcile source with native migration history before any CLI `db push`; do not reapply already recorded versions.

The worker entry point is `supabase/functions/send-enquiry-batches/index.ts`, with shared dependencies `enquiry-notification-handler.ts` and `enquiry.ts`. Keep server secrets out of frontend `VITE_` variables, source archives and Git. The schedule source is `supabase/schedule-enquiry-batches.sql`; it uses the existing named job and Vault token. `VITE_ENQUIRY_ENABLED=true` enables the deployed public form.

The internal table/function names still say “batch”, but each new claim contains exactly one enquiry. The worker refuses a larger legacy claim rather than combining contacts. Atomic claims, five-minute leases and stable provider idempotency keys remain in place. Failed attempts retain their claim. After 23 hours of uncertain delivery, a claim is marked `needs_review` to avoid an uncontrolled retry after the provider’s 24-hour idempotency window. Reconcile provider records, `provider_id` and `sent_at` before a manual retry.

RLS and service-role-only worker execution restrictions remain in force. Customer roles cannot read the private inbox tables. The handlers do not log contact information. CSV cells neutralize spreadsheet formulas and preserve UTF-8 French and Chinese. Successful form collection, provider acceptance and actual inbox delivery are separate outcomes; verify each when investigating a problem. Do not add fake leads to production or restore deleted enquiries merely to empty the queue.

## Verification

All 30 function unit tests passed, including the fixed recipient, single-enquiry attachment, retry key, failed-provider handling and private authorization checks. Focused disposable PGlite assertions load all supported historical migrations plus the canonical single-enquiry migration. They cover immediate eligibility, eight separate FIFO claims, lease retry identity, non-overlapping active claims, deleted-entry exclusion, the 23-hour review hold and rate limits. PGlite omits only the hosted pg_cron/pg_net extension migration; the production cron and first Gmail receipt were checked against the actual services.

The full database suite has a known older failure in `permissions.sql`, which references the missing `finish_staff_invite(uuid,uuid)` function. That unrelated failure has not been described as a passing suite.

References: [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Optional preferences

English: Contact language, contact method, availability and any optional property/service preferences remain included in each enquiry’s CSV. Their presence does not create a brokerage agreement, public package or payment commitment.

Français : Les préférences facultatives de langue, de contact, de disponibilité et de propriété ou de service figurent dans le CSV de chaque demande. Elles ne constituent pas un contrat de courtage, un forfait public ou un engagement de paiement.

中文：联系语言、联系方式、方便联系时间及其他选填的房产或服务偏好，均保留在各条询盘的 CSV 中；填写这些资料不会自动形成经纪合同、公开套餐或付款承诺。
