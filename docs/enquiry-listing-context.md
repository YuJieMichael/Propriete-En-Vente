# Enquiry property context

## English

Production is built from `main`, which was synchronized with the current production source on 2026-10-30. Cloudflare Worker `propriete-en-vente` serves `proprieteenvente.ca` and `www.proprieteenvente.ca`, with static assets from `dist/`. The source accepts numeric references and UUIDs; the regression suite explicitly includes `100024`. Use the current `main` source for Edge Function changes; historical revisions may omit current metrics, notification, property type and date behavior.

A database insert trigger resolves a buyer's numeric `listingReference` against the unique `published_listings.listing_number`, or a UUID against its primary key. It writes an allowlisted `listing_context` separately from the original `payload`. This also covers the existing `collect_enquiry_with_metrics` path without changing metrics, rate limits, duplicate detection or staff authorization. Client-supplied property details are not accepted by the Edge parser. Missing/withdrawn references remain saved and are marked unresolved; they never gain an invented address or URL. Snapshots remain after a listing changes or is withdrawn.

The private staff inbox merges this context into its response, leaving stored requests unchanged. Property city and price are separate from preferred cities and budget. The download is explicitly **this page**, at most 50 rows in the selected active/pending/accepted/deleted filter, with UTF-8 BOM, quoted fields and formula-injection protection. Per-enquiry email CSVs include the same property fields.

Historical backfill records current published facts with `listingSnapshotSource=backfill` and a resolution timestamp. It does not establish the price at the original enquiry date. Reference `100024` resolves to a Saint-Sauveur hotel listing at CAD 4,890,000 at verification time, UUID `cedd685b-4e21-5114-b9bb-f54f99757a9f`. Its address is unpublished. Neither the source's placeholder street nor `source.originalAddress` is exported. No customer fields are included in this document or test fixtures.

### Deployment order and rollback

1. Run `npm ci`, `npm --prefix frontend ci`, `npm test`, and `npm run build`. The production build requires the existing browser-safe Supabase settings and enabled enquiry/publication flags. Server keys must never enter the Vite environment.
2. Deploy **send-enquiry-batches first**, including `enquiry-notification-handler.ts`, `enquiry.ts`, `enquiry-csv.ts` and its existing imports. It treats a missing CSV version as the previous schema. Preserve the existing `verify_jwt` setting and all secrets.
3. Apply only `enquiry_listing_context`, after checking production prerequisites. Do not replay the repository's older migrations: the hosted migration versions differ. Existing batches get `csv_version=1`; new ones get `2`. The claim function retains leases and provider retry keys and supplies property fields only for new-format batches.
4. Verify enquiry count and original-payload digest are unchanged, verify the `100024` context without reading customer contact fields, and recheck unauthorized reads. No synthetic leads or emails should be sent to production.
5. Merge the tested PR into `main` and verify Cloudflare's build/deployment result and live asset revision. Keep the existing domains, variables and routing.

For frontend rollback, redeploy the previous Cloudflare version; additive database metadata can remain. Do not roll the email worker back to its legacy CSV serializer after new-format messages have been attempted: preserve format-version support to keep retries stable. No enquiry or batch needs deletion for rollback.

Tests cover a pre-migration historical row, public numeric and UUID lookups, original data equality, server-owned snapshots, missing references, private-address exclusion, staff-only access, price changes and duplicate retries, new vs legacy email CSVs, and the rendered inbox. `npm test` uses disposable PGlite databases; hosted scheduling, real mail delivery and a staff browser session require separate production verification.

Mobile changes retain the listing facts and fixed viewing button. The homepage uses a horizontally scrollable six-property row on narrow screens, tighter sections and shorter repeated guidance; desktop layouts remain unchanged.

## Français

Les demandes conservent leur contenu original. Le serveur associe la référence numérique ou l’UUID à une annonce publiée et enregistre séparément la ville, le prix, l’adresse publique et le lien. Une adresse non publiée reste non publiée. Les associations historiques utilisent les données actuelles, sans prétendre reconstituer le prix initial. L’accès à la boîte de réception demeure réservé au personnel. Le CSV téléchargé contient uniquement la page et le filtre affichés.

Déployer le service de notification avant la migration, puis le site depuis `main`. Les versions de CSV préservent les anciennes tentatives d’envoi. Ne supprimer aucune demande et ne redéployer aucune ancienne migration.

## 中文

原始咨询保持不变，服务器单独保存真实房源关联。100024 的地址未公开，不能用来源占位地址补充。历史关联依据当前已发布数据，不能视为咨询当时的价格。后台仍仅对授权员工开放，下载 CSV 明确为当前筛选的本页记录。先更新邮件函数，再应用新增迁移，最后部署 Cloudflare 前端；保留旧邮件重试格式，禁止重放旧迁移或删除客户数据。
