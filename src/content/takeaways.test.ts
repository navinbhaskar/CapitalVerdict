/**
 * A guide's listing-card figure must be a number the guide itself states, so the card never
 * says something the worked example does not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = 'src/content/blog';
const posts = readdirSync(dir)
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => {
    const text = readFileSync(`${dir}/${f}`, 'utf-8');
    const [, front = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? [];
    const figure = /^ {2}figure: '(.+)'$/m.exec(front)?.[1];
    const kind = /^kind: (\w+)$/m.exec(front)?.[1];
    return { f, body, figure, kind };
  });

describe('guide takeaways', () => {
  it('every decision guide has one', () => {
    for (const p of posts.filter((p) => p.kind === 'decision')) expect(p.figure, p.f).toBeTruthy();
  });

  it.each(posts.filter((p) => p.figure))('$f states its figure in the text', (p) => {
    expect(p.body).toContain(p.figure!);
  });
});
