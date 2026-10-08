import { describe, expect, it } from 'vitest';
import {
  ORG_ID,
  organizationJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from '../src/lib/agent/jsonld';
import { CONTACT } from '../src/lib/agent/site';

describe('JSON-LD identity', () => {
  it('describes the Organization with a contact point', () => {
    const org = organizationJsonLd();
    expect(org['@type']).toBe('Organization');
    expect(org['@id']).toBe(ORG_ID);
    expect(org.name).toBe('Rowhouse');
    expect(org.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: 'https://rowhouse-gg.pages.dev/contact',
    });
  });

  it('publishes the configured Berkeley, CA PostalAddress', () => {
    expect(organizationJsonLd().address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Berkeley',
      addressRegion: 'CA',
      addressCountry: 'US',
    });
  });

  it('adds email and PostalAddress only when they are configured', () => {
    const saved = { ...CONTACT };
    try {
      CONTACT.email = undefined;
      CONTACT.address = undefined;
      const bare = organizationJsonLd();
      expect(bare.address).toBeUndefined();
      expect(bare.email).toBeUndefined();
    } finally {
      CONTACT.email = saved.email;
      CONTACT.address = saved.address;
    }
    try {
      CONTACT.email = 'hello@example.com';
      CONTACT.address = { addressLocality: 'Berkeley', addressRegion: 'CA', addressCountry: 'US' };
      const org = organizationJsonLd();
      expect(org.contactPoint).toMatchObject({ email: 'hello@example.com' });
      expect(org.address).toEqual({
        '@type': 'PostalAddress',
        addressLocality: 'Berkeley',
        addressRegion: 'CA',
        addressCountry: 'US',
      });
    } finally {
      CONTACT.email = saved.email;
      CONTACT.address = saved.address;
    }
  });

  it('identifies the product as a free WebApplication published by the org', () => {
    const app = webApplicationJsonLd();
    expect(app['@type']).toBe('WebApplication');
    expect(app.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    expect(app.publisher).toEqual({ '@id': ORG_ID });
    expect(websiteJsonLd().publisher).toEqual({ '@id': ORG_ID });
  });
});
