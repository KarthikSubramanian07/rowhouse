<div align="center">

# Rowhouse

**Watch together. React live. Replay forever.**

The film conversation you want, synced to whatever you're watching — live, or on demand.

`▍│ │`  ·  free-forever  ·  built to run on $0

</div>

---

You finish a movie and immediately need to hear someone smart talk about it. You
listen to film podcasts on a plane and wish you could have *watched it with them*.

Rowhouse is the person sitting next to you in the dark — the one who gasps at the
right moment and leans over to reframe the whole scene. On demand. **Synced to your
exact frame.**

Hold up your phone. The app listens for ten seconds and snaps the commentary to
wherever you are in the film — on Netflix, on a Blu-ray, on anything. The film
stays on your screen. Rowhouse only delivers the layer on top.

> A rowhouse is where people live side by side, sharing walls, hearing each other's
> lives. A movie house is where you watch films. Sitting in a row together, in the dark.

## The one hard thing

Everything here — accounts, film pages, live chat, share clips — is table stakes.
The product is the **sync layer**: live mic audio → the exact position on *this*
film's timeline → the commentary locks to it.

It's built as pure, dependency-free TypeScript (`packages/sync-engine`) using
Shazam-style **constellation-hash landmark matching**, specialized for media-sync
against a single reference timeline (Duong & Thudor, ICASSP 2013). It runs
identically in your browser, in Node, and in a Cloudflare Worker.

On the synthetic fixture corpus (`pnpm test:sync`), degraded like a phone mic in a
noisy living room:

```
cases=18  lockRate=100.0%  meanAbsErr=15.6ms  maxAbsErr=40.0ms   live time-to-lock ≈ 2s
```

And the boundary that keeps this legal: **Rowhouse never records or stores film
audio.** It listens, derives a fingerprint on your device, and throws the audio
away. There's a test that fails if that ever stops being true.

## Run it in five minutes

Requires Node ≥ 22 and `pnpm`. No API keys — the whole thing runs on deterministic
mocks out of the box.

```bash
pnpm install

# provision local D1/R2/KV + apply the schema + seed the film canon
cd apps/api
pnpm exec wrangler d1 migrations apply rowhouse --local
pnpm db:seed
cd ../..

# one command: backend Worker + Astro site
pnpm dev
```

- Web → http://localhost:4321
- API → http://localhost:8787

Open the homepage and hit **Run the sync** — that's the magic moment, working
entirely in your browser with zero backend. Then **Try with your microphone**:
it plays a reference clip through your speakers and locks to it for real.

```bash
pnpm test        # everything, green, on mocks
pnpm test:sync   # just the moat — accuracy + time-to-lock
pnpm typecheck   # strict TS across the workspace
```

## What's in the box

```
packages/
  sync-engine/   the moat — fingerprint + landmark matching + reaction/clip logic (pure TS)
  types/         shared domain types + Zod DTOs (the API contract)
  db/            Drizzle schema over D1 (the data model)
  ui/            design system — tokens, Fraunces/Geist/Geist-Mono, SyncLock, Waveform…
apps/
  api/           Hono Worker: REST API + ChatRoom Durable Object + queue + cron + OG cards
  web/           Astro on Pages: SEO film/creator pages + the sync players (React islands)
```

## The stack (and why it's $0)

Everything runs on Cloudflare's free tier. Static SEO pages on **Pages**, the API
+ realtime on **Workers** + **Durable Objects**, data in **D1**, commentary audio
in **R2** (zero egress — the thing that kills audio platforms), share cards via
**Satori**, notifications via **Web Push**. Auth is hand-rolled sessions + Google
OAuth — no paid vendor. Every paid or per-call dependency (streaming, hosted
fingerprinting, AI, payments) sits behind an adapter with a deterministic mock, so
the app is fully functional before you spend a cent.

The full reasoning, substitutions, and the honest per-unit cost of every adapter
live in **[DECISIONS.md](./DECISIONS.md)**. Setup + deploy live in
**[SETUP.md](./SETUP.md)**.

## Design

Dark, engineered, cinematic — the glow of a screen in a row of seats. One accent
(cinema red, the REC light), timecodes rendered in mono as first-class objects,
and the sync-lock as an instrument panel rather than a spinner. Tokens and
components live in `packages/ui`.

## License

MIT — see [LICENSE](./LICENSE). Third-party license ledger in
[LICENSES.md](./LICENSES.md).

<div align="center"><sub>Not a streaming service. A commentary layer. The film stays yours.</sub></div>
