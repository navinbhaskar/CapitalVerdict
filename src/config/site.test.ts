import { describe, expect, it } from 'vitest';
import { reportErrorHref } from './site';

describe('report-an-error link', () => {
  it('is hidden without a contact address', () => {
    expect(reportErrorHref('https://example.com/x', null)).toBeNull();
  });

  it('prefills the page address', () => {
    const href = reportErrorHref('https://example.com/tools/solar/', 'help@example.com')!;
    expect(href.startsWith('mailto:help@example.com?subject=Error%20report&body=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Page: https://example.com/tools/solar/');
  });
});
