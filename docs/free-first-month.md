# Free first month for public listings

English · Français · 中文

## How it works

- Listings submitted through `#publier` after this change are marked `free_listing`.
- The 30 free days start when staff approve the listing in the review queue.
- 7 days before the end, the seller gets a reminder email (FR/EN/ZH) with the renewal phone number and reply-to address.
- When the period ends, an hourly job unpublishes the listing (status `expired`) and the seller gets one notice email. Nothing is ever charged; the site takes no payments.
- Staff can extend a published or expired free listing by 30 days with **Extend by 30 days** in the review queue. Agree on any renewal terms with the seller first.
- Centris imports and listings published before this change are not affected and never expire.

## One-time setup (production)

1. Apply `supabase/migrations/20261109153000_free_first_month_listings.sql`.
2. Deploy the `send-listing-notices` Edge Function. It reuses the existing `ENQUIRY_CRON_TOKEN`, `RESEND_API_KEY` and `ENQUIRY_EMAIL_FROM` secrets.
3. Run `supabase/schedule-free-listings.sql` once in the SQL editor (pg_cron + pg_net are already enabled for enquiry emails).

Static detail pages and the sitemap are build snapshots: an expired listing disappears from the live catalogue immediately, and from static pages at the next site build.

## Français

Les annonces soumises par `#publier` sont affichées gratuitement 30 jours après approbation, avec un rappel 7 jours avant la fin, puis retirées automatiquement sans frais. L’équipe peut prolonger de 30 jours depuis la file de révision.

## 中文

通过 `#publier` 提交的房源，审核通过后免费展示 30 天；到期前 7 天发提醒邮件，到期自动下架，不收任何费用。团队可在审核后台一键续期 30 天。
