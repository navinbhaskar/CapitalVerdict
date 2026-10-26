import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { emiExampleForm, emiShareSchema, invalidEmiFields, toEmiInput } from './emiForm';

describe('EMI form', () => {
  it('the example is the guide loan, with no prepayment', () => {
    expect(toEmiInput(emiExampleForm())).toEqual({
      amount: 4_000_000,
      annualRate: 0.09,
      years: 20,
      yearlyPrepayment: 0,
      inflation: 0.06,
    });
  });

  it('the prepayment may be empty; the rest may not', () => {
    const form = { ...emiExampleForm(), amount: null, years: 2.5 };
    expect(invalidEmiFields(form).sort()).toEqual(['amount', 'years']);
    expect(toEmiInput(form)).toBeNull();
  });

  it('round-trips through a share link', () => {
    const form = { ...emiExampleForm(), yearlyPrepayment: 100_000 };
    const query = encodeShare(form, emiShareSchema);
    expect(decodeShare(`?${query}`, emiShareSchema)).toEqual(form);
  });
});
