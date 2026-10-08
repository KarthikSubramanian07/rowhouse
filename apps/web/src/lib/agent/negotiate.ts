/**
 * Accept-header content negotiation between HTML and Markdown, per RFC 9110
 * §12.5.1 and the acceptmarkdown.com recipe: q-values are honored, the most
 * specific matching range wins (so `text/html;q=0, *\/*` really rejects HTML),
 * `q=0` is an explicit rejection, and ties break on the client's order.
 */
export const PRODUCES = ['text/html', 'text/markdown'] as const;
export type Produced = (typeof PRODUCES)[number];

interface AcceptEntry {
  type: string;
  q: number;
  specificity: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const [first = '', ...params] = raw.split(';').map((s) => s.trim());
      const type = first.toLowerCase();
      let q = 1;
      for (const param of params) {
        const [name, value] = param.split('=').map((s) => s.trim());
        if (name?.toLowerCase() === 'q') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed));
        }
      }
      const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
      return { type, q, specificity };
    });
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === '*/*') return true;
  if (entry.type.endsWith('/*')) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/**
 * The representation to serve, or null when the client accepts neither (406).
 * A missing or empty header means "anything", which resolves to HTML.
 */
export function preferredType(header: string | null | undefined): Produced | null {
  if (!header?.trim()) return PRODUCES[0];
  const entries = parseAccept(header);
  if (entries.length === 0) return PRODUCES[0];

  let best: Produced | null = null;
  let bestQ = -1;
  let bestPosition = Number.POSITIVE_INFINITY;

  for (const candidate of PRODUCES) {
    let matched: AcceptEntry | null = null;
    let matchedPosition = Number.POSITIVE_INFINITY;
    entries.forEach((e, idx) => {
      if (!matches(e, candidate)) return;
      if (
        matched === null ||
        e.specificity > matched.specificity ||
        (e.specificity === matched.specificity && idx < matchedPosition)
      ) {
        matched = e;
        matchedPosition = idx;
      }
    });
    if (matched === null) continue;
    const q = (matched as AcceptEntry).q;
    if (q <= 0) continue;
    if (q > bestQ || (q === bestQ && matchedPosition < bestPosition)) {
      bestQ = q;
      bestPosition = matchedPosition;
      best = candidate;
    }
  }
  return best;
}

/** Add `Accept` to Vary without clobbering existing tokens. */
export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const tokens = existing.split(',').map((s) => s.trim().toLowerCase());
  if (!tokens.includes('accept') && !tokens.includes('*')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}
