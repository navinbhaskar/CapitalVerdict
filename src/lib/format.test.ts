import { describe, expect, it } from 'vitest';
import { formatINR, formatLakhCrore } from './format';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(206236)).toBe('₹2,06,236');
    expect(formatINR(12500000)).toBe('₹1,25,00,000');
  });

  it('uses a true minus sign for negatives', () => {
    expect(formatINR(-72518)).toBe('−₹72,518');
  });

  it('rounds to the nearest rupee', () => {
    expect(formatINR(3557.15)).toBe('₹3,557');
    expect(formatINR(3557.5)).toBe('₹3,558');
  });
});

describe('formatLakhCrore', () => {
  it('formats lakh and crore', () => {
    expect(formatLakhCrore(206236)).toBe('₹2.06 lakh');
    expect(formatLakhCrore(12500000)).toBe('₹1.25 crore');
  });

  it('falls back to full rupees under one lakh', () => {
    expect(formatLakhCrore(90000)).toBe('₹90,000');
  });

  it('keeps the sign for losses', () => {
    expect(formatLakhCrore(-206236)).toBe('−₹2.06 lakh');
  });
});
