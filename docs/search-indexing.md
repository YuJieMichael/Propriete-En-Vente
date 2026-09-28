# Public URLs and search indexing

French remains the default. Public routes are `/fr/`, `/en/`, `/zh/`, their
`proprietes` (French) / `properties` (English and Chinese) catalogues, and
`/fr/propriete/<title-city-id>/` or `/en/property/<title-city-id>/` /
`/zh/property/<title-city-id>/` listing details. The listing UUID keeps existing
links working after a title changes; metadata points to the current canonical.
Existing fragment links remain compatible. Account screens stay authenticated.

## Build and deploy

Use `npm run build` from the repository root. Keep the existing browser-safe
Supabase configuration and set `VITE_SITE_URL=https://proprieteenvente.ca`.
Set `VITE_LISTING_PUBLICATION_ENABLED=true` only for the configured public
catalogue. Never use a service-role key. Build failure while reading published
listings must be investigated before deployment; an incomplete listing sitemap
must not silently replace the production one.

The prebuild reads only `published_listings` with the public key. It generates
`sitemap.xml` and a temporary metadata manifest; postbuild creates static HTML
heads for each public route under `dist/`. Main page content still renders with
JavaScript. Demo listings, private projects, and filtered catalogue variants
are excluded from the sitemap. Demo details and missing listings receive
`noindex` after rendering. A missing listing currently returns the SPA's HTTP
200 with a not-found message, not a server-generated 404.

Deploy the complete `dist/`, including nested `index.html` files, `robots.txt`
and `sitemap.xml`. The included Nginx configuration serves these directories and
falls back to the SPA for newly published or old listing URLs. Static hosting
must support the same behavior. Canonical URLs use trailing slashes.

**Rebuild and redeploy after publishing, editing or withdrawing a listing.**
The sitemap and initial HTML metadata are build snapshots; database changes
alone update the rendered catalogue but do not refresh those static files.
Withdrawn details show a not-found state and `noindex` after JavaScript runs.

## Production acceptance and Search Console

1. Check direct requests to all three homepages, catalogues and an actual
   published listing. Each must load assets, show the correct language and have
   exactly one canonical, a page-specific title and description, and reciprocal
   `hreflang` links. Confirm rendered production pages have no `noindex`.
2. Check `/robots.txt` and `/sitemap.xml` on the deployed domain. Compare sitemap
   listing URLs with the current published inventory. Do not submit preview
   domains or fictional properties.
3. In the owner's Google Search Console, add the Domain property
   `proprieteenvente.ca`, complete the DNS TXT verification shown by Google,
   then submit `https://proprieteenvente.ca/sitemap.xml`.
4. Inspect the canonical French homepage and actual listing URLs. Run the live
   test, check Google access/rendering/canonical selection, then request
   indexing. Submission does not guarantee indexing or ranking.
5. Use Search Console queries and impressions to prioritize useful French
   service content. City pages require a confirmed service area and distinct
   local information; do not generate interchangeable city pages.

GitHub PR creation/merge does not itself deploy this Sites project. The target
is recorded in `.openai/hosting.json`; the connected account must have access
to that project before publication. Google verification and Search Console
submission are separate account operations, not effects of this code change.
