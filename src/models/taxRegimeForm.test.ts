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

  it('the example, item by item: HRA 2,40,000 + 80C 1,50,000 + health 25,000 = 4,15,000', () => {
    const { input, items } = toTaxRegimeInput(TAX_REGIME_EXAMPLE_FORM)!;
    expect(items!.oldTotal).toBe(415_000);
    expect(input.oldDeductions).toBe(415_000);
    const r = compareRegimes(input, incomeTax);
    // Old: 10,35,000 taxable → 1,12,500 + 30% × 35,000 = 1,23,000 → 1,27,920 with cess.
    expect(r.old.total).toBeCloseTo(127_920, 6);
    // New: 14,25,000 taxable → 60,000 + 15% × 2,25,000 = 93,750 → 97,500 with cess.
    expect(r.new.total).toBeCloseTo(97_500, 6);
    expect(r.better).toBe('new');
    // Old tax falls to 93,750 at 9,06,250 taxable: 15,00,000 − 50,000 − 9,06,250.
    expect(breakEvenDeductions(input, incomeTax)).toBeCloseTo(543_750, 0);
  });

  it('one total: ₹15 lakh salary, ₹2.5 lakh deductions, as before', () => {
    const { input, items } = toTaxRegimeInput({
      ...TAX_REGIME_START_FORM,
      mode: 'total',
      salary: 1_500_000,
      oldDeductions: 250_000,
    })!;
    expect(items).toBeNull();
    // Old: 12,00,000 taxable → 1,12,500 + 30% × 2,00,000 = 1,72,500 → 1,79,400 with cess.
    expect(compareRegimes(input, incomeTax).old.total).toBeCloseTo(179_400, 6);
  });

  it('a claim switched off counts as zero, whatever is typed in it', () => {
    const { input } = toTaxRegimeInput({ ...TAX_REGIME_EXAMPLE_FORM, invest: false })!;
    expect(input.oldDeductions).toBe(265_000);
  });

  it('rent needs basic pay, HRA and rent; employer NPS needs basic pay', () => {
    const form = { ...TAX_REGIME_START_FORM, salary: 1_000_000, rent: true };
    expect(invalidTaxRegimeFields(form).sort()).toEqual(['basicPlusDa', 'hraReceived', 'rentPaid']);
    expect(
      invalidTaxRegimeFields({ ...TAX_REGIME_START_FORM, salary: 1, nps: true, employerNps: 5 }),
    ).toEqual(['basicPlusDa']);
  });

  it('other income alone is enough; no income at all is not', () => {
    expect(invalidTaxRegimeFields({ ...TAX_REGIME_START_FORM, otherIncome: 500_000 })).toEqual([]);
    expect(invalidTaxRegimeFields({ ...TAX_REGIME_START_FORM, salary: 0 })).toEqual(['salary']);
  });

  it('round-trips through a share link, claims and switches included', () => {
    const query = encodeShare(TAX_REGIME_EXAMPLE_FORM, taxRegimeShareSchema);
    expect(decodeShare(`?${query}`, taxRegimeShareSchema)).toMatchObject({
      mode: 'items',
      salary: 1_500_000,
      rent: true,
      largeCity: true,
      rentPaid: 300_000,
      section80C: 150_000,
    });
  });
});
