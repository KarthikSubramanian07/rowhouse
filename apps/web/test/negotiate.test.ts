import { describe, expect, it } from 'vitest';
import { appendVaryAccept, preferredType } from '../src/lib/agent/negotiate';

describe('preferredType', () => {
  it.each([
    [null, 'text/html'],
    ['', 'text/html'],
    ['*/*', 'text/html'],
    ['text/html', 'text/html'],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'text/html'],
    ['text/markdown', 'text/markdown'],
    ['TEXT/MARKDOWN', 'text/markdown'],
    ['text/markdown, text/html, */*', 'text/markdown'],
    ['text/html, text/markdown', 'text/html'],
    ['text/html;q=0.5, text/markdown', 'text/markdown'],
    ['text/markdown;q=0.4, text/html;q=0.9', 'text/html'],
    ['text/html;q=0, */*', 'text/markdown'],
    ['text/*', 'text/html'],
    ['text/markdown;q=0, text/html', 'text/html'],
  ])('Accept %j -> %s', (accept, expected) => {
    expect(preferredType(accept)).toBe(expected);
  });

  it.each([
    'application/json',
    'image/png',
    'text/html;q=0, text/markdown;q=0',
    'text/plain',
  ])('returns null (406) when nothing we produce is acceptable: %s', (accept) => {
    expect(preferredType(accept)).toBeNull();
  });

  it('ignores malformed q-values instead of throwing', () => {
    expect(preferredType('text/markdown;q=abc')).toBe('text/markdown');
  });
});

describe('appendVaryAccept', () => {
  it('sets Vary when absent', () => {
    const h = new Headers();
    appendVaryAccept(h);
    expect(h.get('vary')).toBe('Accept');
  });

  it('appends to an existing Vary without duplicating', () => {
    const h = new Headers({ Vary: 'Accept-Encoding' });
    appendVaryAccept(h);
    appendVaryAccept(h);
    expect(h.get('vary')).toBe('Accept-Encoding, Accept');
  });
});
