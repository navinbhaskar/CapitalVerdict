import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { t } from '@/i18n/t';
import { byDateDesc } from '@/lib/blog';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** RSS 2.0 feed of the blog, on whatever domain the site is built for (SITE_URL). */
export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog')).sort(byDateDesc);
  const link = (path: string) => new URL(path, site).href;
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escape(p.data.title)}</title>
      <link>${link(`/blog/${p.id}/`)}</link>
      <guid>${link(`/blog/${p.id}/`)}</guid>
      <description>${escape(p.data.description)}</description>
      <pubDate>${p.data.date.toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escape(`${t('en', 'blog.title')}: ${t('en', 'site.name')}`)}</title>
    <link>${link('/blog/')}</link>
    <description>${escape(t('en', 'blog.description'))}</description>
    <language>en-in</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
