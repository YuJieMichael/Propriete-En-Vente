# Repository collaboration

- Put changes on a feature branch and create a pull request. Do not push new work directly to `main`.
- `main` is the production source for `https://proprieteenvente.ca`. Create feature branches from the latest `origin/main` and target PRs at `main`. Cloudflare Workers Builds watches `main`; `deploy/cloudflare` is a historical branch and must not receive new production changes.
- After merging a website change, confirm the Cloudflare build/deployment for that exact merge commit succeeded before reporting that it is live. A successful GitHub merge alone is not deployment proof.
- The user may ask the assistant to merge a specific PR. Before doing so, review its final changes, required checks and conflicts. Confirm the merge succeeded before reporting it.
- After a successful merge, report the PR number and cumulative count of PRs merged into `main`. Query GitHub's merged PR history; do not count direct pushes, individual commits, or PRs closed without merging. Squash and rebase merges still count as one merged PR each.
- `.github/workflows/merge-count.yml` produces a count and downloadable history from GitHub data. Do not manually increment a counter or create another PR just to record a merge.
- Put English and French before Chinese in new multilingual documentation, PR descriptions and language lists. Preserve French as the website's default language for the Québec market; keep Chinese available.
- Describe operational limits accurately: local source and previews are distinct from a deployed site; real accounts require the configured Supabase backend.
