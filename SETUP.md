# Setup

The app runs fully locally with no secrets. This file is only for provisioning
Cloudflare and turning on real (paid or keyed) providers when you want them.

## 0. Local dev (no account needed)

```bash
pnpm install
cd apps/api && pnpm exec wrangler d1 migrations apply rowhouse --local && pnpm db:seed && cd ../..
pnpm dev            # web on :4321, api on :8787
```

The sync demo, film pages, players, and the live-to-async save all work on mocks.

## 1. Provision Cloudflare

You need a free Cloudflare account, logged in once. Note that R2 has to be enabled
in the dashboard first (Cloudflare gates bucket creation until you do).

R2 is optional for a first deploy. The `r2_buckets` block in
`apps/api/wrangler.jsonc` ships commented out, and without it the API serves
every read endpoint while audio and fingerprint storage answer `503
storage_not_configured`. Once R2 is enabled and the buckets exist, uncomment the
block and redeploy.

```bash
pnpm exec wrangler login
./setup.sh          # idempotent: creates D1, R2 buckets, KV namespaces, the queues
```

`setup.sh` prints the resource ids it created or found. Paste the D1 `database_id`
and the two KV `id`s into `apps/api/wrangler.jsonc` where the `REPLACE_WITH_*`
placeholders are. Wrangler does not template these, so it is the one manual edit.

Then apply the schema to the remote database:

```bash
cd apps/api && pnpm db:migrate:remote && cd ..
```

## 2. Deploy

```bash
pnpm run deploy         # deploys the Pages site, then the API Worker
```

- Backend Worker: `rowhouse-api.<your-subdomain>.workers.dev`, called through the proxy.
- Public site: `rowhouse-gg.pages.dev`. A production Pages deploy gets the bare
  project domain rather than a hashed preview subdomain.
- `@astrojs/cloudflare` builds a Workers-style layout (`dist/client` plus
  `dist/server`). `scripts/pages-bundle.mjs` repackages it as a Pages advanced-mode
  `_worker.js` in `dist/pages`, which is what gets deployed. To try a change on
  Cloudflare without touching production, deploy a preview branch:
  `wrangler pages deploy dist/pages --project-name=rowhouse-gg --branch=<name>`.

### CI auto-deploy (GitHub Actions)

The `Deploy` workflow runs on every push to `main`, but only if a valid Cloudflare
token is present. If the token is missing or cannot authenticate, it skips cleanly
(the job stays green) and prints a warning. To enable auto-deploy, add two repo
secrets (Settings, Secrets and variables, Actions):

- `CLOUDFLARE_ACCOUNT_ID` - your account id.
- `CLOUDFLARE_API_TOKEN` - a token created at
  https://dash.cloudflare.com/profile/api-tokens with these account permissions:
  Cloudflare Pages: Edit, Workers Scripts: Edit, D1: Edit,
  Workers R2 Storage: Edit, Workers KV Storage: Edit, Account Settings: Read.

An `Authentication error [code: 10000]` in the deploy log means the token is
expired or under-scoped; recreate it with the permissions above and update the
secret.

Point the web project's proxy at your Worker:

```bash
pnpm exec wrangler pages secret put PUBLIC_API_ORIGIN --project-name rowhouse-gg
# value: https://rowhouse-api.<your-subdomain>.workers.dev
```

Run it once per environment (`--env production` and `--env preview`), and set the
same URL as `PUBLIC_API_ORIGIN` in `apps/api/wrangler.jsonc`. The live API is
`https://rowhouse-api.karthik-e5e.workers.dev`.

If your account's `*.workers.dev` subdomain looks random, set a cleaner one under
Workers and Pages, Account, Subdomain in the dashboard, or attach a custom domain
to either project.

## 3. Turn on real providers (all optional)

Each provider is off until its secret is set, and nothing breaks while it is off.
Set secrets with `wrangler secret put <NAME>` from `apps/api`.

| Feature | Secrets | Where to get them |
|---|---|---|
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console, OAuth. Redirect URI: `https://<api>/auth/google/callback`. Until set, keyless dev login works on localhost only (set `ALLOW_DEV_LOGIN=1` to opt in elsewhere). |
| Session hardening | `SESSION_PEPPER` | any long random string (`openssl rand -hex 32`). Also signs live chat WS tokens; set this before public launch. |
| Real film metadata | `TMDB_READ_TOKEN` | themoviedb.org, API, v4 read token. Until set, the mock catalog is used. |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `pnpm exec web-push generate-vapid-keys`, or any VAPID tool. |
| Live streaming | 100ms or CF Realtime credentials | wire into `apps/api/src/adapters/stream.ts`. |
| Hosted fingerprint accelerator | `ACRCLOUD_HOST`, `ACRCLOUD_KEY`, `ACRCLOUD_SECRET` | optional; the self-hosted matcher is the free default. |

## Notes

- Local state lives in `apps/api/.wrangler/` (gitignored). Delete it to reset.
- Trigger cron locally: `curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"`.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, test, and build on push and PR.
