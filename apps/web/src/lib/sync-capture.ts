/**
 * Client-side mic capture to PCM chunks. The mic stream is turned into Float32
 * frames, handed to the sync engine, then discarded. Nothing is recorded or
 * uploaded. That is the legal invariant, enforced in the browser: film audio
 * never leaves the device.
 */
export interface Capture {
  sampleRate: number;
  stop: () => void;
}

/** Start capturing mic PCM, delivering ~mono Float32 chunks to `onChunk`. */
export async function startMicCapture(
  onChunk: (chunk: Float32Array, sampleRate: number) => void,
): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally available and sufficient for
  // grabbing raw PCM; an AudioWorklet is the modern upgrade path.
  const node = ctx.createScriptProcessor(4096, 1, 1);
  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    onChunk(Float32Array.from(input), ctx.sampleRate);
  };
  source.connect(node);
  node.connect(ctx.destination);

  return {
    sampleRate: ctx.sampleRate,
    stop: () => {
      node.disconnect();
      source.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    },
  };
}

/** Play a Float32 buffer through the speakers (the "film on your TV" in demos). */
export function playBuffer(
  pcm: Float32Array,
  sampleRate: number,
): { stop: () => void; ctx: AudioContext } {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
  buffer.getChannelData(0).set(pcm);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return {
    ctx,
    stop: () => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      void ctx.close();
    },
  };
}
