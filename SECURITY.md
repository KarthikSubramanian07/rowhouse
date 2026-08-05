# Security

Rowhouse runs entirely on mock adapters with no secrets, so a clone is safe to run
and test out of the box. Real providers activate only when you supply keys. This
document records the security posture and how to report issues.

## Reporting

Found something? Open a private security advisory on the GitHub repo, or email the
address in the repo profile. Please do not file public issues for exploitable bugs.

## What is and isn't stored

- **No film audio is ever recorded or stored.** The listener's microphone is
  fingerprinted on-device and the audio is discarded. This is enforced in code and
  guarded by a test (`packages/sync-engine/src/invariant.test.ts`).
- Only commentary audio (uploaded by creators) and derived fingerprint maps live in
  R2. Sessions are stored as `SHA-256(secret)` in D1, never the raw token.

## Controls in place

- **Auth:** session tokens are 192-bit secrets from `crypto.getRandomValues`; only
  their SHA-256 (optionally peppered) is stored; validation is constant-time.
  Cookies are `HttpOnly`, `Secure` (on HTTPS), `SameSite=Lax`. Google OAuth uses
  state + PKCE and a fixed redirect target (no open redirect).
- **Dev login fails closed.** The keyless `/auth/dev` endpoint is available only
  when `ENVIRONMENT=development` (injected locally by `pnpm dev`), never on the
  deployed Worker.
- **Authorization:** every owner-scoped route derives the actor from the session
  and checks resource ownership. No route trusts a client-supplied user id.
- **Injection:** all queries go through Drizzle (parameterized). R2/KV keys are
  server-derived, never built from user input.
- **XSS:** JSON-LD is escaped for the script context (`serializeJsonLd`). Commentary
  audio is served with an allowlisted content type plus `X-Content-Type-Options:
  nosniff`, so it can never render as HTML on the cookie-bearing API origin.
- **Live chat:** posting requires an authenticated session; the display name is
  server-derived (no spoofing); per-connection rate limiting, a connection cap, and
  bounded stored rows prevent flooding and storage amplification.
- **SSRF:** push endpoints are restricted to the real browser push services over
  HTTPS. TMDB and OG-card fetches target fixed hosts only.
- **Abuse:** coarse KV-backed rate limiting on report and listen endpoints; upload
  bodies are size-capped and streamed to R2.
- **Headers:** CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, and a
  microphone-scoped `Permissions-Policy` on the site (`apps/web/public/_headers`);
  `nosniff` + `Referrer-Policy` on API responses.
- **CI** runs with `permissions: contents: read` and on `pull_request` (not
  `pull_request_target`), so untrusted PRs never get write scopes or secrets.

## Secrets and committed config

No credentials are committed, and none appear anywhere in git history. The only
committed infrastructure config (`apps/api/wrangler.jsonc`) contains Cloudflare
resource identifiers (a D1 database id, KV namespace ids, R2 bucket names) and
public URLs. These are identifiers, not authentication secrets: they are useless
without an authenticated Cloudflare account token. Real secrets are set with
`wrangler secret put` and listed in `SETUP.md`.

## Dependency advisories

`pnpm audit` reports findings that are almost entirely **build/dev tooling**
(`wrangler` to `miniflare` to `undici`/`ws`, `esbuild`, `sharp`, `postcss`), which
never ship to the Cloudflare Worker runtime. Patched transitive versions are pinned
via `pnpm.overrides` in the root `package.json` (`undici`, `ws`, `esbuild`).

Astro (the SEO site framework) is kept current (Astro 6) to pick up its security
fixes. The app also does not render user-controlled slot names or `transition:*`
directive values, and JSON-LD is escaped at the source (`serializeJsonLd`), so the
known Astro XSS vectors are mitigated regardless. Keep Astro on a supported major
as new advisories land.
