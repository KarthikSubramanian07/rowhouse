import { describe, expect, it } from 'vitest';
import { buildLlmsTxt } from '../src/lib/agent/llms';

const txt = buildLlmsTxt();
const lines = txt.split('\n');

describe('llms.txt (llmstxt.org format)', () => {
  it('opens with the H1 name and a blockquote summary', () => {
    expect(lines[0]).toBe('# Rowhouse');
    expect(lines[1]).toBe('');
    expect(lines[2]?.startsWith('> ')).toBe(true);
  });

  it('uses only H2 headings after the H1, and no headings in the free-form part', () => {
    const headings = lines.filter((l) => l.startsWith('#'));
    expect(headings[0]).toBe('# Rowhouse');
    for (const h of headings.slice(1)) expect(h).toMatch(/^## \S/);
  });

  it('has a "When to use" section whose entries are spec-style link lists', () => {
    const start = lines.indexOf('## When to use Rowhouse');
    expect(start).toBeGreaterThan(0);
    const section = lines.slice(
      start + 1,
      lines.findIndex((l, i) => i > start && l.startsWith('## ')),
    );
    const items = section.filter((l) => l.startsWith('- '));
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) expect(item).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\): use when /);
  });

  it('documents the read-only JSON API', () => {
    expect(txt).toContain('## JSON API');
    expect(txt).toContain('(https://rowhouse-gg.pages.dev/api/films/catalog)');
    expect(txt).toContain('`GET /api/films/{slug}`');
  });

  it('tells agents how to request Markdown', () => {
    expect(txt).toContain('Accept: text/markdown');
  });

  it('links only to absolute https URLs', () => {
    const urls = [...txt.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) expect(u).toMatch(/^https:\/\//);
  });
});
