import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { cashOrLoan } from './carLoan';
import {
  CAR_LOAN_EXAMPLE_FORM,
  CAR_LOAN_START_FORM,
  carLoanShareSchema,
  invalidCarLoanFields,
  toCarLoanInput,
} from './carLoanForm';

describe('car loan form', () => {
  it('starts with the price and return missing; the loan rate comes from the defaults', () => {
    expect(invalidCarLoanFields(CAR_LOAN_START_FORM).sort()).toEqual([
      'carPrice',
      'investmentReturn',
    ]);
    expect(CAR_LOAN_START_FORM.loanRate).toBe(0.09);
  });

  it('the example is complete and matches the hand-checked case', () => {
    const input = toCarLoanInput(CAR_LOAN_EXAMPLE_FORM)!;
    expect(input).toMatchObject({ downPayment: 0.2, loanYears: 5, processingFee: 5000 });
    expect(Math.round(cashOrLoan(input).atEnd.difference)).toBe(67_298);
  });

  it('an empty fee counts as none; a fee as big as the loan is flagged', () => {
    expect(toCarLoanInput({ ...CAR_LOAN_EXAMPLE_FORM, processingFee: null })!.processingFee).toBe(
      0,
    );
    expect(invalidCarLoanFields({ ...CAR_LOAN_EXAMPLE_FORM, processingFee: 800_000 })).toEqual([
      'processingFee',
    ]);
  });

  it('rejects part years and a down payment of the whole price', () => {
    expect(invalidCarLoanFields({ ...CAR_LOAN_EXAMPLE_FORM, loanYears: 3.5 })).toEqual([
      'loanYears',
    ]);
    expect(invalidCarLoanFields({ ...CAR_LOAN_EXAMPLE_FORM, downPayment: 1 })).toEqual([
      'downPayment',
    ]);
  });

  it('round-trips through a share link', () => {
    const query = encodeShare(CAR_LOAN_EXAMPLE_FORM, carLoanShareSchema);
    expect(decodeShare(`?${query}`, carLoanShareSchema)).toMatchObject({
      carPrice: 1_000_000,
      processingFee: 5000,
      investmentReturn: 0.07,
    });
  });
});
