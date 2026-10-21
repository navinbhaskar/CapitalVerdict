import { describe, expect, it } from 'vitest';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { breakEvenDeductions, compareRegimes } from './taxRegime';
import {
  TAX_REGIME_EXAMPLE_FORM,
  TAX_REGIME_START_FORM,
  invalidTaxRegimeFields,
  taxRegimeShareSchema,
  toTaxRegimeInput,
} from './taxRegimeForm';

describe('tax regime form', () => {
  it('starts with only the salary missing', () => {
    expect(invalidTaxRegimeFields(TAX_REGIME_START_FORM)).toEqual(['salary']);
  });

  it('the example: ₹15 lakh salary, ₹2.5 lakh deductions', () => {
    const input = toTaxRegimeInput(TAX_REGIME_EXAMPLE_FORM)!;
    const r = compareRegimes(input, incomeTax);
    // Old: 12,00,000 taxable → 1,12,500 + 30% × 2,00,000 = 1,72,500 → 1,79,400 with cess.
    expect(r.old.total).toBeCloseTo(179_400, 6);
    // New: 14,25,000 taxable → 60,000 + 15% × 2,25,000 = 93,750 → 97,500 with cess.
    expect(r.new.total).toBeCloseTo(97_500, 6);
    expect(r.better).toBe('new');
    // Old tax falls to 93,750 at 9,06,250 taxable: 15,00,000 − 50,000 − 9,06,250.
    expect(breakEvenDeductions(input, incomeTax)).toBeCloseTo(543_750, 0);
  });

  it('other income alone is enough; no income at all is not', () => {
    expect(invalidTaxRegimeFields({ ...TAX_REGIME_START_FORM, otherIncome: 500_000 })).toEqual([]);
    expect(invalidTaxRegimeFields({ ...TAX_REGIME_START_FORM, salary: 0 })).toEqual(['salary']);
  });

  it('round-trips through a share link', () => {
    const query = encodeShare(TAX_REGIME_EXAMPLE_FORM, taxRegimeShareSchema);
    expect(decodeShare(`?${query}`, taxRegimeShareSchema)).toMatchObject({
      salary: 1_500_000,
      oldDeductions: 250_000,
    });
  });
});
