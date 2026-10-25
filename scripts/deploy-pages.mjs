/**
 * Publish the site to GitHub Pages on its own domain: https://capitalverdict.com
 * (DNS on Cloudflare points the domain at GitHub Pages; the CNAME file tells Pages which domain).
 *
 *   npm run build:pages    build dist/ for the domain only
 *   npm run deploy:pages   build, then force-push dist/ to the gh-pages branch of origin
 *
 * Search engines may index the site (its own robots.txt, with the sitemap). Pass --block-indexing
 * to publish a robots.txt that blocks them instead.
 *
 * The gh-pages branch holds build output only; its history is replaced on every deploy.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOMAIN = 'capitalverdict.com';
const env = { ...process.env, SITE_URL: `https://${DOMAIN}` };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, ...opts });
const indexing = !process.argv.includes('--block-indexing');

// npx is a .cmd script on Windows, which needs a shell; every other call stays shell-free.
run('npx', ['astro', 'build'], { shell: process.platform === 'win32' });
writeFileSync(join('dist', 'CNAME'), `${DOMAIN}\n`);
// Pages would otherwise run Jekyll, which drops folders starting with "_" (such as _astro).
writeFileSync(join('dist', '.nojekyll'), '');
if (!indexing) writeFileSync(join('dist', 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Built for https://${DOMAIN}/ (indexing ${indexing ? 'allowed' : 'blocked'}).`);
if (process.argv.includes('--build-only')) process.exit(0);

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf-8' }).trim();
const identity = ['user.name', 'user.email'].map((k) =>
  execFileSync('git', ['config', k], { encoding: 'utf-8' }).trim(),
);
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
rmSync('dist/.git', { recursive: true, force: true });
const git = (...args) => run('git', args, { cwd: 'dist' });
git('init', '-q', '-b', 'gh-pages');
git('config', 'core.autocrlf', 'false');
git('config', 'user.name', identity[0]);
git('config', 'user.email', identity[1]);
git('add', '-A');
git('commit', '-q', '-m', `Site build of ${commit}`);
git('push', '-q', '--force', remote, 'gh-pages');
rmSync('dist/.git', { recursive: true, force: true });
console.log(`Deployed ${commit}: https://${DOMAIN}/`);
