# Multilingual listing keywords / Mots-clés multilingues / 三语关键词

## Approved scope

Connect public property search and staff keyword management. English, French and Chinese labels and synonyms identify the same tag. Authorized staff create/edit definitions and add/remove tags in bulk; a single listing can have its tag set edited. Preserve existing functions, all original listing fields and every enquiry. Test, review and deploy to proprieteenvente.ca.

## Design

- Keep public property data and private enquiries unchanged. Store keyword definitions and listing assignments separately in the private schema, with RLS and no direct client grants. Add a public `search_keywords` JSON array to `published_listings` as an explicit public-only snapshot. New publication/republication refreshes the snapshot. Public listing loading still uses one catalogue request.
- Keyword labels require `en`, `fr`, `zh` (1–60 characters each); up to 30 synonyms (1–80 characters each). Definitions have optimistic revisions. Keywords are public marketing/search metadata, never private notes or NDA document contents.
- Verified staff RPCs use existing `private.is_staff()` checks and invoker wrappers over guarded private implementations. Tag changes have independent listing keyword revisions and audit events. Bulk add/remove, or a single listing replacement, is atomic for 1–100 selected listings; conflicts roll back the entire operation. A shared transaction lock keeps definition edits, assignment updates and publication snapshots consistent.
- Seed property-type keywords and assign them only from existing factual type fields. Never invent business figures or property attributes. Withdrawn/pending listings retain their private assignments but have no public snapshots.
- Build one deterministic, accent/case-insensitive matcher for ordinary catalogue queries. Match labels/synonyms in any supported language, longest phrases first, combine distinct criteria with AND and preserve existing location/reference matching. Multiword aliases stay intact; Chinese phrases work without spaces. Built-in type/city/parking/outdoor synonyms use actual structured fields. Unknown terms do not widen results.
- Add custom keyword recognition to the existing sentence-search review. Tag terms remain keywords, never inferred cities. Negated tags remain explicitly unsupported; do not silently turn them into positive requirements. All other price/type/room filters keep their existing semantics.
- Add a staff sidebar page for keyword definitions and paginated listing assignment management. Show only minimal listing identification, current tags and revision, with keyword/city/reference filtering and selected-count feedback. Bulk operations affect explicitly selected listings only. Preserve unsaved input on failure; refresh stale state with a clear message.

## Verification and release

TDD for matching, cache decoding, RPC authorization/validation/atomicity/publication lifecycle and staff UI. Run full test/build/SEO checks; inspect mobile/desktop search, custom synonyms and the existing catalogue. Compare aggregate original-data hashes before/after the production migration. Apply additive migration first, then PR merge/Cloudflare deploy; verify live public search and protected admin entry. No credentials or customer contents in logs/screenshots.
