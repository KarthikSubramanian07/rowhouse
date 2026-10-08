import { describe, expect, it } from 'vitest';
import { negotiateResponse } from '../src/lib/agent/respond';

const SITE = 'https://rowhouse-gg.pages.dev';
const HTML =
  '<html><head><title>Home | Rowhouse</title></head><body><main><h1>Hello agents</h1></main></body></html>';

function html(status = 200): Response {
  return new Response(HTML, { status, headers: { 'Content-Type': 'text/html' } });
}
function req(path: string, accept?: string, method = 'GET'): Request {
  return new Request(`${SITE}${path}`, { method, headers: accept ? { accept } : {} });
}

describe('negotiateResponse', () => {
  it('serves HTML to browsers, with Vary: Accept', async () => {
    const res = await negotiateResponse(req('/', 'text/html'), html());
    expect(res.headers.get('content-type')).toBe('text/html');
    expect(res.headers.get('vary')).toBe('Accept');
    expect(await res.text()).toBe(HTML);
  });

  it('serves Markdown for Accept: text/markdown on the same URL', async () => {
    const res = await negotiateResponse(req('/', 'text/markdown'), html());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('vary')).toBe('Accept');
    const body = await res.text();
    expect(body).toContain('# Hello agents');
    expect(body).toContain('title: "Home | Rowhouse"');
  });

  it('keeps 404 status and returns a Markdown error body', async () => {
    const res = await negotiateResponse(req('/missing', 'text/markdown'), html(404));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('404');
    expect(body).toContain(`${SITE}/llms.txt`);
  });

  it('answers 406 when neither HTML nor Markdown is acceptable', async () => {
    const res = await negotiateResponse(req('/', 'application/json'), html());
    expect(res.status).toBe(406);
    expect(res.headers.get('vary')).toBe('Accept');
    expect(await res.text()).toContain('text/markdown');
  });

  it('sends no body for HEAD but keeps the Markdown headers', async () => {
    const res = await negotiateResponse(req('/', 'text/markdown', 'HEAD'), html());
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(await res.text()).toBe('');
  });

  it('leaves the API proxy and non-HTML responses untouched', async () => {
    const api = await negotiateResponse(req('/api/films/catalog', 'application/json'), html(403));
    expect(api.status).toBe(403);
    expect(api.headers.get('vary')).toBeNull();

    const xml = new Response('<urlset/>', { headers: { 'Content-Type': 'application/xml' } });
    const out = await negotiateResponse(req('/sitemap.xml', 'text/markdown'), xml);
    expect(out.headers.get('content-type')).toBe('application/xml');
    expect(await out.text()).toBe('<urlset/>');
  });
});
