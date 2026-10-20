import type { APIRoute } from 'astro';

/** robots.txt pointing at the sitemap on whatever domain the site is built for (SITE_URL). */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
