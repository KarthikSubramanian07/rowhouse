import { describe, expect, it } from 'vitest';
import { AppError, requireBucket } from '../src/lib/http.js';

describe('requireBucket', () => {
  it('returns the bucket when R2 is bound', () => {
    const bucket = {} as R2Bucket;
    expect(requireBucket(bucket)).toBe(bucket);
  });

  it('fails with 503 storage_not_configured when R2 is not bound', () => {
    try {
      requireBucket(undefined);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(503);
      expect((err as AppError).code).toBe('storage_not_configured');
    }
  });
});
