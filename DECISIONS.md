# Decisions

Architecture choices, substitutions from the original spec, and where costs start.

## What the product is

The core of Rowhouse is one capability: a listener holds up their phone, the app
listens for about ten seconds, and the commentary track jumps to the exact frame
of whatever film is playing on their TV. That is an audio-to-position
synchronization problem (media sync, audio landmark matching), not music
identification. Accounts, film pages, chat, and clips are built around that core.

The product also depends on a legal line: Rowhouse is a commentary layer, not a
streaming service. It never stores, serves, or redistributes film audio. It
listens, derives a fingerprint on the device, and discards the samples. That line
is enforced in code and covered by a test (see "The invariant").

## Stack and substitutions

The rule was $0 fixed infrastructure cost at scale on Cloudflare's free tier. The
original spec named a few services with a monthly floor or egress bill; each is
replaced with the Cloudflare equivalent.

| Concern | Spec said | Used here | Reason |
|---|---|---|---|
| DB / auth / realtime | Supabase (Postgres) | D1 (SQLite) + hand-rolled sessions + Durable Objects | Supabase has a monthly floor; D1 and DO are free tier and in-ecosystem. |
| Object storage | (unspecified) | R2 (zero egress) | Audio egress is what sinks audio platforms. R2 charges nothing for egress. |
| Hosting / frontend | Next.js on Vercel | Astro on Cloudflare Pages | Vercel has a floor. Astro gives clean SSG/SSR for the SEO pages with a solid CF adapter. |
| Backend | (unspecified) | Hono on Workers | Small and Workers-native. |
| Auth | Supabase Auth | Sessions on D1 (ID.secret + SHA-256) + Arctic for Google OAuth | Lucia is deprecated; the session pattern is a short copy-paste. No paid vendor. |
| Realtime chat | Supabase Realtime | Durable Object with WebSocket hibernation | Free tier, no compute billed while idle. |
| Fingerprinting | ACRCloud (hosted) | Self-hosted constellation-hash matcher; ACRCloud kept as an optional accelerator | Hosted ACRCloud costs per call and returns a recording id, not a timeline offset. The self-hosted matcher is free and scales. |
| Live streaming | 100ms.live | StreamProvider adapter (100ms or Cloudflare Realtime), stubbed | Behind an adapter; the platform works without it. |
| OG cards / audiograms | Worker + Satori | Worker + Satori + resvg-wasm | Kept as specced. |
| Push | Web Push API | Web Push (VAPID) via @pushforge/builder | web-push needs Node crypto; pushforge runs on the Workers runtime. |
| Metadata | TMDB | TMDB, plus a curated mock catalog | The mock ships a film canon so pages and the demo render with no keys. |
| Analytics | (unspecified) | Cloudflare Web Analytics (add the snippet) | Free, cookieless. |

### Deployment topology

Two deployables, one public origin:

- `apps/web`: a Cloudflare Pages project (`rowhouse-gg`) at rowhouse-gg.pages.dev.
  Astro SSR renders the SEO pages; the players and studio are React islands. The
  browser only ever talks to this origin.
- `apps/api`: a Worker on workers.dev (the backend). It holds the Hono API, the
  ChatRoom Durable Object, the queue consumer, and cron.

The web app proxies `/api/*` to the backend Worker on the server side
(`src/pages/api/[...path].ts`) and passes Set-Cookie back through, so session
cookies stay first-party on the Pages domain. That is how a clean public domain
coexists with working auth and no third-party cookies. The live WebSocket connects
straight to the Worker (cross-origin WebSockets are fine). Chat identity is a
short-lived HMAC token minted via `POST /live/:id/ws-token` over the first-party
`/api` proxy, then passed as `?token=` on the WS URL. Client-supplied display names
are not trusted.

## The sync engine

`packages/sync-engine` is pure, dependency-free TypeScript that runs the same in
the browser, Node, and a Worker.

- Algorithm: Shazam-style constellation-hash landmark matching (Wang 2003 / Ellis),
  adapted per Duong and Thudor (ICASSP 2013) to align against one reference
  timeline. Each matched landmark votes for an offset (t_ref minus t_query); the
  peak of the offset histogram is the reference position. See the package README.
- Frozen parameters (`src/params.ts`): 8 kHz mono, 1024-point FFT, 256 hop
  (128 ms / 32 ms), a 200 to 2200 Hz peak band, a per-second density cap, and a
  fan-out of 8. The 26-bit hash stays under 2^31 so the sorted binary map is a
  positive int32 array that binary-searches with no unsigned-comparison pitfalls.
- The FFT is a small radix-2 implementation written here rather than pulled in, so
  the matcher has no runtime dependency. fft.js (MIT) was the fallback.
- Chromaprint was rejected. It is LGPL as a whole (FFmpeg parts), built for
  whole-track identity, and recovers an offset only with an O(N) slide.
  Constellation hashing gives O(1) hash lookups, a direct offset histogram, and
  better tolerance of mic noise. This keeps the project clear of LGPL.

### Measured on the fixture corpus (`pnpm test:sync`)

Synthetic dialogue-like reference audio, degraded to imitate a phone mic in a noisy
room (band-limiting, additive noise at a target SNR, reverb, gain):

- 18 of 18 cases lock (6 offsets across clean, living-room, and noisy profiles)
- Mean absolute error 15.6 ms, max 40 ms (bounded by the 32 ms hop)
- Live time-to-lock about 2 s in the living-room profile (the budget was 10 s)

Caveat: this proves the algorithm under controlled synthetic degradation. The real
bar, accuracy and time-to-lock on consumer hardware in an actual living room with
real film audio, still needs a device-capture pass. The fixture harness is set up
to take those recordings (see `packages/sync-engine/src/testing`).

### The invariant

`captureToFingerprint()` takes PCM and returns only integer hashes. The audio is
never returned, retained, or persisted. Tests assert that it returns no
float/audio typed arrays, holds no reference to the input buffer, and produces far
less data than went in. Matching runs client-side, so the mic stream never leaves
the device. See `packages/sync-engine/src/invariant.test.ts`.

## Adapters and cost

Every paid or per-call dependency sits behind an interface with a deterministic
default. With no secrets set, the app runs fully and the whole suite passes on
mocks. Real providers turn on only when their keys are present.

| Adapter | Interface | Default | Real provider | Cost when real |
|---|---|---|---|---|
| Sync | SyncEngine | self-hosted (real, free) | ACRCloud (accelerator) | Self-hosted: $0. ACRCloud: ~1k/day free, then roughly $0.10 to $1.00 per 1k recognitions. |
| Metadata | TmdbProvider | mock catalog | TMDB API | $0 at reasonable scale. |
| Streaming | StreamProvider | mock | 100ms.live or CF Realtime | 100ms: 10k min/month free, then ~$0.004 to $0.01 per participant-minute. |
| AI | AiProvider | mock (deterministic) | Anthropic | Chaptering, tagging, captions: a few dollars per 1M tokens. Optional. |
| Push | PushProvider | mock | Web Push (VAPID) | $0, browser-native. |
| Payments | PaymentProvider | mock (no-op) | Stripe | Phase 2. ~2.9% + 30c. Never gates core features. |

Costs start in only two places: live-streaming minutes past the free tier, and
optional hosted-fingerprint calls. Both sit behind adapters and are stubbed by
default. Self-hosted fingerprinting, R2 zero-egress, and static pages are why the
"roughly $0 to 50k DAU" claim holds.

## Licenses

Everyday dependencies are permissive (MIT/BSD/ISC/Apache). satori and
@resvg/resvg-wasm are MPL-2.0, which is fine as unmodified dependencies.
Chromaprint/AcoustID (LGPL) and FFmpeg (LGPL/GPL) are not used in the app; if
audiogram video rendering is added later it runs in a separate container or
process, never linked into a Worker. Full list in `LICENSES.md`.

## Real vs. stubbed vs. deferred

- Real and tested: the sync engine and its invariant; the data model; auth
  (sessions + Google OAuth, with a keyless dev login); the REST API;
  film/creator/track pages with JSON-LD; the async and live players; saving a
  finished live session as a searchable track with reaction markers; OG cards; the
  design system.
- Stubbed behind adapters: live audio/video transport, the hosted fingerprint
  accelerator, AI features, payments, and real Web Push (which works once VAPID
  keys are set).
- Deferred (Phase 2 seams only): creator subscriptions, super-reactions, Pro
  billing, audiogram video, and a native mobile app.
