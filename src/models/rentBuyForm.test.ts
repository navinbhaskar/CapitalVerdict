import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import {
  RENT_BUY_EXAMPLE_FORM,
  RENT_BUY_EXAMPLE_KEYS,
  RENT_BUY_START_FORM,
  invalidRentBuyFields,
  rentBuyShareSchema,
  toRentBuyInput,
  type RentBuyForm,
} from './rentBuyForm';

// SYNTHETIC values for testing only (not market data).
const filled: RentBuyForm = {
  ...RENT_BUY_START_FORM,
  homePrice: 5_000_000,
  loanRate: 0.09,
  stampDuty: 0.07,
  maintenance: 0.005,
  sellingCost: 0.02,
  monthlyRent: 15_000,
  investmentReturn: 0.08,
};

describe('rent vs buy form', () => {
  it("starts with the visitor's figures and unverified market values empty", () => {
    expect(invalidRentBuyFields(RENT_BUY_START_FORM).sort()).toEqual([
      'homePrice',
      'investmentReturn',
      'loanRate',
      'maintenance',
      'monthlyRent',
      'sellingCost',
      'stampDuty',
    ]);
    expect(RENT_BUY_START_FORM.appreciation).toBe(0.05);
    expect(RENT_BUY_START_FORM.rentGrowth).toBe(0.05);
    expect(RENT_BUY_START_FORM.inflation).toBe(0.06);
  });

  it('maps a complete form; empty optional fields become zero', () => {
    const input = toRentBuyInput(filled)!;
    expect(input.otherUpfront).toBe(0);
    expect(input.propertyTax).toBe(0);
    expect(input.securityDeposit).toBe(0);
    expect(input.homePrice).toBe(5_000_000);
  });

  it('a cash purchase needs no loan rate', () => {
    const cash = { ...filled, downPayment: 1, loanRate: null };
    expect(invalidRentBuyFields(cash)).toEqual([]);
    expect(toRentBuyInput(cash)?.loanRate).toBe(0);
  });

  it('round-trips through a share link', () => {
    expect(decodeShare(encodeShare(filled, rentBuyShareSchema), rentBuyShareSchema)).toEqual(
      Object.fromEntries(Object.entries(filled).filter(([, v]) => v !== null)),
    );
  });
});

describe('rent vs buy form: example start', () => {
  it('opens complete, and matches the illustration in the blog post', () => {
    expect(invalidRentBuyFields(RENT_BUY_EXAMPLE_FORM)).toEqual([]);
    const input = toRentBuyInput(RENT_BUY_EXAMPLE_FORM)!;
    expect(input.homePrice).toBe(5_000_000);
    expect(input.monthlyRent).toBe(15_000);
    expect(RENT_BUY_EXAMPLE_KEYS).toContain('stampDuty');
  });
});
