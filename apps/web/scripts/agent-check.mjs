#!/usr/bin/env node
/**
 * End-to-end agent-readiness check against a running site.
 *
 *   node scripts/agent-check.mjs https://rowhouse-gg.pages.dev
 *
 * Exercises every public machine-readable surface: Markdown negotiation, the
 * Markdown 404, llms.txt, sitemap.xml, robots.txt, JSON-LD identity, metadata,
 * and the trust pages. Exits non-zero on the first failing group.
 */
const base = (process.argv[2] ?? process.env.SITE_URL ?? 'http://localhost:4321').replace(
  /\/$/,
  '',
);
let failures = 0;

/** `optional` checks depend on owner-supplied data: they warn instead of failing. */
function check(name, ok, detail = '', optional = false) {
  const label = ok ? 'PASS' : optional ? 'WARN' : 'FAIL';
  console.log(`${label}  ${name}${!ok && detail ? `\n      ${detail}` : ''}`);
  if (!ok && !optional) failures++;
}

async function get(path, accept) {
  const res = await fetch(`${base}${path}`, {
    headers: accept ? { accept } : {},
    redirect: 'follow',
  });
  return {
    res,
    body: await res.text(),
    type: res.headers.get('content-type') ?? '',
    vary: res.headers.get('vary') ?? '',
  };
}

const varyHasAccept = (v) => v.split(',').some((t) => t.trim().toLowerCase() === 'accept');

// 1. Markdown negotiation on the homepage.
{
  const md = await get('/', 'text/markdown');
  check(
    'homepage: Accept text/markdown -> 200 text/markdown',
    md.res.status === 200 && md.type.startsWith('text/markdown'),
    `${md.res.status} ${md.type}`,
  );
  check('homepage: Markdown has Vary: Accept', varyHasAccept(md.vary), `vary=${md.vary}`);
  check(
    'homepage: Markdown body is nonempty and not HTML',
    md.body.trim().length > 200 && !/<html/i.test(md.body),
  );
  const html = await get('/', 'text/html');
  check(
    'homepage: Accept text/html -> text/html',
    html.type.startsWith('text/html') && /<html/i.test(html.body),
    html.type,
  );
  check('homepage: HTML has Vary: Accept', varyHasAccept(html.vary), `vary=${html.vary}`);
  const q = await get('/', 'text/html;q=0.5, text/markdown;q=0.9');
  check('homepage: q-values honored', q.type.startsWith('text/markdown'), q.type);
  const na = await get('/', 'application/json');
  check('homepage: unsupported Accept -> 406', na.res.status === 406, String(na.res.status));
}

// 2. Agent-friendly 404.
{
  const probe = `/__agent-check-404-${Date.now().toString(36)}`;
  const md = await get(probe, 'text/markdown');
  check('404: status preserved for Markdown', md.res.status === 404, String(md.res.status));
  check('404: Content-Type text/markdown', md.type.startsWith('text/markdown'), md.type);
  check(
    '404: body explains and links to llms.txt/sitemap',
    md.body.length >= 20 && /llms\.txt|sitemap\.xml/.test(md.body),
  );
  const html = await get(probe, 'text/html');
  check('404: HTML status preserved', html.res.status === 404, String(html.res.status));
}

// 3. llms.txt with when-to-use guidance.
{
  const r = await get('/llms.txt');
  check(
    'llms.txt: 200 text/plain',
    r.res.status === 200 && r.type.startsWith('text/plain'),
    `${r.res.status} ${r.type}`,
  );
  check('llms.txt: starts with H1 + blockquote', /^# .+\n\n> .+/.test(r.body));
  check('llms.txt: has a "When to use" section', /^## When to use/m.test(r.body));
}

// 4. Sitemap and robots.
{
  const r = await get('/sitemap.xml');
  check(
    'sitemap.xml: 200 XML urlset',
    r.res.status === 200 &&
      /xml/.test(r.type) &&
      r.body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),
    `${r.res.status} ${r.type}`,
  );
  check('sitemap.xml: has lastmod dates', /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(r.body));
  for (const p of ['/contact', '/privacy', '/about'])
    check(`sitemap.xml: lists ${p}`, r.body.includes(`${p}</loc>`));
  const robots = await get('/robots.txt');
  check(
    'robots.txt: points at the sitemap',
    /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robots.body),
  );
}

// 5. JSON-LD and metadata on the homepage.
{
  const { body } = await get('/', 'text/html');
  const blocks = [
    ...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));
  const types = blocks.flatMap((b) => (b['@graph'] ?? [b]).map((n) => n['@type']));
  check('JSON-LD: parses and has Organization', types.includes('Organization'), types.join(','));
  check(
    'JSON-LD: has identity type (WebApplication/SoftwareApplication)',
    types.includes('WebApplication') || types.includes('SoftwareApplication'),
  );
  const org = blocks.find((b) => b['@type'] === 'Organization') ?? {};
  check('JSON-LD: Organization.contactPoint', !!org.contactPoint?.contactType);
  check(
    'JSON-LD: Organization.address (PostalAddress)',
    org.address?.['@type'] === 'PostalAddress',
    'not configured: set CONTACT.address in src/lib/agent/site.ts',
    true,
  );
  check(
    'JSON-LD: contactPoint email/phone',
    !!(org.contactPoint?.email || org.contactPoint?.telephone),
    'not configured: set CONTACT.email in src/lib/agent/site.ts',
    true,
  );
  check('meta: canonical', /<link rel="canonical" href="https?:\/\/[^"]+"/.test(body));
  check('meta: html lang', /<html[^>]* lang="[a-z-]+"/i.test(body));
  check('meta: og:image', /<meta property="og:image" content="https?:\/\/[^"]+"/.test(body));
  check('meta: og:type', /<meta property="og:type" content="[^"]+"/.test(body));
  const og = body.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  if (og) {
    const img = await fetch(og);
    check(
      'meta: og:image resolves to an image',
      img.ok && (img.headers.get('content-type') ?? '').startsWith('image/'),
      `${img.status} ${img.headers.get('content-type')}`,
    );
  }
}

// 6. Trust pages.
for (const p of ['/about', '/contact', '/privacy']) {
  const r = await get(p, 'text/markdown');
  const text = r.body.replace(/^---[\s\S]*?---/, '');
  check(
    `${p}: 200 with >= 500 chars of content`,
    r.res.status === 200 && text.length >= 500,
    `${r.res.status}, ${text.length} chars`,
  );
}

console.log(
  failures
    ? `\n${failures} check(s) failed against ${base}`
    : `\nAll checks passed against ${base}`,
);
process.exit(failures ? 1 : 0);
