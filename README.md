# Propriété En Vente

English · Français · 中文

A trilingual Québec property website with public sale and rental listings, seller projects, buyer enquiries and a staff review workspace. French is the default language.

Une plateforme immobilière québécoise trilingue avec annonces de vente et de location, projets vendeurs, demandes d’achat et espace de révision pour l’équipe. Le français est la langue par défaut. Les comptes et données existants restent dans le service Supabase configuré.

魁北克三语房产网站，包含公开出售／出租房源、卖家项目、买家咨询和团队审核后台。法语为默认语言，现有账号和数据保留在已配置的 Supabase 服务中。

## Production source / Source de production / 正式网站源码

[proprieteenvente.ca](https://proprieteenvente.ca) is built automatically from **`main`** by Cloudflare Workers Builds. Create feature branches from the latest `main`, open PRs against `main`, and verify the Cloudflare deployment for the merge commit. The former `deploy/cloudflare` branch is retained as history and is no longer the production source. See [Cloudflare deployment](CLOUDFLARE-DEPLOYMENT.txt).

Le site est compilé et déployé automatiquement depuis **`main`**. Créez vos branches et PR à partir de `main`, puis vérifiez le déploiement Cloudflare du commit fusionné. L’ancienne branche `deploy/cloudflare` est conservée comme historique.

正式网站由 **`main`** 自动构建发布。以后从最新 `main` 创建修改分支，通过 PR 合并回 `main`，并确认对应提交的 Cloudflare 部署成功。旧 `deploy/cloudflare` 分支保留历史，不再作为发布来源。

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
