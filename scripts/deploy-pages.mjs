/**
 * Publish the preview to GitHub Pages: https://navinbhaskar.github.io/capitalverdict/
 *
 *   npm run build:pages    build dist/ for the sub-path only
 *   npm run deploy:pages   build, then force-push dist/ to the gh-pages branch of origin
 *
 * The gh-pages branch holds build output only; its history is replaced on every deploy.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const OWNER = 'navinbhaskar';
const REPO = 'capitalverdict';
const env = { ...process.env, SITE_URL: `https://${OWNER}.github.io` };
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', env, ...opts });

// npx is a .cmd script on Windows, which needs a shell; every other call stays shell-free.
run('npx', ['astro', 'build'], { shell: process.platform === 'win32' });
run('node', ['scripts/pages-base.mjs', REPO]);
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
git('commit', '-q', '-m', `Preview build of ${commit}`);
git('push', '-q', '--force', remote, 'gh-pages');
rmSync('dist/.git', { recursive: true, force: true });
console.log(`Deployed ${commit}: https://${OWNER}.github.io/${REPO}/`);
