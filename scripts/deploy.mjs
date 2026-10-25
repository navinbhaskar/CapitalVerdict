/**
 * Publish the site to Cloudflare: https://capitalverdict.com
 * A Worker with static assets (wrangler.jsonc) serves dist/ on the domain and www; Cloudflare
 * redirects www and http to https://capitalverdict.com (a redirect rule and "Always Use HTTPS").
 *
 *   npm run build:site   build dist/ for the domain only
 *   npm run deploy       build, then upload dist/ with Wrangler
 *
 * Search engines may index the site (its own robots.txt, with the sitemap). Pass --block-indexing
 * to publish a robots.txt that blocks them instead.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOMAIN = 'capitalverdict.com';
const env = { ...process.env, SITE_URL: `https://${DOMAIN}` };
// npx is a .cmd script on Windows, which needs a shell.
const npx = (...args) =>
  execFileSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
const indexing = !process.argv.includes('--block-indexing');

npx('astro', 'build');
if (!indexing) writeFileSync(join('dist', 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Built for https://${DOMAIN}/ (indexing ${indexing ? 'allowed' : 'blocked'}).`);
if (process.argv.includes('--build-only')) process.exit(0);

npx('wrangler', 'deploy');
console.log(`Deployed: https://${DOMAIN}/`);
