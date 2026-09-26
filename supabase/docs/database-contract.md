# Database and storage contract

The first backend release stores **private seller projects**. An approval is an
internal review result, not permission to expose the full `projects.details`
object publicly. It contains contact information. A public listing will need a
separate, deliberately limited projection and explicit publication workflow.

## Roles and access

- Anonymous visitors cannot query any of these four application tables.
- An authenticated seller may read their own project and files. A verified email
  is required by `ensure_project`, `save_project` and `submit_project`.
- `staff_members` is the authority for staff privileges. `user_metadata` and
  client-supplied role fields are ignored. No authenticated client can insert,
  update or delete a staff record, including the owner.
- Active `owner` / `operator` staff normally need a JWT with `aal: "aal2"` or
  a session-bound email check to read other sellers' projects, access their
  files, read audit records or review a project. An explicitly allowlisted,
  confirmed active owner may bypass step-up; the private allowlist stores user
  IDs and is not directly readable by authenticated clients.
- `get_my_staff_role()` returns only the current user's active role without the
  MFA requirement. This lets the app display the enrollment/challenge screen;
  it does not grant staff access to seller data.
- Staff do not receive permission to edit sellers' projects or files. A staff
  account may still manage its own seller project just like any other customer.
- Trusted server functions may use the service role. That key must never appear
  in a browser bundle or committed `.env` file. Platform staff do not need it.

## Tables

| Table | Key columns |
| --- | --- |
| `projects` | `id`, unique `owner_id`, `plan`, `details`, `services`, `completed`, `visits`, `status`, `review_note`, `revision`, timestamps |
| `project_files` | `id`, `project_id`, `owner_id`, `kind`, `name`, `size`, `mime_type`, `storage_path`, `created_at` |
| `staff_members` | `user_id`, `role`, `active`, timestamps |
| `audit_events` | `id`, nullable `actor_id` / `project_id`, `action`, `metadata`, `created_at` |

There is one seller project per user in this release. Buyers, offers, payment
orders and public listings are not yet real backend entities.

## Browser RPCs

All returned project records use the database column names above. Supabase RPC
parameters must use the exact names below.

### `ensure_project()` → `projects`

Gets or atomically creates the signed-in, verified user's project. Repeated and
concurrent calls cannot create duplicate projects.

### `save_project(p_project_id, p_expected_revision, p_plan, p_details, p_services, p_completed, p_visits)` → `projects`

Only the project's owner may save. Never send `owner_id`, `status`, `review_note`
or `revision` as editable JSON fields. A row lock and revision comparison prevent
an older browser tab from overwriting newer data. The client should surface an
explicit reload/conflict action for SQLSTATE `40001`; do not retry old data with
the latest revision automatically.

A real change advances `revision`, sets `status` to `draft` and clears the old
review note. An identical snapshot is a no-op, preserving submission/approval.
The app must serialize saves, file changes and submissions to avoid racing its
own revision. Save any pending changes before submitting or changing files.

Allowed `details` keys:

- Strings: `address`, `city`, `postal`, `type`, `price`, `broker`, `timeline`,
  `name`, `email`, `phone`, `date`, `time`, `language`, `notes`.
- Boolean: `consent`.
- `type` / `timeline`: `"0"`–`"3"`; `broker` / `time`: `"0"`–`"2"`.
- `language`: `fr`, `en`, `zh`.
- `price`: empty or a positive whole-number string, at most ten digits.
- `date`: empty or a valid ISO `YYYY-MM-DD` date.
- Partial contact/address strings are allowed while saving drafts. Full format
  and completeness checks happen on submission.

`services` is a duplicate-free array of `photo`, `video`, `analysis`, `consult`,
`listing`. These are service interests, not paid orders. `visits` stores up to
100 personal notes shaped `{name, date, time}`, with an ISO date and `HH:mm` time.
Saving a visit does not contact anyone or reserve staff time.

### `submit_project(p_project_id, p_expected_revision)` → `projects`

Moves a `draft` or `changes_requested` project to `submitted`. It requires
`completed: true`, a property address/city/postal code, name/email/phone, explicit
consent, property options and at least one stored photo. Appointment date is
optional. If supplied, it must be today or later in the America/Toronto timezone.
It advances the revision. An already submitted or approved project cannot be
resubmitted without an edit first.

### `review_project(p_project_id, p_expected_revision, p_decision, p_note)` → `projects`

Active MFA staff only. Only `submitted` projects can be reviewed. The decision
is `approved` or `changes_requested`; the latter requires a nonempty note. Notes
are limited to 2,000 characters. Approval rechecks completeness and stored photo
availability. Updating the project and writing a `project_reviewed` audit event
are one transaction. Another edit/review causes the same `40001` conflict as save.

## Staff invite transaction

`finish_staff_invite(p_actor_id, p_member_id)` is executable only by the
service role. The Edge handler verifies the caller's JWT, MFA assurance level
and identity before assigning the operator role and writing a `staff_invited`
audit event. Invitations are managed by the platform owner.

Initial owner creation is a trusted, one-time SQL deployment step documented in
the setup guide. There is no public “make me an administrator” API. Operator
appointments do not grant access to the Supabase management dashboard.

## Private media

Bucket: `project-files`; **public is false**; limit 10 MiB per file. Accepted
types: JPEG, PNG, WebP, PDF. Photos must be images. Metadata limits are eight
photos and ten documents per project, protected by a lock on the project row.

Object path: `{owner_uuid}/{project_uuid}/{file_uuid}.{ext}`. Use lowercase UUIDs,
with `jpg`/`jpeg`, `png`, `webp` or `pdf` matching the MIME type. The third UUID
must equal the new `project_files.id`. Original filenames belong in `name`, not
the object path. They may be at most 255 characters with no control characters.

Upload sequence:

1. Save pending project changes and generate a UUID for the file.
2. Upload with `upsert: false` to the immutable object path.
3. Insert `project_files` metadata including that same UUID, owner/project IDs,
   original name, actual byte size, MIME type and path. The database verifies the
   object already exists and its stored size/MIME match the submitted metadata.
4. Refresh the project and file list: registering a file advances the revision
   and returns any reviewed/submitted project to draft.
5. If registration fails, remove the uploaded object. Report a cleanup failure
   so it can be retried instead of silently creating orphan storage.

Deletion sequence:

1. Delete the object via the Supabase Storage API.
2. Delete the matching `project_files` row.
3. Refresh project/files. Metadata deletion also advances the project revision.

A storage `AFTER DELETE` trigger invalidates approval immediately when a
registered object is removed, before the second HTTP request. Thus one complete
deletion normally advances revision twice. The trigger only updates our own
project table and does not modify the Storage schema's data. Submission and
approval additionally require a photo whose actual Storage object still exists.
Supabase's [protected schema permissions announcement](https://github.com/orgs/supabase/discussions/34270)
explicitly permits triggers on `storage.objects`. Its function lives in our
`private` schema; no Storage table ownership or built-in function is changed.

The database refuses metadata deletion while its object still exists. If the
second request fails, retry it; keep a visible error instead of implying that
both operations completed. Updating/moving/overwriting stored objects and file
metadata is intentionally not granted to browser clients.

Obtain short-lived signed URLs only for authorized files. Do not place private
object paths or signed URLs in a public listing. A signed URL is a temporary
bearer credential: use a short expiry and generate a new one when needed.

## Validation and deployment boundaries

`supabase/tests/bootstrap.sql` is a **disposable test double**, not a deployment
migration. It implements minimal auth/storage schemas and JWT settings so the
RLS integration assertions can run in PGlite without a real account. Run:

1. `tests/bootstrap.sql`
2. `migrations/202609230001_initial_backend.sql`
3. `tests/permissions.sql`

Tests cover ownership isolation, role forgery, MFA gates, optimistic locking,
file metadata matching, state transitions, audit writes and staff revocation.
The test transaction rolls back its fixtures. This validates PostgreSQL rules;
it does **not** test Supabase email delivery, HTTP upload byte/MIME limits,
signed-URL endpoints, Edge JWT verification or backup restoration. Smoke-test
those on an isolated Supabase staging project before accepting real clients.

Apply only the migration file to the actual Supabase project. Keep the browser
publishable key separate from server secrets. Confirm email verification and
redirect allowlists, use a production SMTP service, and configure both database
and Storage object backups; database backups alone do not contain uploaded file
bytes. No production resources or customer data are created by these SQL files.
