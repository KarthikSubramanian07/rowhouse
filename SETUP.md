# SETUP

The app runs **fully locally with zero secrets**. This checklist is only for
provisioning Cloudflare and turning on real (paid/keyed) providers when you choose.

## 0. Local dev (no account needed)

```bash
pnpm install
cd apps/api && pnpm exec wrangler d1 migrations apply rowhouse --local && pnpm db:seed && cd ../..
pnpm dev            # web on :4321, api on :8787
```

That's it — the sync demo, film pages, players, and the live→async flywheel all
work on mocks.

## 1. Provision Cloudflare (one command)

You need a free Cloudflare account and to be logged in once:

```bash
pnpm exec wrangler login
./setup.sh          # idempotent: creates D1, R2 buckets, KV namespaces, the queue
```

`setup.sh` prints the resource IDs it created (or found). **Paste the D1
`database_id` and the two KV `id`s into `apps/api/wrangler.jsonc`** where you see
the `REPLACE_WITH_*` placeholders. (This is the one unavoidable manual edit —
Wrangler doesn't template them for you.)

Then apply the schema to the remote DB:

```bash
cd apps/api && pnpm db:migrate:remote && cd ..
```

## 2. Deploy

```bash
pnpm deploy         # deploys the API Worker, then the Pages site
```

- Backend Worker → `rowhouse-api.<your-subdomain>.workers.dev` (invisible; called via the proxy).
- Public site → **`rowhouse.pages.dev`** (a *production* Pages deploy gets the bare
  project domain — no hashed `e5e…` preview subdomain).

Set the web project's env var so its `/api` proxy points at your Worker:

```bash
pnpm exec wrangler pages secret put PUBLIC_API_ORIGIN --project-name rowhouse
# value: https://rowhouse-api.<your-subdomain>.workers.dev
```

> **Clean workers.dev name:** if your account's `*.workers.dev` subdomain looks
> random, set a nicer one under **Workers & Pages → Account → Subdomain** in the
> dashboard. Or attach a custom domain to either project later.

## 3. Turn on real providers (all optional)

Each is off until its secret is set; nothing breaks while they're off.
Set secrets with `wrangler secret put <NAME>` in `apps/api`.

| Feature | Secrets | Get them from |
|---|---|---|
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth. Redirect URI: `https://<api>/auth/google/callback`. (Until set, a zero-secret dev login is used.) |
| Session hardening | `SESSION_PEPPER` | any long random string (`openssl rand -hex 32`). |
| Real film metadata | `TMDB_READ_TOKEN` | themoviedb.org → API (v4 read token). Until set, the curated mock catalog is used. |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `pnpm exec web-push generate-vapid-keys` (or any VAPID tool). |
| Live streaming | (100ms / CF Realtime creds) | wire in `apps/api/src/adapters/stream.ts`. |
| Hosted fingerprint accelerator | `ACRCLOUD_HOST/KEY/SECRET` | optional; the self-hosted matcher is the default and is free. |

## Notes

- Local state lives in `apps/api/.wrangler/` (gitignored). Delete it to reset.
- Trigger the cron locally: `curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"`.
- CI (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on push/PR.
