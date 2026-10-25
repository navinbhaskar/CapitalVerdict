import { describe, expect, it } from 'vitest';
import { annualise, irr, npv } from './irr';

describe('npv', () => {
  it('discounts each flow by its period', () => {
    // -100 + 110/1.1 = 0
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
    expect(npv(0, [-100, 30, 30])).toBe(-40);
  });
});

describe('irr', () => {
  it('one period: −100 then 110 → 10%', () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 9);
  });

  it('−1,000 then 500 × 3 → 23.3752%', () => {
    // Check: 500/1.233752 + 500/1.233752² + 500/1.233752³ = 1,000.00
    expect(irr([-1000, 500, 500, 500])).toBeCloseTo(0.23375193, 7);
  });

  it('returns null when the flows never change sign', () => {
    expect(irr([100, 100])).toBeNull();
    expect(irr([-100, -5])).toBeNull();
  });
});

describe('annualise', () => {
  it('1% a month → 12.6825% a year', () => {
    expect(annualise(0.01)).toBeCloseTo(0.12682503, 8);
  });
});

describe('irr over long series', () => {
  it('finds the rate across 420 months, where (1 − 0.99)ⁿ underflows', () => {
    const i = 0.005;
    // ₹1 lakh now, then 420 equal monthly payments worked out at 0.5% a month.
    const payment = (100_000 * i) / (1 - Math.pow(1 + i, -420));
    expect(irr([-100_000, ...Array<number>(420).fill(payment)])).toBeCloseTo(i, 10);
  });
});
