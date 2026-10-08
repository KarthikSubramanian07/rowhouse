import { NodeHtmlMarkdown } from 'node-html-markdown';
import { parse } from 'node-html-parser';
import { absoluteUrl, SITE } from './site';

/**
 * Markdown variants of rendered pages. The page's own HTML stays the single
 * source of truth: we lift `<main>`, drop anything that's chrome or decoration,
 * absolutize links, and convert. Title, description, and canonical URL ride
 * along as YAML front matter so an agent can cite the page.
 */

const nhm = new NodeHtmlMarkdown({
  bulletMarker: '-',
  codeBlockStyle: 'fenced',
  maxConsecutiveNewlines: 2,
});

/** Elements that carry no readable content for an agent. */
const STRIP = [
  'script',
  'style',
  'template',
  'noscript',
  'svg',
  'astro-island',
  'button',
  '[aria-hidden="true"]',
].join(',');

/** YAML double-quoted scalar. JSON string syntax is a valid subset. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

function frontMatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${yamlString(v as string)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

const AGENT_FOOTER = [
  '---',
  '',
  `[${SITE.name}](${SITE.url}/) · [llms.txt](${absoluteUrl('/llms.txt')}) · [Sitemap](${absoluteUrl('/sitemap.xml')})`,
].join('\n');

/** Convert a full rendered HTML page to its Markdown representation. */
export function pageToMarkdown(html: string, requestUrl: string): string {
  const root = parse(html);
  const title = root.querySelector('title')?.textContent.trim();
  const description = root.querySelector('meta[name="description"]')?.getAttribute('content');
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? requestUrl;

  const main = root.querySelector('main') ?? root.querySelector('body') ?? root;
  for (const el of main.querySelectorAll(STRIP)) el.remove();
  for (const el of main.querySelectorAll('a[href], img[src]')) {
    const attr = el.tagName === 'IMG' ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (value?.startsWith('/')) el.setAttribute(attr, absoluteUrl(value));
  }
  // Astro strips whitespace between tags; without a separator, sibling buttons
  // and links would run together as `[a](x)[b](y)`.
  for (const el of main.querySelectorAll('a, span')) el.insertAdjacentHTML('afterend', ' ');

  const body = nhm.translate(main.innerHTML).trim();
  return `${frontMatter({ title, description, url: canonical })}\n${body}\n\n${AGENT_FOOTER}\n`;
}

/** Markdown body for a 404: what happened, and where an agent can go next. */
export function notFoundMarkdown(pathname: string): string {
  const safePath = pathname.replace(/[`\r\n]/g, '').slice(0, 200);
  return [
    frontMatter({ title: 'Not found | Rowhouse', status: '404' }),
    '# 404: page not found',
    '',
    `There is no page at \`${safePath}\` on ${SITE.name}. It may have moved, or the film, creator, track, or live room it pointed to no longer exists.`,
    '',
    '## Where to go next',
    '',
    `- [llms.txt](${absoluteUrl('/llms.txt')}): what Rowhouse is, when to use it, and how to read it as an agent`,
    `- [Sitemap](${absoluteUrl('/sitemap.xml')}): every indexable URL`,
    `- [Discover](${absoluteUrl('/discover')}): browse films with commentary tracks`,
    `- [Home](${SITE.url}/)`,
    '',
  ].join('\n');
}

/** Plain-text body for a 406, listing what we can actually produce. */
export const NOT_ACCEPTABLE_BODY =
  'Not Acceptable. This resource is available as text/html or text/markdown.\n';
