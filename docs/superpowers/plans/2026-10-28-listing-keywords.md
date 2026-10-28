# Listing Keywords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Public multilingual keyword discovery with staff-managed definitions and listing tags.

**Architecture:** Private keyword/assignment tables, guarded RPC writes and public published-listing snapshots. A shared client matcher connects ordinary and sentence search to the existing filters; a separate staff page manages labels, synonyms and assignments.

**Tech Stack:** React, TypeScript, Supabase/Postgres, Vitest/JSDOM, PGlite, Cloudflare.

**Spec:** `docs/superpowers/specs/2026-10-28-listing-keywords-design.md`

## Global Constraints

- Preserve original listing/enquiry data and current functionality; French remains default.
- Three labels of 1–60 characters; up to 30 aliases of 1–80 characters.
- Verified staff only for writes; public snapshots contain public keyword metadata only.
- Bulk 1–100 listing IDs, atomic revision checks; no paid infrastructure or new app dependencies.

## Review Focus

- Chinese adjacency, French accents, multiword phrases and Latin word boundaries.
- Unknown/negated terms must never broaden a confirmed query.
- Stale staff selections and simultaneous saves must preserve unrelated tags/data.
- Withdraw/republication must remove/restore public keyword visibility correctly.
- Unavailable/malformed snapshots must not break existing catalogue loading.

### Task 1: Shared matching and public snapshot decoding

Files: `frontend/src/keyword-search.ts`, `frontend/src/listings-data.ts`, `frontend/src/smart-search.ts`, `frontend/src/lib/public-listings.ts`, corresponding tests.

- [x] Write failing tests for synonyms, combined city/type/reference/tag queries, phrases, unknown terms, Chinese adjacency and preserved budgets/negations.
- [x] Run targeted Vitest and confirm new assertions fail.
- [x] Implement `ListingKeyword`, `compileKeywordQuery(items, query)`, `findKeywordTerms(text, items)` and snapshot validation; integrate `selectListings` and sentence preview without treating tag synonyms as places.
- [x] Run matching, sentence-search and public-loading tests; commit the tested behavior.

### Task 2: Private keyword storage and staff RPCs

Files: CLI-generated migration; `supabase/tests/keywords.sql`, `supabase/tests/run-database.mjs`.

- [x] Write failing SQL assertions for ordinary users/anon denial, stale revisions, invalid input, bulk rollback, add/remove/replace, metadata audit and unchanged original fields.
- [x] Implement private definitions/links, `keyword_revision`, public `search_keywords`, publication snapshot trigger and guarded invoker RPCs `list_listing_keywords_admin`, `save_listing_keyword`, `apply_listing_keywords`.
- [x] Seed truthful type definitions/links, indexes, RLS and explicit grants; exercise withdraw/restore lifecycle and SQL-injection-like literal tags.
- [x] Run PGlite suites; commit after checks pass.

### Task 3: Staff keyword management

Files: `frontend/src/keyword-management.tsx`, `.css`, `keyword-copy.ts`, admin integration and UI tests.

- [x] Write failing tests for create/edit tri-language keywords, aliases, selected-only bulk updates, single-listing editing, double-submit prevention and failure/conflict feedback.
- [x] Add authenticated sidebar entry and definition editor plus paginated assignment list; expose only minimal listing metadata and public-tag warning.
- [x] Update public search labels/hints for keywords and reference search without expanding mobile cards.
- [x] Run focused UI tests and inspect responsive accessibility.

### Task 4: Verify, review, migrate and release

- [x] Run full tests/build/SEO and independent code review; resolve actionable findings.
- [x] Apply additive production migration and compare listing/enquiry baseline counts/hashes. Verify RPC privileges and anonymous published snapshots; run advisors and compare pre-existing findings.
- [ ] Create and attach PR, inspect final diff/checks and merge exact tested head into `deploy/cloudflare`.
- [ ] Verify Cloudflare Ready and live keyword searches; save public screenshots, release report and test logs under outputs. Report PR/main merge count and any genuine access limitation.
