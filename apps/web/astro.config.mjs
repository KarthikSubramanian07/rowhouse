import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://rowhouse-gg.pages.dev',
  // SSR on Cloudflare Pages; data-driven pages fetch the API server-side so film
  // pages render indexable HTML. Static pages opt in with `export const prerender = true`.
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  vite: {
    plugins: [tailwind()],
    ssr: {
      // Workspace packages ship TS source — let Vite transform them.
      noExternal: ['@rowhouse/ui', '@rowhouse/types', '@rowhouse/sync-engine'],
    },
  },
});
