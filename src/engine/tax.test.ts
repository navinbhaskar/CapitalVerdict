import { describe, expect, it } from 'vitest';
import {
  capitalGainsTax,
  findTaxTable,
  incomeTax,
  marginalRateWithCess,
  marginalSlabRate,
  postTaxRate,
  slabTax,
  validateSlabs,
  type TaxTable,
} from './tax';

// SYNTHETIC table for testing the mechanics only. These are NOT Indian tax rates.
const synthetic: TaxTable = {
  financialYear: 'TEST',
  regime: 'new',
  slabs: [
    { upTo: 200_000, rate: 0 },
    { upTo: 600_000, rate: 0.1 },
    { upTo: null, rate: 0.25 },
  ],
  cessRate: 0.05,
  source: 'synthetic test fixture',
  status: 'TODO_VERIFY',
};

describe('slabTax', () => {
  it('₹8,00,000: 0 + 4,00,000×10% + 2,00,000×25% = ₹90,000', () => {
    expect(slabTax(800_000, synthetic.slabs)).toBeCloseTo(90_000, 6);
  });

  it('income inside the first band is untaxed', () => {
    expect(slabTax(150_000, synthetic.slabs)).toBe(0);
  });

  it('income exactly on a bound', () => {
    expect(slabTax(600_000, synthetic.slabs)).toBeCloseTo(40_000, 6);
  });

  it('zero income', () => {
    expect(slabTax(0, synthetic.slabs)).toBe(0);
  });
});

describe('incomeTax with cess', () => {
  it('₹90,000 × 1.05 = ₹94,500', () => {
    expect(incomeTax(800_000, synthetic)).toBeCloseTo(94_500, 6);
  });
});

describe('marginal rate', () => {
  it('picks the band of the next rupee', () => {
    expect(marginalSlabRate(100_000, synthetic.slabs)).toBe(0);
    expect(marginalSlabRate(200_000, synthetic.slabs)).toBe(0.1);
    expect(marginalSlabRate(599_999, synthetic.slabs)).toBe(0.1);
    expect(marginalSlabRate(800_000, synthetic.slabs)).toBe(0.25);
  });

  it('includes cess: 25% × 1.05 = 26.25%', () => {
    expect(marginalRateWithCess(800_000, synthetic)).toBeCloseTo(0.2625, 12);
  });
});

describe('postTaxRate', () => {
  it('7% FD at 26.25% marginal → 5.1625%', () => {
    expect(postTaxRate(0.07, 0.2625)).toBeCloseTo(0.051625, 12);
  });
});

describe('capitalGainsTax', () => {
  const rule = { rate: 0.1, exemption: 100_000, cessRate: 0.05 };

  it('taxes only the gain above the exemption', () => {
    expect(capitalGainsTax(300_000, rule)).toBeCloseTo(21_000, 6);
  });

  it('is zero below the exemption and for losses', () => {
    expect(capitalGainsTax(50_000, rule)).toBe(0);
    expect(capitalGainsTax(-10_000, rule)).toBe(0);
  });
});

describe('validation and lookup', () => {
  it('rejects bad tables', () => {
    expect(() => validateSlabs([])).toThrow();
    expect(() => validateSlabs([{ upTo: 100, rate: 0 }])).toThrow('open-ended');
    expect(() =>
      validateSlabs([
        { upTo: 100, rate: 0 },
        { upTo: 50, rate: 0.1 },
        { upTo: null, rate: 0.2 },
      ]),
    ).toThrow('increase');
  });

  it('finds a table by year and regime', () => {
    expect(findTaxTable([synthetic], 'TEST', 'new')).toBe(synthetic);
    expect(() => findTaxTable([synthetic], 'TEST', 'old')).toThrow('no tax table');
  });
});
