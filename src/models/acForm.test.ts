import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { acPayback } from './ac';
import {
  AC_EXAMPLE_FORM,
  AC_START_FORM,
  acShareSchema,
  invalidAcFields,
  toAcInput,
} from './acForm';

describe('AC form', () => {
  it('starts with prices, label units and the price per unit missing', () => {
    expect(invalidAcFields(AC_START_FORM).sort()).toEqual(
      ['basicPrice', 'basicUnits', 'efficientPrice', 'efficientUnits', 'pricePerUnit'].sort(),
    );
    expect(AC_START_FORM).toMatchObject({ usage: 1, tariffRise: 0.03, interestRate: 0.09 });
  });

  it('the example: ₹2,450 a year, 47 months simple, 84 with 9% interest', () => {
    const r = acPayback(toAcInput(AC_EXAMPLE_FORM)!);
    // 350 fewer units × ₹7.
    expect(r.firstYearSaving).toBeCloseTo(2450, 6);
    expect(r.breakevenNoInterest!.months).toBe(47);
    expect(r.breakevenWithInterest!.months).toBe(84);
    expect(Math.round(r.netGain)).toBe(3573);
  });

  it('rejects part years and zero usage', () => {
    expect(invalidAcFields({ ...AC_EXAMPLE_FORM, years: 7.5 })).toEqual(['years']);
    expect(invalidAcFields({ ...AC_EXAMPLE_FORM, usage: 0 })).toEqual(['usage']);
  });

  it('round-trips through a share link', () => {
    const query = encodeShare(AC_EXAMPLE_FORM, acShareSchema);
    expect(decodeShare(`?${query}`, acShareSchema)).toMatchObject(AC_EXAMPLE_FORM);
  });
});
