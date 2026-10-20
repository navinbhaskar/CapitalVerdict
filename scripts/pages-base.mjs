/**
 * GitHub Pages preview: the site is served from a sub-path (https://USER.github.io/REPO/), but
 * every link in the build is root-relative. This rewrites dist/ in place so links, assets and
 * absolute URLs carry the sub-path, and blocks indexing (robots.txt) while the copy is a draft.
 *
 * Run through scripts/deploy-pages.mjs (npm run build:pages / deploy:pages).
 *
 * Not used for the real domain, which serves from the root.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = `/${(process.argv[2] ?? '').replace(/^\/+|\/+$/g, '')}`;
if (!/^\/[\w.-]+$/.test(base)) {
  console.error('Usage: node scripts/pages-base.mjs repo-name');
  process.exit(1);
}
const origin = (process.env.SITE_URL ?? '').replace(/\/+$/, '');
if (!/^https:\/\//.test(origin)) {
  console.error('SITE_URL must be the https origin the build used');
  process.exit(1);
}

const dist = 'dist';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const top = readdirSync(dist).map(escape).join('|');
// "/guides/…", "/_astro/…", "/favicon.svg" after a quote, bracket, "=", "," or space.
const known = new RegExp(`(["'\`(=,\\s])/(?=(?:${top})(?:[/"'\`?#)\\s,]|$))`, 'g');
// "/", "/#tools", "/?x" in markup only (in JS a bare "/" may be anything).
const bare = /((?:href|src|action|content)=")\/(?=[#?"])/g;
const absolute = new RegExp(`${escape(origin)}/(?!${escape(base.slice(1))}/)`, 'g');

const textFile = /\.(html|xml|css|js|mjs|json|webmanifest|txt)$/;
let changed = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (textFile.test(name)) {
      const before = readFileSync(path, 'utf-8');
      let after = before.replace(absolute, `${origin}${base}/`).replace(known, `$1${base}/`);
      if (/\.(html|xml)$/.test(name)) after = after.replace(bare, `$1${base}/`);
      if (after !== before) {
        writeFileSync(path, after);
        changed++;
      }
    }
  }
};
walk(dist);
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
// Pages would otherwise run Jekyll, which drops folders starting with "_" (such as _astro).
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Rewrote ${changed} files for ${origin}${base}/ (indexing blocked).`);
