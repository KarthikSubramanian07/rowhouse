import { absoluteUrl, CONTACT, SITE } from './site';

/**
 * Site identity as schema.org JSON-LD. Each node carries a stable `@id` so pages
 * can reference the organization (publisher, author) instead of repeating it.
 */
export const ORG_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;
export const APP_ID = `${SITE.url}/#app`;

export function organizationJsonLd(): Record<string, unknown> {
  const contactPoint: Record<string, unknown> = {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: absoluteUrl('/contact'),
    availableLanguage: ['en'],
  };
  if (CONTACT.email) contactPoint.email = CONTACT.email;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    logo: SITE.logo,
    description: SITE.description,
    sameAs: [SITE.github],
    contactPoint,
    ...(CONTACT.email ? { email: CONTACT.email } : {}),
    ...(CONTACT.address ? { address: { '@type': 'PostalAddress', ...CONTACT.address } } : {}),
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.description,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  };
}

export function webApplicationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': APP_ID,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.description,
    applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Any (web browser with a microphone)',
    browserRequirements: 'Requires JavaScript and microphone access for sync.',
    featureList: [
      'Audio-fingerprint sync of commentary to the exact frame of any film or TV episode',
      'Live watch-along rooms with chat and reactions',
      'On-demand commentary tracks recorded from live sessions',
      'Creator studio for recording and going live',
    ],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    image: SITE.logo,
    sameAs: [SITE.github],
    publisher: { '@id': ORG_ID },
  };
}
