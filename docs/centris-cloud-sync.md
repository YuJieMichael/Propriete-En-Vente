# Daily Centris cloud sync

The `Daily Centris sync` GitHub Actions workflow runs at 09:00 America/Toronto on GitHub-hosted Ubuntu. It does not require a local computer or Codex. GitHub scheduling is best effort, so execution can be delayed. The workflow must exist on `main`; it always checks out the latest `deploy/cloudflare` production code.

## Activation and operation

1. Deploy migration `20261030152735_centris_cloud_sync.sql` and the `centris-cloud-sync` Edge Function.
2. Merge the implementation into `deploy/cloudflare` and the workflow into `main`.
3. Run the workflow with **apply unchecked**. This reads all Centris pages, authenticates using GitHub OIDC, compares the database, and verifies the published pages, cover photos and sitemap. No listing is changed.
4. After a successful cloud rehearsal, allow GitHub Actions to create pull requests in this repository and set the repository Actions variable `CENTRIS_AUTO_SYNC_ENABLED=true`.
5. Run with **apply checked** and verify the database result, merged publication PR, Cloudflare deployment marker and public-page checks. Only then pause the former local Codex automation.

To pause writes, remove the variable or set it to `false`. Scheduled dry runs continue. To pause everything, disable this workflow. A manual run defaults to read-only, even when automatic writes are enabled.

## Data and deployment

- Broker scope is Tian Shu Lu, Centris e6356 / public courtier code 97998. Existing ownership is seeded from the reviewed 29-listing baseline on 2026-10-30, never from every listing in the database.
- Public HTML and the site's standard pagination requests are used. No sign-in, CAPTCHA bypass or browser session is required. Every page count and unique source ID is checked. If access is blocked or markup changes, the run fails without treating that as withdrawal. This is not an official Centris data feed; a future restriction may require a broker-authorized Passerelle feed.
- New listings use verified public facts and template summaries in English, French and Chinese. Unspecified facts remain null. Confidential addresses have no map coordinates. New published source coordinates are labelled approximate; existing manually verified coordinates and descriptions are retained.
- New source photos are converted to WebP and merged through a photos-only production PR. The job waits until they are served by the production domain before publishing the database row.
- Price, rent, transaction and tax changes preserve all other existing property fields, photos, keywords and public references.
- A missing listing is unpublished only after two complete observations at least 20 hours apart. Empty catalogues and reductions exceeding 25% stop for review. The submission, images, reference and before-image remain available. Auto-withdrawn listings can be restored under the same UUID/reference. Manual unpublishing stops automatic reconciliation for review.
- An unambiguous address/city/transaction match can preserve a listing's identity after a Centris ID replacement. Undisclosed or ambiguous addresses require review.
- The database transaction checks a revision digest, takes the shared broker advisory lock, rejects old/duplicate snapshots, and retains a restricted before-image and source snapshot. Concurrent admin edits cause a retry instead of an overwrite.
- After the database transaction, a marker-only PR triggers Cloudflare's normal production build. That build regenerates the static SEO pages and sitemap from current data. The job verifies the marker, all published language pages, their prices and cover photos. Failed deployment verification fails the run; the next run can regenerate publication without duplicating listings.
- The daily deployment marker is also a repository activity record. GitHub may disable scheduled workflows after 60 days of repository inactivity; check the workflow status if the repository is archived or automated commits stop.

## Authentication and evidence

The Edge Function validates GitHub's RS256 signature, issuer, dedicated audience, repository/owner immutable IDs, subject, `main` ref, exact workflow filename, permitted schedule/manual events and GitHub-hosted runner. Pull requests, forks, alternate workflows and browser Supabase tokens are rejected. Tokens expire quickly and are masked in job logs. No Supabase service-role key is copied to GitHub.

Only the Edge Function's internal service role may call the two sync RPCs. Private state and backups have RLS and no browser grants. The state response contains managed listing data only, excluding contacts and enquiries.

Each run has a GitHub summary and a 30-day artifact containing public source evidence/results. Failures appear as failed Actions runs; email delivery depends on the account's Actions notification settings. Restricted database backup records are not uploaded to GitHub artifacts. Production PRs contain only public images or the deployment marker; the runner validates the final changed-file list, checks and merge status before merging.

Validation: `npm test --prefix automation`, `node supabase/tests/run-database.mjs`, frontend tests/build, plus a real GitHub-hosted dry run and publication run before activation.

References: [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth-headers).
