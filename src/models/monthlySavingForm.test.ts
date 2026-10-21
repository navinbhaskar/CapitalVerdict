import { describe, expect, it } from 'vitest';
import { incomeTax, smallSavings } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { monthlySaving } from './monthlySaving';
import {
  MONTHLY_SAVING_EXAMPLE_FORM,
  MONTHLY_SAVING_LIMITS,
  MONTHLY_SAVING_START_FORM,
  invalidMonthlySavingFields,
  monthlySavingShareSchema,
  toMonthlySavingInput,
} from './monthlySavingForm';

describe('SIP vs PPF vs RD form', () => {
  it('starts with the amount, RD rate and tax rate missing; PPF at the verified 7.1%', () => {
    expect(invalidMonthlySavingFields(MONTHLY_SAVING_START_FORM).sort()).toEqual(
      ['monthly', 'rdRate', 'taxRate'].sort(),
    );
    expect(MONTHLY_SAVING_START_FORM).toMatchObject({ ppfRate: 0.071, years: 15, sipReturn: 0.1 });
  });

  it('the monthly limit follows PPF: ₹42 to ₹12,500', () => {
    expect(MONTHLY_SAVING_LIMITS.monthly).toEqual({ min: 42, max: 12_500 });
  });

  it('years: 15, 20, 25 … only', () => {
    expect(invalidMonthlySavingFields({ ...MONTHLY_SAVING_EXAMPLE_FORM, years: 20 })).toEqual([]);
    expect(invalidMonthlySavingFields({ ...MONTHLY_SAVING_EXAMPLE_FORM, years: 17 })).toEqual([
      'years',
    ]);
  });

  it('the example matches the hand-checked case', () => {
    const r = monthlySaving(
      toMonthlySavingInput(MONTHLY_SAVING_EXAMPLE_FORM)!,
      incomeTax,
      smallSavings.ppf,
    );
    expect(Math.round(r.sip.net)).toBe(3_743_855);
  });

  it('round-trips through a share link', () => {
    const query = encodeShare(MONTHLY_SAVING_EXAMPLE_FORM, monthlySavingShareSchema);
    expect(decodeShare(`?${query}`, monthlySavingShareSchema)).toMatchObject({
      monthly: 10_000,
      taxRate: 0.312,
    });
  });
});
