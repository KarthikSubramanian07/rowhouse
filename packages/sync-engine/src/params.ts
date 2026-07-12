/**
 * Frozen fingerprint parameters.
 *
 * These MUST be identical for map generation (creator side) and query matching
 * (listener side). Any change here invalidates every previously generated
 * fingerprint map, so the format version is bumped alongside it.
 *
 * Lineage: Wang (ISMIR 2003) / Ellis constellation fingerprinting, specialized
 * per Duong & Thudor (ICASSP 2013) for media-sync against a single reference
 * timeline. See DECISIONS.md and the sync-engine README.
 */
export const FP = {
  /** Fingerprint format version — bump on any parameter change below. */
  version: 1,

  // ── Signal front-end ────────────────────────────────────────────────
  /** Everything is resampled to this rate. Dialogue energy lives < 4 kHz. */
  sampleRate: 8000,
  /** FFT window size (samples). 1024 @ 8 kHz = 128 ms, 7.8125 Hz/bin. */
  nfft: 1024,
  /** Hop between frames (samples). 256 @ 8 kHz = 32 ms → offset resolution. */
  hop: 256,
  /** Pre-emphasis coefficient — flattens spectral tilt, lifts consonants. */
  preEmphasis: 0.97,
  /** Peak-search band (Hz). Dialogue band; rejects rumble + HF mic hiss. */
  bandLoHz: 200,
  bandHiHz: 2200,

  // ── Peak picking (constellation) ────────────────────────────────────
  peak: {
    /** ± half-width of the frequency-axis local-max window (bins). */
    freqNeighborhood: 15,
    /** ± half-width of the time-axis local-max window (frames). */
    timeNeighborhood: 3,
    /** Density cap: strongest N peaks kept per 1-second block. */
    targetPeaksPerSec: 24,
    /** Absolute reject floor (dB) below which a bin is never a peak. */
    floorDb: -60,
  },

  // ── Landmark pairing (anchor → target zone, fan-out) ────────────────
  pair: {
    /** Max target peaks paired per anchor. */
    fanOut: 8,
    /** Min/max anchor→target time gap (frames). maxDt=63 fits in 6 bits. */
    minDt: 1,
    maxDt: 63,
    /** Skip a target whose frequency is farther than this (bins) from anchor. */
    maxDf: 128,
  },

  // ── Match / lock gating ─────────────────────────────────────────────
  match: {
    /** Minimum agreeing landmarks in the peak offset bin to consider a lock. */
    lockCount: 5,
    /** Peak-bin count / runner-up count. Sharpness of the histogram peak. */
    lockProminence: 2.0,
    /** Minimum fraction of query landmarks that must agree on the offset. */
    lockMatchedFraction: 0.02,
    /** ± frames merged into the peak bin to absorb sub-hop jitter. */
    smoothingFrames: 1,
    /** Consecutive locking windows required before the live loop declares LOCKED. */
    consecutiveWindows: 2,
  },
} as const;

/** Seconds represented by one frame hop. */
export const HOP_SECONDS = FP.hop / FP.sampleRate;

/** Hz represented by one FFT bin. */
export const BIN_HZ = FP.sampleRate / FP.nfft;

/** Number of usable magnitude bins (0 … nfft/2). */
export const SPECTRUM_BINS = FP.nfft / 2 + 1;

/** Inclusive lower/upper bin index of the peak-search band. */
export const BAND_LO_BIN = Math.max(1, Math.floor(FP.bandLoHz / BIN_HZ));
export const BAND_HI_BIN = Math.min(FP.nfft / 2, Math.ceil(FP.bandHiHz / BIN_HZ));

/** Convert a frame index to seconds (start of that frame's hop). */
export function framesToSeconds(frames: number): number {
  return frames * HOP_SECONDS;
}

/** Convert seconds to the nearest frame index. */
export function secondsToFrames(seconds: number): number {
  return Math.round(seconds / HOP_SECONDS);
}
