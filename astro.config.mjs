// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// TODO_VERIFY: production domain not decided yet. Set SITE_URL at build time.
const site = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    preact(),
    // Guides are MDX so they can hold tables, charts and small calculators.
    mdx(),
    // Hindi is paused: only English pages are built. Re-add 'hi' here and in
    // PUBLISHED_LOCALES (src/i18n/routes.ts) when the Hindi copy is ready.
    sitemap(),
  ],
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
