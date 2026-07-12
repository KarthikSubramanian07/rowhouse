import { describe, expect, it } from 'vitest';
import { filmSlug, formatTimecode, slugify } from './slug.js';

describe('slugify', () => {
  it('normalizes titles into clean slugs', () => {
    expect(slugify('Mulholland Drive')).toBe('mulholland-drive');
    expect(slugify('A Nightmare on Elm Street (1984)')).toBe('a-nightmare-on-elm-street-1984');
    expect(slugify('WALL·E')).toBe('wall-e');
  });
});

describe('filmSlug', () => {
  it('builds movie slugs', () => {
    expect(filmSlug({ title: 'Hereditary', mediaType: 'movie' })).toBe('hereditary');
  });
  it('builds tv episode slugs with padded season/episode', () => {
    expect(filmSlug({ title: 'The Sopranos', mediaType: 'tv', season: 6, episode: 21 })).toBe(
      'the-sopranos-s06e21',
    );
  });
});

describe('formatTimecode', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatTimecode(247)).toBe('4:07');
    expect(formatTimecode(5000)).toBe('1:23:20');
    expect(formatTimecode(0)).toBe('0:00');
    expect(formatTimecode(-3)).toBe('0:00');
  });
});
