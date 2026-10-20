import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { prepayOrInvest } from './prepay';
import {
  PREPAY_EXAMPLE_FORM,
  PREPAY_START_FORM,
  invalidPrepayFields,
  prepayShareSchema,
  toPrepayInput,
} from './prepayForm';

describe('prepay form', () => {
  it('starts with the visitor’s own figures missing', () => {
    expect(invalidPrepayFields(PREPAY_START_FORM).sort()).toEqual(
      ['investmentReturn', 'loanRate', 'lumpSum', 'outstanding', 'yearsLeft'].sort(),
    );
    expect(toPrepayInput(PREPAY_START_FORM)).toBeNull();
  });

  it('the example is complete; empty extras count as none', () => {
    const input = toPrepayInput(PREPAY_EXAMPLE_FORM)!;
    expect(input).toMatchObject({ yearlyAmount: 0, prepaymentCharge: 0, interestTaxRate: 0 });
    expect(Math.round(prepayOrInvest(input).atEnd.difference)).toBe(566_416);
  });

  it('needs a lump sum or a yearly amount; a yearly amount alone is enough', () => {
    const none = { ...PREPAY_EXAMPLE_FORM, lumpSum: 0 };
    expect(invalidPrepayFields(none)).toEqual(['lumpSum']);
    expect(invalidPrepayFields({ ...none, yearlyAmount: 1_00_000 })).toEqual([]);
  });

  it('a tax rate needs the yearly limit', () => {
    const form = { ...PREPAY_EXAMPLE_FORM, interestTaxRate: 0.3 };
    expect(invalidPrepayFields(form)).toEqual(['interestDeductionCap']);
    expect(invalidPrepayFields({ ...form, interestDeductionCap: 2_00_000 })).toEqual([]);
  });

  it('rejects part years and out-of-range values', () => {
    expect(invalidPrepayFields({ ...PREPAY_EXAMPLE_FORM, yearsLeft: 2.5 })).toEqual(['yearsLeft']);
    expect(invalidPrepayFields({ ...PREPAY_EXAMPLE_FORM, loanRate: 0.5 })).toEqual(['loanRate']);
  });

  it('round-trips through a share link, mode included', () => {
    const form = { ...PREPAY_EXAMPLE_FORM, mode: 'reduceEmi' as const, yearlyAmount: 50_000 };
    const query = encodeShare(form, prepayShareSchema);
    expect(decodeShare(`?${query}`, prepayShareSchema)).toMatchObject({
      outstanding: 4_000_000,
      mode: 'reduceEmi',
      yearlyAmount: 50_000,
    });
    expect(decodeShare('?mode=other', prepayShareSchema)).toEqual({});
  });
});
