/**
 * AiProvider is additive and never required. Rowhouse is not an AI product; the
 * platform is fully functional with the deterministic mock. Real models (Anthropic)
 * plug in for better auto-chaptering, tone tagging, and clip captions. The sync
 * layer never touches this; that is a deterministic signal-processing problem.
 */
import { type Chapter, detectClipCandidates, type ReactionEvent } from '@rowhouse/sync-engine';
import type { Tone } from '@rowhouse/types';
import type { Env } from '../env.js';

export interface AiProvider {
  readonly name: 'mock' | 'anthropic';
  /** Propose chapter markers from reaction density + duration. */
  suggestChapters(input: {
    durationSeconds: number;
    reactions: ReactionEvent[];
  }): Promise<Chapter[]>;
  /** Classify tone from a title/description. */
  tagTone(text: string): Promise<Tone>;
  /** Caption an auto-generated clip. */
  captionClip(input: { filmTitle: string; peakSeconds: number; dominant: string }): Promise<string>;
}

const TONE_KEYWORDS: Record<Tone, string[]> = {
  analytical: [
    'analysis',
    'breakdown',
    'theme',
    'framing',
    'structure',
    'symbol',
    'reading',
    'essay',
  ],
  comedic: ['funny', 'hilarious', 'joke', 'roast', 'comedy', 'chaotic', 'unhinged', 'lol'],
  emotional: ['cried', 'devastating', 'beautiful', 'grief', 'love', 'tears', 'heartbreak'],
  chaotic: ['chaos', 'losing it', 'screaming', 'wild', 'insane', 'meltdown'],
};

/** Deterministic heuristics: no network, no keys. */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;

  async suggestChapters(input: {
    durationSeconds: number;
    reactions: ReactionEvent[];
  }): Promise<Chapter[]> {
    const chapters: Chapter[] = [{ t: 0, title: 'Cold open' }];
    const peaks = detectClipCandidates(input.reactions, input.durationSeconds, {
      topK: 4,
      minReactions: 3,
    });
    peaks.forEach((p, i) => {
      chapters.push({ t: Math.round(p.peakSeconds), title: `Big moment ${i + 1}` });
    });
    // Simple act markers if the reactions don't carry the structure.
    if (peaks.length < 2) {
      chapters.push({ t: Math.round(input.durationSeconds / 2), title: 'Midpoint' });
    }
    return chapters.sort((a, b) => a.t - b.t);
  }

  async tagTone(text: string): Promise<Tone> {
    const lower = text.toLowerCase();
    let best: Tone = 'analytical';
    let bestScore = -1;
    for (const [tone, words] of Object.entries(TONE_KEYWORDS) as [Tone, string[]][]) {
      const score = words.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = tone;
      }
    }
    return best;
  }

  async captionClip(input: {
    filmTitle: string;
    peakSeconds: number;
    dominant: string;
  }): Promise<string> {
    const mm = Math.floor(input.peakSeconds / 60);
    const ss = String(Math.floor(input.peakSeconds % 60)).padStart(2, '0');
    return `The room lost it at ${mm}:${ss} during ${input.filmTitle}`;
  }
}

export function resolveAi(_env: Env): AiProvider {
  // AnthropicAiProvider would activate on ANTHROPIC_API_KEY. Optional by design.
  return new MockAiProvider();
}
