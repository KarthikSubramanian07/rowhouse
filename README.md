# Rowhouse

Watch together. React live. Replay forever.

Rowhouse is live and on-demand film commentary that stays in sync with whatever
you're watching. Hold up your phone, and the commentary lines up to the exact
point you're at in the film, whether the creator is live right now or recorded it
six months ago. The film keeps playing on your own screen; Rowhouse adds the
commentary on top.

The name is the idea: a rowhouse is where people live side by side, sharing walls.
A movie house is where you watch films. Sitting in a row, in the dark, together.

## The part that's actually hard

Accounts, film pages, live chat, and share clips are the easy 90%. The core is the
sync layer: take a few seconds of mic audio and figure out where in the film's
timeline the listener currently is, then lock the commentary to that point.

It lives in `packages/sync-engine` as pure, dependency-free TypeScript. The method
is Shazam-style constellation-hash landmark matching (Wang 2003 / Ellis) adapted
for aligning against a single known reference, following Duong and Thudor's 2013
ICASSP paper on movie synchronization by audio landmark matching. The same code
runs in the browser (listener capture), in Node (tests), and in a Cloudflare
Worker (map generation).

Measured on the synthetic fixture corpus (`pnpm test:sync`), degraded to imitate a
phone mic in a noisy living room:

```
cases=18  lockRate=100.0%  meanAbsErr=15.6ms  maxAbsErr=40.0ms   live time-to-lock ~2s
```

One property makes the whole product legally clean: Rowhouse never records or
stores film audio. It listens, derives a fingerprint on the device, and discards
the samples. A test fails if that ever stops being true.

## Run it in five minutes

Needs Node 22+ and pnpm. No API keys; it runs on deterministic mocks by default.

```bash
pnpm install

# local D1/KV, schema, and demo data
cd apps/api
pnpm exec wrangler d1 migrations apply rowhouse --local
pnpm db:seed
cd ../..

# backend Worker + Astro site
pnpm dev
```

- Web: http://localhost:4321
- API: http://localhost:8787

On the homepage, press "Run the sync" to watch it lock in the browser with no
backend at all. "Try with your microphone" plays a reference clip through your
speakers and locks to it live.

```bash
pnpm test        # full suite, on mocks
pnpm test:sync   # just the sync engine (accuracy + time-to-lock)
pnpm typecheck   # strict TS across the workspace
```

## Layout

```
packages/
  sync-engine   fingerprinting, landmark matching, reaction/clip logic (pure TS)
  types         shared domain types and Zod DTOs (the API contract)
  db            Drizzle schema over D1
  ui            design system: tokens, Fraunces/Geist/Geist Mono, SyncLock, Waveform
apps/
  api           Hono Worker: REST API, ChatRoom Durable Object, queue, cron, OG cards
  web           Astro on Pages: SEO film/creator pages and the sync players (React islands)
```

## Stack

Everything sits on Cloudflare's free tier. SEO pages on Pages, the API and
realtime on Workers and Durable Objects, data in D1, commentary audio in R2 (zero
egress, which is what usually sinks audio apps), share cards from Satori, and Web
Push for notifications. Auth is hand-rolled sessions plus Google OAuth, no paid
vendor. Streaming, hosted fingerprinting, AI features, and payments each sit behind
an adapter with a mock default, so the app works before you spend anything.

`DECISIONS.md` has the reasoning, the substitutions from the original spec, and the
per-unit cost of each adapter. `SETUP.md` covers provisioning and deploy.

## For agents

Every page is also Markdown. Send `Accept: text/markdown` to any URL and the
middleware returns the page's `<main>` content as Markdown, with title,
description, and canonical URL as front matter and `Vary: Accept` set, per
[acceptmarkdown.com](https://acceptmarkdown.com). Unknown URLs keep their 404
status and get a Markdown body that points to `/llms.txt` and `/sitemap.xml`.
`/llms.txt` says when an agent should reach for Rowhouse; `/sitemap.xml` is
rendered per request from the film catalog. Organization and WebApplication
JSON-LD come from one identity file, `apps/web/src/lib/agent/site.ts`. Run
`pnpm --filter @rowhouse/web agent:check <url>` to verify a deployment.

## Design

Dark and high-contrast, built for film obsessives. One accent (a cinema red, the
record light), timecodes set in mono, and a sync-lock readout styled like an
instrument panel. Tokens and components are in `packages/ui`.

## License

MIT, see [LICENSE](./LICENSE). Third-party licenses are listed in
[LICENSES.md](./LICENSES.md).
