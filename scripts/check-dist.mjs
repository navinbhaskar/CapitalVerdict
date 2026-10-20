/**
 * After a production build: no draft markers or development addresses in any page, feed or sitemap.
 * Run by `npm run build:prod`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['TODO_COPY', 'TODO_VERIFY', 'example.invalid', 'localhost:4321'];
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(html|xml|txt)$/.test(entry.name)) files.push(path);
  }
};
walk('dist');

const hits = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const marker of MARKERS) if (text.includes(marker)) hits.push(`${file}: ${marker}`);
}
if (hits.length > 0) {
  console.error(`Draft or development text in the build:\n- ${hits.join('\n- ')}`);
  process.exit(1);
}
console.log(`Checked ${files.length} files: no draft markers or development addresses.`);
