import { NOT_ACCEPTABLE_BODY, notFoundMarkdown, pageToMarkdown } from './markdown';
import { appendVaryAccept, preferredType } from './negotiate';

/** Routes that aren't pages: the API proxy and build assets pass through untouched. */
const EXEMPT = /^\/(api|_astro|_image)(\/|$)/;

/**
 * Serve the representation the client asked for. HTML pages gain `Vary: Accept`;
 * `Accept: text/markdown` gets the same URL as Markdown with the original status
 * (so a 404 stays a 404); a client that accepts neither gets 406.
 */
export async function negotiateResponse(request: Request, response: Response): Promise<Response> {
  const url = new URL(request.url);
  if (EXEMPT.test(url.pathname)) return response;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/html')) return response;

  const chosen = preferredType(request.headers.get('accept'));
  if (chosen === 'text/html') {
    appendVaryAccept(response.headers);
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  appendVaryAccept(headers);

  if (chosen === null) {
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(NOT_ACCEPTABLE_BODY, { status: 406, headers });
  }

  const html = await response.text();
  const markdown =
    response.status === 404 ? notFoundMarkdown(url.pathname) : pageToMarkdown(html, url.toString());
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  return new Response(request.method === 'HEAD' ? null : markdown, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
