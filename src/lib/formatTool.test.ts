import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatPercent, formatRupeesPrecise } from './formatTool';

describe('tool formatting', () => {
  it('formatNumber', () => {
    expect(formatNumber(59400)).toBe('59,400');
    expect(formatNumber(25.3012, 1)).toBe('25.3');
    expect(formatNumber(930.33)).toBe('930');
  });

  it('formatRupeesPrecise', () => {
    expect(formatRupeesPrecise(101.86 / 18)).toBe('₹5.66');
    expect(formatRupeesPrecise(120.5747)).toBe('₹120.57');
  });

  it('formatMoney switches to lakh at ₹1 lakh', () => {
    expect(formatMoney(3557.15)).toBe('₹3,557');
    expect(formatMoney(206236)).toBe('₹2.06 lakh');
    expect(formatMoney(-72518)).toBe('−₹72,518');
  });

  it('formatPercent', () => {
    expect(formatPercent(0.09)).toBe('9%');
    expect(formatPercent(0.065)).toBe('6.5%');
  });
});
