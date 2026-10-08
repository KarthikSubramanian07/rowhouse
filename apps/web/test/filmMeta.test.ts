import { describe, expect, it } from 'vitest';
import { filmDescription } from '../src/lib/filmMeta';

const overview =
  'A bright-eyed actress and an amnesiac collide in a Los Angeles that keeps folding in on itself.';

describe('filmDescription', () => {
  it('keeps a short overview whole, with no stray ellipsis or doubled period', () => {
    const d = filmDescription({ title: 'Mulholland Drive', overview, creatorCount: 2 });
    expect(d).toBe(`${overview} Listen to synced commentary on Mulholland Drive from 2 creators.`);
    expect(d).not.toContain('..');
  });

  it('invites the first commentary instead of saying "from 0 creators"', () => {
    const d = filmDescription({ title: 'Mulholland Drive', overview, creatorCount: 0 });
    expect(d).toContain('Be the first to record synced commentary for Mulholland Drive');
    expect(d).not.toContain('0 creators');
  });

  it('uses the singular for one creator', () => {
    expect(filmDescription({ title: 'Heat', overview: 'Cops and robbers', creatorCount: 1 })).toBe(
      'Cops and robbers. Listen to synced commentary on Heat from 1 creator.',
    );
  });

  it('clips long overviews on a word boundary with a single ellipsis', () => {
    const long = `${'word '.repeat(60)}end.`;
    const d = filmDescription({ title: 'X', overview: long, creatorCount: 3 });
    const clipped = d.split(' Listen')[0] ?? '';
    expect(clipped.endsWith('word…')).toBe(true);
    expect(clipped.length).toBeLessThanOrEqual(151);
  });

  it('falls back when there is no overview', () => {
    expect(filmDescription({ title: 'X', overview: null, creatorCount: 0 })).toBe(
      'Synced film commentary for X. Hold up your phone and the track locks to your frame.',
    );
  });
});
