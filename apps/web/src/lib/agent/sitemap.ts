import { absoluteUrl, STATIC_PAGES } from './site';

/** One `<url>` entry of a sitemaps.org 0.9 urlset. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function staticEntries(): SitemapEntry[] {
  return STATIC_PAGES.map((p) => ({
    loc: absoluteUrl(p.path),
    lastmod: p.lastmod,
    changefreq: p.changefreq,
    priority: p.priority,
  }));
}

/**
 * Film detail pages from the catalog. The catalog carries no modification time,
 * so lastmod is omitted rather than invented. Slugs are URL-encoded defensively.
 */
export function filmEntries(films: { slug: string }[]): SitemapEntry[] {
  return films.map((f) => ({
    loc: absoluteUrl(`/film/${encodeURIComponent(f.slug)}`),
    changefreq: 'weekly',
    priority: 0.8,
  }));
}

export function buildSitemap(entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const urls = entries
    .filter((e) => {
      if (seen.has(e.loc)) return false;
      seen.add(e.loc);
      return true;
    })
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
