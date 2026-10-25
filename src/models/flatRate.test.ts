import { describe, expect, it } from 'vitest';
import { emi } from '@/engine/loan';
import { flatToReducing } from './flatRate';

describe('flatToReducing', () => {
  it('a flat 5% over 5 years is about 9.15% on the reducing balance', () => {
    expect(flatToReducing(0.05, 5) * 100).toBeCloseTo(9.15, 2);
  });

  it('charges the same EMI as the flat quote: ₹16,667 on ₹8 lakh', () => {
    const real = flatToReducing(0.05, 5);
    expect(emi(800_000, real, 60)).toBeCloseTo((800_000 * 1.25) / 60, 2);
  });

  it('a nil flat rate is nil', () => {
    expect(flatToReducing(0, 3)).toBeCloseTo(0, 8);
  });

  it('rejects a bad term', () => {
    expect(() => flatToReducing(0.05, 0)).toThrow(RangeError);
  });
});
