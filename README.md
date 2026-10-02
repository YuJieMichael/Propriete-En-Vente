# Propriété En Vente

English · Français · 中文

A trilingual Québec property website with a project workspace inspired by SmartDepanneur: a compact white sidebar, blue actions, project list, search/status filters, and separate project details. French is the default language.

Une plateforme immobilière québécoise trilingue avec une liste de projets, création de projet et dossiers indépendants. Chaque compte peut gérer plusieurs propriétés. Les données existantes restent dans le service Supabase configuré.

支持一个账号管理多个房屋项目：项目列表 → 新建项目 → 项目详情／编辑。后台采用 SmartDepanneur 风格的白色侧栏、蓝色按钮和表格布局。

## Run locally / Démarrage local / 本地启动

Requires Node.js 22.18+ and npm.

```sh
npm ci
npm --prefix frontend ci
npm --prefix backend ci
```

Copy `frontend/.env.example` to `frontend/.env.local`, then enter the existing browser-safe Supabase URL/key. Never use a service-role key in frontend variables.

```sh
npm run dev
npm run build
```

The frontend build is written to `dist/`. Routes: `#projects` (sign-in required), `#projects/<id>/overview`, `#projects/<id>/edit`, `#admin` (verified staff), `#demo` (labelled fictional example), `#proprietes` (public catalogue), `#publier` (public listing submission).

## Search pages / Pages de recherche / 搜索收录

Public entry points are `/fr/`, `/en/`, `/zh/`, their `proprietes/` catalogues, and `proprietes/<listing_number>/` details. Commercial guides use `proprietes/hotels-motels/`, `garderies/`, `terrains/`, and `entreprises/`. Old hash links remain supported. Every production build reads only `published_listings` with the configured public Supabase key, generates static HTML and a sitemap, then checks unique metadata, canonical URLs and reciprocal hreflang. Never supply a service-role key.

Rebuild and deploy after publishing, editing or removing a listing: the interactive catalogue refreshes automatically, but the static HTML and sitemap are build snapshots. A failed catalogue read fails the build. Private projects, enquiries, contacts and demo properties are excluded from the sitemap. Google Search Console submission does not guarantee indexing or rankings.

Après toute publication, modification ou retrait d’annonce, reconstruire et déployer le site pour mettre à jour le HTML statique et le sitemap. Le catalogue interactif se rafraîchit séparément. Les dossiers privés et demandes de contact ne sont jamais inclus dans le sitemap.

新增、修改或下架房源后，需要重新构建并部署，才能同步静态详情页和 sitemap；页面内的实时房源目录会自行刷新。提交 Google 不等于已经收录，也不保证排名。

## Runtime modes / Modes / 运行方式

- **Managed website:** leave `VITE_PROJECT_API_URL` empty. Projects/files use the existing Supabase database and storage, preserving current accounts and data. Apply all numbered migrations including `202609250007_multiple_projects.sql` before enabling the new project UI.
- **Independent project API:** set `VITE_PROJECT_API_URL=/api` for the Docker deployment. React → Nginx → Express → PostgreSQL. Projects, private files and review audit events live in the independent database. Existing Supabase Auth still verifies accounts and staff access. Public listings, enquiries, invitations and email remain on Supabase.

The Docker database starts empty. Changing the API setting does **not** copy existing projects or files. This is not an offline, fully self-hosted replacement for Supabase. See [deployment and migration guide](docs/project-workspace.md).

模式说明：现有线上站继续使用原账号和数据；独立工程已经提供，但需要服务器才能运行。独立项目数据库与原网站数据库是分开的，切换前必须另行迁移数据。邮件服务配置不属于本次架构升级的完成项。

## Verification / Vérification / 检查

```sh
npm test
npm run test:backend
npm run build
```

UI tests use simulated services. Database and API integration tests use disposable PGlite, the production SQL and real local HTTP requests; identity is mocked. They do not send emails or replace a real server smoke test. Docker startup has not been verified on this workstation because Docker is unavailable.

## Source / Code / 工程目录

```text
frontend/src/          React UI, project list, seller forms and admin
frontend/tests/        UI and browser adapter tests
backend/src/           Independent authenticated project API
backend/migrations/    PostgreSQL schema and validation
backend/tests/         HTTP/database integration tests
supabase/              Existing managed database and Edge Functions
compose.yaml           Frontend, API, migrations and PostgreSQL
.openai/hosting.json    Existing Sites publication target
```

Customer project data is private; internal approval does not publish it. Public listing submission has its own review process. Service selections record interest, not a paid order or signed brokerage mandate. Demo figures are fictional. Legal content, service agreements, production email and server backups require the owner's configured services.

Changes use feature branches and pull requests; publishing a Sites version does not merge its GitHub PR. Legacy setup documents describe the managed backend and may use former `src/` paths; source now lives under `frontend/src/`.

Icons: `lucide-react` (ISC). Other dependency licences remain applicable. No additional licence is assigned to the owner's content or images.
