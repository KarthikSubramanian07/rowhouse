import { encodeBase32LowerCaseNoPadding } from '@oslojs/encoding';

/** URL/DB-safe random id with a short type prefix, e.g. "trk_9x3k…". */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(15); // 120 bits
  crypto.getRandomValues(bytes);
  return `${prefix}_${encodeBase32LowerCaseNoPadding(bytes)}`;
}

/** Raw random token component (base32, no padding). */
export function randomToken(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return encodeBase32LowerCaseNoPadding(b);
}
