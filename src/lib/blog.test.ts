import { describe, expect, it } from 'vitest';
import { byDateDesc, readingMinutes } from './blog';

describe('blog helpers', () => {
  it('reading time: 200 words a minute, at least one', () => {
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(readingMinutes('word '.repeat(500))).toBe(3);
    expect(readingMinutes('one two')).toBe(1);
  });

  it('ignores code blocks and markdown symbols', () => {
    const code = '```\n' + 'x '.repeat(1000) + '\n```';
    expect(readingMinutes(`${'word '.repeat(200)}\n${code}\n## # * |`)).toBe(1);
  });

  it('skips MDX imports and components', () => {
    const mdx = `import X from './x';
${'word '.repeat(200)}
<Table caption="${'a '.repeat(500)}" rows={[1, 2]} />`;
    expect(readingMinutes(mdx)).toBe(1);
    expect(
      readingMinutes(`<InShort>
${'word '.repeat(400)}
</InShort>`),
    ).toBe(2);
  });

  it('sorts newest first', () => {
    const a = { data: { date: new Date('2026-01-01') } };
    const b = { data: { date: new Date('2026-03-01') } };
    expect([a, b].sort(byDateDesc)).toEqual([b, a]);
  });
});
