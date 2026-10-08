/**
 * Single source of truth for the site's public identity. JSON-LD, llms.txt, the
 * sitemap, and the Markdown variants all read from here, so the brand copy an
 * agent sees can't drift from what a person sees.
 */
export const SITE = {
  url: 'https://rowhouse-gg.pages.dev',
  name: 'Rowhouse',
  description:
    'Free-forever live commentary for film & TV. Hold up your phone; the commentary snaps to your exact frame. Live or on demand.',
  github: 'https://github.com/KarthikSubramanian07/rowhouse',
  issues: 'https://github.com/KarthikSubramanian07/rowhouse/issues',
  securityAdvisory: 'https://github.com/KarthikSubramanian07/rowhouse/security/advisories/new',
  logo: 'https://rowhouse-gg.pages.dev/og.png',
} as const;

/**
 * Public contact details. `email` and `address` are deliberately unset until the
 * owner chooses what to publish; every consumer renders them only when present.
 */
export interface PostalAddressInfo {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
}

export const CONTACT: { email?: string; address?: PostalAddressInfo } = {};

/** Indexable static routes, with the date their content last meaningfully changed. */
export const STATIC_PAGES: {
  path: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}[] = [
  { path: '/', lastmod: '2026-10-08', changefreq: 'daily', priority: 1.0 },
  { path: '/discover', lastmod: '2026-10-08', changefreq: 'daily', priority: 0.9 },
  { path: '/live', lastmod: '2026-10-08', changefreq: 'hourly', priority: 0.9 },
  { path: '/about', lastmod: '2026-10-08', changefreq: 'monthly', priority: 0.7 },
  { path: '/contact', lastmod: '2026-10-08', changefreq: 'yearly', priority: 0.4 },
  { path: '/privacy', lastmod: '2026-10-08', changefreq: 'yearly', priority: 0.3 },
];

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}
