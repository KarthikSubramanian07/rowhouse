/** Browser-side API client. Always same-origin (/api/*) so cookies flow. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.message ?? body.error ?? code;
    } catch {
      /* ignore */
    }
    throw new Error(code);
  }
  return (await res.json()) as T;
}

export const apiRaw = (path: string, init?: RequestInit) =>
  fetch(`/api${path}`, { credentials: 'same-origin', ...init });
