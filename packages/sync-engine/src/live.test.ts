import { describe, expect, it } from 'vitest';
import { LiveSyncSession } from './live.js';
import { buildReferenceFixture, PROFILES, simulateCapture } from './testing/index.js';

const ref = buildReferenceFixture(90, 42);
const SR = 8000;

/** Feed a continuous capture into a session in 1 s chunks; report time-to-lock. */
function streamUntilLock(startOffset: number, profileName: keyof typeof PROFILES, maxSeconds = 12) {
  const capture = simulateCapture(ref.pcm, startOffset, maxSeconds, PROFILES[profileName]);
  const session = new LiveSyncSession(ref.map);
  const chunk = SR; // 1 s
  let lockedAt: number | null = null;
  for (let i = 0; i + chunk <= capture.length; i += chunk) {
    const state = session.pushCapture(capture.subarray(i, i + chunk), SR);
    if (state.status === 'locked' && lockedAt === null) {
      lockedAt = state.audioClockSeconds;
      break;
    }
  }
  return { session, lockedAt };
}

describe('LiveSyncSession — sliding-window lock', () => {
  it('locks within a few seconds in a living room and tracks position', () => {
    const { session, lockedAt } = streamUntilLock(30, 'livingRoom');
    expect(lockedAt).not.toBeNull();
    expect(lockedAt!).toBeLessThanOrEqual(8);
    // Once locked, the reported position corresponds to 30s + elapsed audio.
    const s = session.state;
    expect(s.positionSeconds).toBeCloseTo(30 + s.audioClockSeconds, 0);
    // eslint-disable-next-line no-console
    console.log(
      `[sync-live] livingRoom time-to-lock=${lockedAt}s anchor=${s.anchorSeconds.toFixed(2)}s`,
    );
  });

  it('locks under clean conditions quickly', () => {
    const { lockedAt } = streamUntilLock(12.5, 'clean');
    expect(lockedAt).not.toBeNull();
    expect(lockedAt!).toBeLessThanOrEqual(6);
  });

  it('predicts future positions from the audio clock once locked', () => {
    const { session } = streamUntilLock(47.3, 'livingRoom');
    const now = session.state;
    // Reference advances 1:1 with the audio clock after locking.
    expect(session.positionAt(now.audioClockSeconds + 5)).toBeCloseTo(now.positionSeconds + 5, 3);
  });

  it('resync clears the lock and re-enters search', () => {
    const { session } = streamUntilLock(30, 'clean');
    expect(session.state.status).toBe('locked');
    session.resync();
    // Lock dropped; the audio clock (film position) keeps running so a fresh
    // match re-anchors relative to it.
    expect(session.state.status).toBe('idle');
    expect(session.state.anchorSeconds).toBe(0);
  });
});
