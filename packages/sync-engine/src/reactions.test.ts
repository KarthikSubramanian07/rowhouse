import { describe, expect, it } from 'vitest';
import {
  assembleTrackFromSession,
  binReactions,
  detectClipCandidates,
  type ReactionEvent,
  reactionToWaveformX,
} from './reactions.js';

describe('reactionToWaveformX', () => {
  it('maps a position to a normalized fraction', () => {
    expect(reactionToWaveformX(30, 120)).toBe(0.25);
    expect(reactionToWaveformX(0, 120)).toBe(0);
    expect(reactionToWaveformX(120, 120)).toBe(1);
  });

  it('clamps out-of-range and guards zero duration', () => {
    expect(reactionToWaveformX(-5, 120)).toBe(0);
    expect(reactionToWaveformX(999, 120)).toBe(1);
    expect(reactionToWaveformX(30, 0)).toBe(0);
  });
});

describe('binReactions', () => {
  it('buckets reactions and counts per type, dropping empty bins', () => {
    const events: ReactionEvent[] = [
      { t: 1, type: 'fire' },
      { t: 1.5, type: 'fire' },
      { t: 1.9, type: 'laugh' },
      { t: 50, type: 'cry' },
    ];
    const bins = binReactions(events, 60, 2);
    expect(bins.length).toBe(2);
    const first = bins[0]!;
    expect(first.count).toBe(3);
    expect(first.counts.fire).toBe(2);
    expect(first.counts.laugh).toBe(1);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(1);
  });
});

describe('detectClipCandidates', () => {
  it('finds the highest-density moment', () => {
    // A dense cluster at ~80s, sparse elsewhere.
    const events: ReactionEvent[] = [];
    for (let i = 0; i < 20; i++) events.push({ t: 80 + i * 0.3, type: 'shock' });
    events.push({ t: 5, type: 'fire' }, { t: 130, type: 'laugh' });
    const clips = detectClipCandidates(events, 300, {
      windowSeconds: 20,
      topK: 1,
      minReactions: 5,
    });
    expect(clips.length).toBe(1);
    expect(clips[0]!.peakSeconds).toBeGreaterThan(78);
    expect(clips[0]!.peakSeconds).toBeLessThan(90);
    expect(clips[0]!.score).toBeGreaterThanOrEqual(20);
  });

  it('returns non-overlapping top-K clusters', () => {
    const events: ReactionEvent[] = [];
    for (let i = 0; i < 12; i++) events.push({ t: 20 + i * 0.5, type: 'fire' });
    for (let i = 0; i < 15; i++) events.push({ t: 200 + i * 0.5, type: 'cry' });
    const clips = detectClipCandidates(events, 400, {
      windowSeconds: 20,
      topK: 2,
      minReactions: 5,
    });
    expect(clips.length).toBe(2);
    expect(Math.abs(clips[0]!.peakSeconds - clips[1]!.peakSeconds)).toBeGreaterThan(20);
  });

  it('returns nothing below the minimum reaction threshold', () => {
    const events: ReactionEvent[] = [
      { t: 10, type: 'fire' },
      { t: 12, type: 'laugh' },
    ];
    expect(detectClipCandidates(events, 100, { minReactions: 5 })).toEqual([]);
  });
});

describe('assembleTrackFromSession', () => {
  it('produces a searchable async track with markers, chapters, clips', () => {
    const reactions: ReactionEvent[] = [];
    for (let i = 0; i < 30; i++) reactions.push({ t: 100 + i * 0.4, type: 'shock' });
    reactions.push({ t: 10, type: 'fire' }, { t: 4000, type: 'laugh' } /* out of range */);
    const assembled = assembleTrackFromSession({
      durationSeconds: 3600,
      reactions,
      chapters: [
        { t: 0, title: 'Cold open' },
        { t: 1800, title: 'Act two' },
        { t: 5000, title: 'off the end' }, // dropped
        { t: 900, title: '   ' }, // dropped (blank)
      ],
      clipOptions: { topK: 2, minReactions: 5 },
    });
    expect(assembled.totalReactions).toBe(31); // out-of-range laugh excluded
    expect(assembled.chapters.map((c) => c.title)).toEqual(['Cold open', 'Act two']);
    expect(assembled.reactionBins.length).toBeGreaterThan(0);
    expect(assembled.clipCandidates.length).toBeGreaterThanOrEqual(1);
    // Chapters sorted ascending by time.
    expect(assembled.chapters[0]!.t).toBeLessThan(assembled.chapters[1]!.t);
  });
});
