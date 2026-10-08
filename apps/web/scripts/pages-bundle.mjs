#!/usr/bin/env node
/**
 * Package the Astro build for Cloudflare Pages.
 *
 * @astrojs/cloudflare v13+ emits a Workers-with-assets layout (dist/client for
 * static files, dist/server for the Worker). Pages instead wants one output
 * directory holding the static files plus an advanced-mode `_worker.js/`
 * module directory. This assembles dist/pages that way, so the site keeps its
 * rowhouse-gg.pages.dev URL. Pages supplies the same `env.ASSETS` binding the
 * Worker expects.
 */
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, 'dist/client');
const server = join(root, 'dist/server');
const out = join(root, 'dist/pages');

for (const dir of [client, server]) {
  if (!existsSync(dir)) {
    console.error(`pages-bundle: missing ${dir}; run \`astro build\` first.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
cpSync(client, out, { recursive: true });
cpSync(server, join(out, '_worker.js'), {
  recursive: true,
  filter: (src) => !src.endsWith('wrangler.json'),
});
writeFileSync(join(out, '_worker.js/index.js'), "export { default } from './entry.mjs';\n");

// Hashed build assets never need the Worker; everything else does, so pages
// get content negotiation and security headers from the middleware.
writeFileSync(
  join(out, '_routes.json'),
  `${JSON.stringify({ version: 1, include: ['/*'], exclude: ['/_astro/*'] }, null, 2)}\n`,
);

console.log(`pages-bundle: wrote ${out}`);
