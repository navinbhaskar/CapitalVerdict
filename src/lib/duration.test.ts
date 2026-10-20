import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('years and months in words', () => {
    expect(formatDuration('en', 46)).toBe('3 years 10 months');
    expect(formatDuration('en', 12)).toBe('1 year');
    expect(formatDuration('en', 13)).toBe('1 year 1 month');
    expect(formatDuration('en', 7)).toBe('7 months');
    expect(formatDuration('en', 1)).toBe('1 month');
    expect(formatDuration('en', 0)).toBe('0 months');
    expect(formatDuration('en', 86)).toBe('7 years 2 months');
  });
});
