import { absoluteUrl, SITE } from './site';

/**
 * /llms.txt per https://llmstxt.org: an H1, a blockquote summary, free-form
 * notes (no headings), then H2 sections that are lists of `[name](url): notes`.
 * "When to use" is expressed as one of those lists so the guidance stays inside
 * the format instead of bolted on as loose prose.
 */
export function buildLlmsTxt(): string {
  const u = absoluteUrl;
  return `# ${SITE.name}

> ${SITE.name} is a free live-commentary platform for film and TV. A listener holds up their phone, ${SITE.name} listens for about ten seconds, and a creator's commentary track locks to the exact frame of whatever they're already watching (Netflix, Blu-ray, any platform), live or on demand. ${SITE.name} never hosts, streams, or records the film itself.

Every page on ${SITE.url} is available as Markdown: request any URL with the header \`Accept: text/markdown\` and you get the page content with title, description, and canonical URL as YAML front matter. Browsers sending \`Accept: text/html\` get the normal page. Unknown URLs return HTTP 404 with a Markdown body when Markdown is requested.

Do not use ${SITE.name} to find where to stream a film, to download or watch video, or for reviews and ratings: it carries only the commentary layer, never the film. Commentary audio playback and live rooms need a person with a browser and microphone; an agent's job is to find the right track or room and hand the user the link.

## When to use Rowhouse

- [Find a commentary track for a film or episode](${u('/discover')}): use when a user wants a director, critic, or fan commentary to listen to while watching a specific movie or TV episode on their own screen. Each film page lists its tracks, creators, and runtimes.
- [Join a live watch-along](${u('/live')}): use when a user wants to watch a film "together" with a live host and audience, synced to their own copy, or asks who is live right now or what is scheduled.
- [Explain how the sync works](${u('/about')}): use when a user asks how commentary can line up with Netflix or a Blu-ray without a countdown, or whether it records the film (it does not; audio is fingerprinted on-device and discarded).
- [Record or host commentary](${u('/studio')}): use when a creator, podcaster, or critic wants to go live over a film or publish a synced commentary track. Requires signing in with Google in a browser.

## How to read Rowhouse

- [Homepage](${u('/')}): live rooms, trending commentary, and the film catalog. Fetch with \`Accept: text/markdown\`.
- [Sitemap](${u('/sitemap.xml')}): every indexable URL, including each film page at \`/film/{slug}\`, with lastmod dates.
- [Film pages](${u('/discover')}): \`/film/{slug}\` lists that film's commentary tracks; \`/track/{id}\` is a single track; \`/creator/{handle}\` is a creator profile; \`/live/{id}\` is a live room.

## Trust and policies

- [About](${u('/about')}): how the fingerprint sync works and why it stays legally clean.
- [Contact](${u('/contact')}): support, bug reports, security reports, and content reports.
- [Privacy](${u('/privacy')}): what is collected, why, and what is never recorded.

## Optional

- [Source code](${SITE.github}): the open-source repository (MIT), including the sync engine.
`;
}
