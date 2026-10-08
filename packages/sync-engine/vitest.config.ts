import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Fingerprinting is CPU-bound; under a parallel CI run a heavy DSP test can
    // pass vitest's 5s default without anything being wrong.
    testTimeout: 20_000,
  },
});
