import { describe, expect, it } from 'vitest';
import { displayBounds, formatNumberText, parseNumberText } from './numberInput';

const money = { min: 0, max: 5_000_000 };
const pct = { min: 0, max: 0.3, percent: true };

describe('parseNumberText', () => {
  it('reads plain and Indian-grouped numbers', () => {
    expect(parseNumberText('90000', money)).toEqual({ ok: true, value: 90000 });
    expect(parseNumberText('90,000', money)).toEqual({ ok: true, value: 90000 });
    expect(parseNumberText('1,00,000', money)).toEqual({ ok: true, value: 100000 });
    expect(parseNumberText('₹ 1,000.50', money)).toEqual({ ok: true, value: 1000.5 });
  });

  it('treats a lone comma as a decimal mark', () => {
    expect(parseNumberText('101,86', { min: 0, max: 1000 })).toEqual({ ok: true, value: 101.86 });
  });

  it('converts percent fields to decimals without float noise', () => {
    expect(parseNumberText('9', pct)).toEqual({ ok: true, value: 0.09 });
    expect(parseNumberText('7.3 %', pct)).toEqual({ ok: true, value: 0.073 });
  });

  it('reports why input is rejected', () => {
    expect(parseNumberText('', money)).toEqual({ ok: false, reason: 'required' });
    expect(parseNumberText('abc', money)).toEqual({ ok: false, reason: 'notANumber' });
    expect(parseNumberText('-5', money)).toEqual({ ok: false, reason: 'notANumber' });
    expect(parseNumberText('1e5', money)).toEqual({ ok: false, reason: 'notANumber' });
    expect(parseNumberText('31', pct)).toEqual({ ok: false, reason: 'outOfRange' });
    expect(parseNumberText('2.5', { min: 1, max: 20, integer: true })).toEqual({
      ok: false,
      reason: 'notInteger',
    });
  });

  it('allows empty optional fields', () => {
    expect(parseNumberText(' ', { ...money, optional: true })).toEqual({ ok: true, value: null });
  });
});

describe('formatNumberText / displayBounds', () => {
  it('groups rupees the Indian way and shows percents', () => {
    expect(formatNumberText(100000, {})).toBe('1,00,000');
    expect(formatNumberText(101.86, {})).toBe('101.86');
    expect(formatNumberText(0.09, { percent: true })).toBe('9');
    expect(formatNumberText(null, {})).toBe('');
  });

  it('round-trips through parse', () => {
    for (const v of [0, 1800, 90000, 1234567.5]) {
      expect(parseNumberText(formatNumberText(v, {}), { min: 0, max: 1e7 })).toEqual({
        ok: true,
        value: v,
      });
    }
  });

  it('formats bounds for error messages', () => {
    expect(displayBounds(money)).toEqual({ min: '0', max: '50,00,000' });
    expect(displayBounds(pct)).toEqual({ min: '0%', max: '30%' });
  });
});
