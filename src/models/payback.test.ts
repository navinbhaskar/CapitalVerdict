import { describe, expect, it } from 'vitest';
import { payback } from './payback';

describe('payback', () => {
  it('₹90,000 extra, ₹2,778 a month: about 32 months, 46 with 9% interest', () => {
    const r = payback(90_000, 2_778, 0.09);
    expect(r.noInterest!.month).toBe(33);
    expect(Math.round(r.noInterest!.fractionalMonth)).toBe(32);
    expect(r.withInterest!.month).toBe(46);
    expect(Math.round(r.owed[46]! / 100) * 100).toBe(126_900);
  });

  it('no interest: both answers agree', () => {
    const r = payback(12_000, 1_000, 0);
    expect(r.noInterest!.month).toBe(12);
    expect(r.withInterest!.month).toBe(12);
  });

  it('never, when interest outruns the saving', () => {
    expect(payback(1_000_000, 5_000, 0.09).withInterest).toBeNull();
  });

  it('rejects negatives', () => {
    expect(() => payback(-1, 100, 0.09)).toThrow(RangeError);
  });
});
