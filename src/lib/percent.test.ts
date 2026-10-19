import { describe, expect, it } from 'vitest';
import { parsePercent, toPercentText } from './percent';

describe('toPercentText', () => {
  it('formats without float noise', () => {
    expect(toPercentText(0.065)).toBe('6.5');
    expect(toPercentText(0.07)).toBe('7');
    expect(toPercentText(0.1)).toBe('10');
    expect(toPercentText(0)).toBe('0');
    expect(toPercentText(null)).toBe('');
  });
});

describe('parsePercent', () => {
  it('parses plain, comma and % forms', () => {
    expect(parsePercent('6.5', 0.2, false)).toEqual({ ok: true, value: 0.065 });
    expect(parsePercent('6,5', 0.2, false)).toEqual({ ok: true, value: 0.065 });
    expect(parsePercent(' 7 % ', 0.2, false)).toEqual({ ok: true, value: 0.07 });
    expect(parsePercent('.5', 0.2, false)).toEqual({ ok: true, value: 0.005 });
  });

  it('handles empty input', () => {
    expect(parsePercent('', 0.2, true)).toEqual({ ok: true, value: null });
    expect(parsePercent('  ', 0.2, false)).toEqual({ ok: false, reason: 'notANumber' });
  });

  it('rejects junk and negatives', () => {
    expect(parsePercent('abc', 0.2, false)).toEqual({ ok: false, reason: 'notANumber' });
    expect(parsePercent('-3', 0.2, false)).toEqual({ ok: false, reason: 'notANumber' });
    expect(parsePercent('1e2', 0.2, false)).toEqual({ ok: false, reason: 'notANumber' });
  });

  it('enforces the maximum, inclusive', () => {
    expect(parsePercent('20', 0.2, false)).toEqual({ ok: true, value: 0.2 });
    expect(parsePercent('20.1', 0.2, false)).toEqual({ ok: false, reason: 'outOfRange' });
  });
});
