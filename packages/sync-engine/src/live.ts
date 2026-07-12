/**
 * Live sliding-window sync loop.
 *
 * The listener's mic streams in chunks. We keep a rolling buffer (default 10 s),
 * re-match it each tick, and declare LOCKED only when consecutive windows agree
 * on the same reference-vs-audio-clock offset ("anchor"). After locking we can
 * predict the reference position from the audio clock alone — no continuous
 * matching needed — and the always-visible resync button re-runs the search.
 *
 * The "anchor" is the reference offset relative to the listener's own audio
 * clock: anchor = referencePosition − audioClockNow. For a true match it's
 * stable, so position(t) = anchor + t. This is the safety-valve UX made real.
 */
import { resample, toMono } from './dsp.js';
import { captureToFingerprint } from './fingerprint.js';
import type { FingerprintMap } from './map.js';
import { type MatchResult, matchQuery } from './match.js';
import { FP } from './params.js';

export type SyncStatus = 'idle' | 'listening' | 'locked';

export interface LiveSyncState {
  status: SyncStatus;
  /** Best current estimate of the reference position (s). */
  positionSeconds: number;
  /** Reference offset relative to the audio clock (s). Stable once locked. */
  anchorSeconds: number;
  /** 0…1 confidence of the most recent window. */
  confidence: number;
  /** Agreeing landmarks in the most recent window. */
  score: number;
  /** How many consecutive windows have agreed. */
  agreement: number;
  /** Seconds of audio ingested so far (the audio clock). */
  audioClockSeconds: number;
}

export interface LiveSyncOptions {
  /** Rolling buffer length matched each tick. Default 10 s. */
  windowSeconds?: number;
  /** Two consecutive windows must agree within this many seconds to lock. */
  agreementToleranceSeconds?: number;
}

export class LiveSyncSession {
  private readonly map: FingerprintMap;
  private readonly windowSamples: number;
  private readonly tolerance: number;
  private buffer: Float32Array = new Float32Array(0);
  private audioClock = 0; // seconds of audio ingested
  private lastAnchor: number | null = null;
  private agreement = 0;
  private lockedAnchor: number | null = null;

  constructor(map: FingerprintMap, opts: LiveSyncOptions = {}) {
    this.map = map;
    const windowSeconds = opts.windowSeconds ?? 10;
    this.windowSamples = Math.round(windowSeconds * FP.sampleRate);
    this.tolerance = opts.agreementToleranceSeconds ?? 0.2;
  }

  get state(): LiveSyncState {
    return {
      status: this.lockedAnchor !== null ? 'locked' : this.buffer.length > 0 ? 'listening' : 'idle',
      positionSeconds: this.positionAt(this.audioClock),
      anchorSeconds: this.lockedAnchor ?? this.lastAnchor ?? 0,
      confidence: this.lastConfidence,
      score: this.lastScore,
      agreement: this.agreement,
      audioClockSeconds: this.audioClock,
    };
  }

  private lastConfidence = 0;
  private lastScore = 0;

  /**
   * Feed a mic chunk. Resamples to 8 kHz, appends to the rolling buffer, and
   * re-matches. Returns the updated state. The raw chunk is not retained.
   */
  pushCapture(chunk: Float32Array | Float32Array[], sampleRate: number): LiveSyncState {
    const mono = Array.isArray(chunk) ? toMono(chunk) : chunk;
    const at8k = resample(mono, sampleRate, FP.sampleRate);
    this.audioClock += mono.length / sampleRate;

    // Append + trim to the rolling window.
    const merged = new Float32Array(this.buffer.length + at8k.length);
    merged.set(this.buffer, 0);
    merged.set(at8k, this.buffer.length);
    this.buffer =
      merged.length > this.windowSamples
        ? merged.subarray(merged.length - this.windowSamples)
        : merged;

    if (this.buffer.length < FP.nfft) return this.state;

    const result = matchQuery(captureToFingerprint(this.buffer, FP.sampleRate), this.map);
    this.ingestResult(result);
    return this.state;
  }

  private ingestResult(result: MatchResult): void {
    this.lastConfidence = result.confidence;
    this.lastScore = result.score;
    if (!result.locked) {
      // Weak/failed window doesn't reset a hard lock, but does stall agreement.
      this.agreement = 0;
      this.lastAnchor =
        this.lockedAnchor === null ? result.positionSeconds - this.audioClock : this.lastAnchor;
      return;
    }
    const anchor = result.positionSeconds - this.audioClock;
    if (this.lastAnchor !== null && Math.abs(anchor - this.lastAnchor) <= this.tolerance) {
      this.agreement++;
    } else {
      this.agreement = 1;
    }
    this.lastAnchor = anchor;
    if (this.agreement >= FP.match.consecutiveWindows) this.lockedAnchor = anchor;
  }

  /** Predicted reference position at a given audio-clock time. */
  positionAt(audioClockSeconds: number): number {
    const anchor = this.lockedAnchor ?? this.lastAnchor;
    return anchor === null ? 0 : anchor + audioClockSeconds;
  }

  /** Drop the lock and re-search — the always-visible resync button. */
  resync(): void {
    this.lockedAnchor = null;
    this.lastAnchor = null;
    this.agreement = 0;
    this.buffer = new Float32Array(0);
  }
}
