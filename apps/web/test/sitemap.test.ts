import { describe, expect, it } from 'vitest';
import { buildSitemap, filmEntries, staticEntries } from '../src/lib/agent/sitemap';

describe('sitemap', () => {
  const xml = buildSitemap([
    ...staticEntries(),
    ...filmEntries([{ slug: 'in-the-mood-for-love-2000' }]),
  ]);

  it('is a sitemaps.org 0.9 urlset', () => {
    expect(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ),
    ).toBe(true);
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('lists every indexable static page with a W3C lastmod date', () => {
    for (const path of ['/', '/discover', '/live', '/about', '/contact', '/privacy']) {
      expect(xml).toContain(`<loc>https://rowhouse-gg.pages.dev${path}</loc>`);
    }
    const entries = staticEntries();
    for (const e of entries) expect(e.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(xml.match(/<lastmod>/g)?.length).toBe(entries.length);
  });

  it('includes film pages and never lists private routes', () => {
    expect(xml).toContain(
      '<loc>https://rowhouse-gg.pages.dev/film/in-the-mood-for-love-2000</loc>',
    );
    expect(xml).not.toContain('/studio');
    expect(xml).not.toContain('/api/');
  });

  it('escapes and encodes untrusted slugs, and dedupes', () => {
    const out = buildSitemap([
      ...filmEntries([{ slug: 'a&b<c>' }]),
      ...filmEntries([{ slug: 'a&b<c>' }]),
    ]);
    expect(out).toContain('<loc>https://rowhouse-gg.pages.dev/film/a%26b%3Cc%3E</loc>');
    expect(out.match(/<url>/g)?.length).toBe(1);
  });
});
