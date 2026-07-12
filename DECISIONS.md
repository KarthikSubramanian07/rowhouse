# DECISIONS

Architecture choices, substitutions, and the exact boundaries where money starts.
This is the honest map of the system.

## Product framing (read this first)

Rowhouse lives or dies on **one** thing: a listener holds up their phone, the app
listens for ~10s, and the commentary track snaps to the exact frame of whatever
film they're playing on their own TV. That is an **audio-to-position
synchronization** problem (media sync / audio landmark matching), *not* music
identification. Everything else — accounts, film pages, chat, clips — is table
stakes built around that core.

The whole business also rests on a legal boundary: **Rowhouse is a commentary
layer, not a streaming service.** It never stores, serves, or redistributes film
audio. The app listens, derives a fingerprint on-device, and discards the audio.
That boundary is enforced in code and tested (see "The invariant").

## The stack, and every substitution

Standing rule: **$0 fixed infrastructure cost at scale, on Cloudflare's free
tier.** The spec's own tech section named a few services with a monthly floor or
egress bill; each is overridden with the Cloudflare equivalent.

| Concern | Spec said | We use | Why |
|---|---|---|---|
| DB / auth / realtime | Supabase (Postgres) | **D1** (SQLite) + hand-rolled sessions + **Durable Objects** | Supabase has a monthly floor; D1/DO are free-tier and in-ecosystem. |
| Object storage | — | **R2** (zero egress) | Audio egress is what kills audio platforms. R2 charges $0 egress. Non-negotiable. |
| Hosting / frontend | Next.js on Vercel | **Astro on Cloudflare Pages** | Vercel has a floor; Astro gives clean SSG/SSR for the SEO surface with a first-class CF adapter and no `next-on-cloudflare` rough edges. |
| Backend | — | **Hono on Workers** | Tiny, Workers-native. |
| Auth | Supabase Auth | **Sessions on D1 (ID.secret + SHA-256) + Arctic (Google OAuth)** | Lucia the library is deprecated; the pattern is copy-paste. No paid vendor. |
| Realtime chat | Supabase Realtime | **Durable Object + WebSocket Hibernation** | Free-tier, no GB-s while idle. |
| Fingerprinting | ACRCloud (hosted) | **Self-hosted constellation-hash matcher** (`@rowhouse/sync-engine`); ACRCloud kept as an optional accelerator adapter | Hosted ACRCloud is per-call money and returns a recording ID, not a timeline offset. The self-hosted matcher is the real, scales-forever product. |
| Live streaming | 100ms.live | **StreamProvider adapter** (100ms / Cloudflare Realtime), stubbed | Behind an adapter; the platform is fully functional without it. |
| OG cards / audiograms | Worker + Satori | **Worker + Satori + resvg-wasm** | Kept as specced — the distribution engine. |
| Push | Web Push API | **Web Push (VAPID) via `@pushforge/builder`** | `web-push` needs Node crypto; pushforge runs on Workers/WebCrypto. |
| Metadata | TMDB | **TMDB** (free) + a curated mock catalog | Mock ships the film canon so the SEO pages and demo render with zero keys. |
| Analytics | — | Cloudflare Web Analytics (add snippet) | Free, cookieless. |

### Deployment topology (and why)

Two deployables, **one clean public origin**:

- **`apps/web`** → Cloudflare **Pages** project `rowhouse` → `rowhouse.pages.dev`.
  Astro SSR for the SEO film/creator/home pages; the interactive players and
  studio are React islands. The browser talks **only** to this origin.
- **`apps/api`** → a Worker on `workers.dev` (the invisible backend): the Hono
  API, the `ChatRoom` Durable Object, the queue consumer, and cron.

The web app proxies `/api/*` to the backend Worker **server-side**
(`src/pages/api/[...path].ts`) and pipes `Set-Cookie` straight through, so session
cookies stay **first-party** on `rowhouse.pages.dev`. This is what lets us keep a
clean public domain *and* working auth without third-party cookies. The live
WebSocket connects directly to the Worker (cross-origin WS is fine; chat identity
is passed as a query param).

## The sync engine (the moat)

`packages/sync-engine` — pure, dependency-free TypeScript, identical in the
browser (listener capture), Node (fixtures), and Workers (map generation).

- **Algorithm:** Shazam-style constellation-hash landmark matching (Wang 2003 /
  Ellis), specialized per **Duong & Thudor, "Movie synchronization by audio
  landmark matching," ICASSP 2013** for media-sync against a *single reference
  timeline*. A query's matched landmarks each vote for an offset `Δ = t_ref −
  t_query`; the offset-histogram peak is the reference position. See
  `packages/sync-engine/README.md`.
- **Frozen parameters** (`src/params.ts`): 8 kHz mono, 1024-pt FFT / 256 hop
  (128 ms / 32 ms), 200–2200 Hz peak band, per-second density cap, fan-out 8. The
  26-bit hash is kept ≤ 2³¹ so the sorted binary map is a positive-int32
  `Int32Array` — binary-searchable with no unsigned-comparison hazards.
- **We wrote our own FFT** (compact radix-2) rather than take a dependency, so the
  matcher is fully owned and runs anywhere. `fft.js` (MIT) was the fallback.
- **Why not Chromaprint?** It's LGPL-as-a-whole (FFmpeg parts), designed for
  whole-track *identity*, and recovers an offset only via an O(N) slide.
  Constellation hashing gives O(1) hash probes + a direct offset histogram and
  better mic-noise survival. We avoid the LGPL entirely.

### Measured on the fixture corpus (`pnpm test:sync`)

Synthetic dialogue-like reference audio, degraded like a phone mic in a noisy room
(band-limiting, additive noise at target SNR, reverb, gain):

- **18/18 cases lock** (6 offsets × clean / living-room / noisy profiles) — **100% lock rate**
- **Mean absolute error 15.6 ms**, max 40 ms (bounded by the 32 ms hop)
- **Live time-to-lock ≈ 2 s** in the living-room profile (budget was 10 s)

**Honest caveat:** this proves the algorithm under *controlled, synthetic*
degradation. The roadmap's real gate — accuracy and time-to-lock on real consumer
hardware in a real living room — still needs a device-capture pass with real film
audio. The fixture harness is built to accept those recordings (see
`packages/sync-engine/src/testing`).

### The invariant (legal cleanliness, made technical)

`captureToFingerprint()` takes PCM and returns **only** derived integer hashes; the
audio is never returned, retained, or persisted. Tests assert it (a) returns no
float/audio typed arrays, (b) holds no reference to the input buffer, and (c)
produces strictly less data than the input. Matching happens **client-side** so
the mic stream never leaves the device. If this ever regresses, Rowhouse stops
being a commentary layer. See `packages/sync-engine/src/invariant.test.ts`.

## Adapters & the cost ledger

Every paid or per-call external dependency sits behind an interface with a
deterministic default. **With no secrets set, the app runs fully and the whole
test suite passes on mocks.** Real providers activate only when you supply keys.

| Adapter | Interface | Default | Real provider | Honest per-unit cost when real |
|---|---|---|---|---|
| Sync | `SyncEngine` | **self-hosted** (real, $0) | ACRCloud (accelerator) | Self-hosted: **$0**. ACRCloud free tier ~1k/day, then ~$0.10–1.00 per 1k recognitions. |
| Metadata | `TmdbProvider` | mock catalog | TMDB API | **$0** (free for reasonable scale). |
| Streaming | `StreamProvider` | mock | 100ms.live / CF Realtime | 100ms: 10k min/mo free, then ~$0.004–0.01/participant-min. |
| AI | `AiProvider` | mock (deterministic) | Anthropic | Chaptering/tagging/captions: a few $/1M tokens. Entirely optional. |
| Push | `PushProvider` | mock | Web Push (VAPID) | **$0** (browser-native). |
| Payments | `PaymentProvider` | mock (no-op) | Stripe | Phase 2. ~2.9% + 30¢. Never gates core features. |

**Where money actually starts:** only (a) live-streaming minutes past the free
tier and (b) optional hosted-fingerprint API calls — both behind adapters, both
stubbed by default. Self-hosted fingerprinting + R2 zero-egress + static pages =
the spec's "~$0 to 50k DAU" genuinely holds.

## Licenses

All everyday dependencies are permissive (MIT/BSD/ISC/Apache). `satori` /
`@resvg/resvg-wasm` are MPL-2.0 (file-level copyleft — fine as unmodified deps).
We deliberately avoid Chromaprint/AcoustID (LGPL) and FFmpeg (LGPL/GPL) in the
app; if audiogram *video* rendering is added it runs in an isolated
Container/process, never linked into a Worker. Full ledger in `LICENSES.md`.

## What's real vs. stubbed vs. deferred

- **Real & tested:** the sync engine + invariant; the data model; auth (sessions +
  Google OAuth) with a zero-secret dev login; the full REST API; film/creator/track
  pages with SEO + JSON-LD; the async player (mic → sync → play); the live→async
  assembly (a session becomes a searchable track with reaction markers baked in);
  OG cards; the design system.
- **Stubbed behind adapters:** live audio/video transport (100ms/CF Realtime), the
  hosted fingerprint accelerator (ACRCloud), AI features, payments, real Web Push
  (works when VAPID keys are set).
- **Deferred (Phase 2 seams only):** creator subscriptions, super-reactions, Pro
  billing, audiogram *video* (mp4) rendering, native mobile.
