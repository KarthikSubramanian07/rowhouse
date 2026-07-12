/**
 * @rowhouse/sync-engine — audio-to-position synchronization.
 *
 * The moat: given ~10 s of mic-captured film audio, find the exact reference
 * timeline offset the listener is at, using constellation-hash landmark matching
 * against a per-film fingerprint map. Pure, deterministic, dependency-free — runs
 * identically in the browser (listener), Node (fixtures) and Workers (map-gen).
 */

export {
  fftInPlace,
  preEmphasize,
  resample,
  type Spectrogram,
  spectrogram,
  toMono,
} from './dsp.js';
export {
  captureToFingerprint,
  fingerprint,
  type QueryFingerprint,
} from './fingerprint.js';
export { decodeHash, encodeHash, type Landmark, makeLandmarks } from './landmarks.js';
export {
  type LiveSyncOptions,
  LiveSyncSession,
  type LiveSyncState,
  type SyncStatus,
} from './live.js';
export { buildFingerprintMap, FingerprintMap } from './map.js';
export { type MatchResult, matchPcm, matchQuery } from './match.js';
export {
  BAND_HI_BIN,
  BAND_LO_BIN,
  BIN_HZ,
  FP,
  framesToSeconds,
  HOP_SECONDS,
  SPECTRUM_BINS,
  secondsToFrames,
} from './params.js';
export { type Peak, pickPeaks } from './peaks.js';
export {
  type AssembledTrack,
  assembleTrackFromSession,
  binReactions,
  type Chapter,
  type ClipCandidate,
  type ClipDetectionOptions,
  detectClipCandidates,
  REACTION_TYPES,
  type ReactionBin,
  type ReactionEvent,
  type ReactionType,
  reactionToWaveformX,
} from './reactions.js';
