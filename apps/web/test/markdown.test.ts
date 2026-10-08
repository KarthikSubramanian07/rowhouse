import { describe, expect, it } from 'vitest';
import { notFoundMarkdown, pageToMarkdown } from '../src/lib/agent/markdown';

const page = `<!doctype html><html lang="en"><head>
<title>How Rowhouse sync works</title>
<meta name="description" content="Ten seconds of listening.">
<link rel="canonical" href="https://rowhouse-gg.pages.dev/about">
</head><body>
<header><nav><a href="/discover">Discover</a></nav></header>
<main>
  <h1>Ten seconds <span aria-hidden="true">|||</span>of listening</h1>
  <p>Read <a href="/live">who's live</a> or <a href="https://example.com/x">elsewhere</a>.</p>
  <astro-island><div>hydrated widget</div></astro-island>
  <script>window.secret = 1</script>
  <style>.x{color:red}</style>
  <ul><li>One</li><li>Two</li></ul>
</main>
<footer>footer chrome</footer>
</body></html>`;

describe('pageToMarkdown', () => {
  const md = pageToMarkdown(page, 'https://rowhouse-gg.pages.dev/about?x=1');

  it('emits YAML front matter with title, description, and canonical url', () => {
    expect(md.startsWith('---\ntitle: "How Rowhouse sync works"\n')).toBe(true);
    expect(md).toContain('description: "Ten seconds of listening."');
    expect(md).toContain('url: "https://rowhouse-gg.pages.dev/about"');
  });

  it('converts only <main>, dropping chrome, scripts, islands, and decoration', () => {
    expect(md).toContain('# Ten seconds of listening');
    expect(md).toContain('- One');
    for (const junk of ['footer chrome', 'window.secret', 'color:red', 'hydrated widget', '|||']) {
      expect(md).not.toContain(junk);
    }
  });

  it('absolutizes site-relative links and leaves external ones alone', () => {
    expect(md).toContain("[who's live](https://rowhouse-gg.pages.dev/live)");
    expect(md).toContain('[elsewhere](https://example.com/x)');
  });

  it('keeps adjacent inline links apart even when the HTML is minified', () => {
    const tight = pageToMarkdown(
      '<main><div><a href="/a">A</a><a href="/b">B</a></div></main>',
      'https://rowhouse-gg.pages.dev/',
    );
    expect(tight).toContain(
      '[A](https://rowhouse-gg.pages.dev/a) [B](https://rowhouse-gg.pages.dev/b)',
    );
  });

  it('ends with pointers to llms.txt and the sitemap', () => {
    expect(md).toContain('(https://rowhouse-gg.pages.dev/llms.txt)');
    expect(md).toContain('(https://rowhouse-gg.pages.dev/sitemap.xml)');
  });

  it('escapes front matter values that contain quotes', () => {
    const tricky = page.replace('How Rowhouse sync works', 'He said "hi"\nnext: line');
    expect(pageToMarkdown(tricky, 'https://rowhouse-gg.pages.dev/')).toContain(
      'title: "He said \\"hi\\"\\nnext: line"',
    );
  });
});

describe('notFoundMarkdown', () => {
  it('explains the error and links to llms.txt and the sitemap', () => {
    const md = notFoundMarkdown('/nope');
    expect(md).toContain('# 404: page not found');
    expect(md).toContain('`/nope`');
    expect(md).toContain('https://rowhouse-gg.pages.dev/llms.txt');
    expect(md).toContain('https://rowhouse-gg.pages.dev/sitemap.xml');
    expect(md.length).toBeGreaterThan(200);
  });

  it('cannot be broken out of the inline code span by the path', () => {
    const md = notFoundMarkdown('/a`](javascript:x)\n# injected');
    expect(md).toContain('`/a](javascript:x)# injected`');
    expect(md).not.toMatch(/^# injected/m);
  });
});
