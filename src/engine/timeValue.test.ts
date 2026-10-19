import { describe, expect, it } from 'vitest';
import {
  effectiveToMonthly,
  fv,
  fvAnnuity,
  nominalRate,
  nominalToMonthly,
  pv,
  realRate,
  toTodaysRupees,
  yearlySteppedPrice,
} from './timeValue';

// Reference values were computed by hand / plain arithmetic, independent of this module.

describe('rate conversion', () => {
  it('nominal 9% p.a. → 0.75% a month', () => {
    expect(nominalToMonthly(0.09)).toBeCloseTo(0.0075, 12);
  });

  it('effective 12% p.a. → 0.948879% a month, and back', () => {
    const m = effectiveToMonthly(0.12);
    expect(m).toBeCloseTo(0.00948879, 8);
    expect(Math.pow(1 + m, 12) - 1).toBeCloseTo(0.12, 12);
  });
});

describe('fv / pv', () => {
  it('₹1,00,000 at 10% for 10 years → ₹2,59,374.25', () => {
    expect(fv(100000, 0.1, 10)).toBeCloseTo(259374.246, 2);
  });

  it('pv undoes fv', () => {
    expect(pv(259374.246, 0.1, 10)).toBeCloseTo(100000, 2);
  });

  it('zero periods returns the same amount', () => {
    expect(fv(5000, 0.2, 0)).toBe(5000);
  });
});

describe('fvAnnuity', () => {
  it('₹1,000 a month at 1% a month for 12 months → ₹12,682.50', () => {
    expect(fvAnnuity(1000, 0.01, 12)).toBeCloseTo(12682.503, 2);
  });

  it('annuity due earns one extra period', () => {
    expect(fvAnnuity(1000, 0.01, 12, true)).toBeCloseTo(12682.503 * 1.01, 2);
  });

  it('zero rate is plain sum', () => {
    expect(fvAnnuity(1000, 0, 12)).toBe(12000);
  });
});

describe('real ↔ nominal', () => {
  it('10% nominal with 6% inflation → 3.7736% real (not 4%)', () => {
    expect(realRate(0.1, 0.06)).toBeCloseTo(0.037736, 6);
  });

  it('round-trips', () => {
    expect(nominalRate(realRate(0.1, 0.06), 0.06)).toBeCloseTo(0.1, 12);
  });

  it('₹1,06,000 one year out at 6% inflation is ₹1,00,000 today', () => {
    expect(toTodaysRupees(106000, 0.06, 12)).toBeCloseTo(100000, 6);
  });
});

describe('yearlySteppedPrice', () => {
  it('steps once every 12 months', () => {
    expect(yearlySteppedPrice(100, 0.05, 1)).toBe(100);
    expect(yearlySteppedPrice(100, 0.05, 12)).toBe(100);
    expect(yearlySteppedPrice(100, 0.05, 13)).toBeCloseTo(105, 10);
    expect(yearlySteppedPrice(100, 0.05, 25)).toBeCloseTo(110.25, 10);
  });

  it('rejects month 0', () => {
    expect(() => yearlySteppedPrice(100, 0.05, 0)).toThrow(RangeError);
  });
});
