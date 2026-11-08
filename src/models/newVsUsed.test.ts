import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { newVsUsed, type NewVsUsedInput } from './newVsUsed';
import {
  invalidNewVsUsedFields,
  newVsUsedShareSchema,
  newVsUsedStartForm,
  resolveNewVsUsed,
  toNewVsUsedInput,
  type NewVsUsedForm,
} from './newVsUsedForm';

// A ₹10 lakh new car in Delhi (₹70,000 road tax) against the same car at 3 years old for ₹7 lakh,
// both kept 5 years, third-party cover only (₹3,416 a year), no upkeep.
const base: NewVsUsedInput = {
  new: {
    price: 1_000_000,
    oneOff: 70_000,
    insurance: 3_416,
    upkeep: 0,
    sale: 500_000,
    loanRate: 0.09,
  },
  used: { price: 700_000, oneOff: 0, insurance: 3_416, upkeep: 0, sale: 300_000, loanRate: 0.12 },
  years: 5,
  loanShare: 0,
  loanYears: 5,
  investmentReturn: 0,
};

describe('newVsUsed', () => {
  it('cash, no return: the plain sum of what goes out less the sale', () => {
    const r = newVsUsed(base);
    // Insurance at the start of years 1 to 5: 5 × 3,416 = 17,080.
    // New: 10,00,000 + 70,000 + 17,080 − 5,00,000 = 5,87,080.
    // Used: 7,00,000 + 17,080 − 3,00,000 = 4,17,080.
    expect(r.new.insuranceTotal).toBe(17_080);
    expect(r.new.cost).toBeCloseTo(587_080, 6);
    expect(r.used.cost).toBeCloseTo(417_080, 6);
    expect(r.new.forgone).toBeCloseTo(0, 6);
    expect(r.better).toBe('used');
    expect(r.saving).toBeCloseTo(170_000, 6);
  });

  it('counts what the money could have earned, grown to the sale day', () => {
    const r = newVsUsed({ ...base, investmentReturn: 0.07 });
    // Each payment grows at 7% a year for the years left until the sale.
    const g = (years: number) => Math.pow(1.07, years);
    const insurance = 3_416 * (g(5) + g(4) + g(3) + g(2) + g(1));
    expect(r.new.cost).toBeCloseTo(1_070_000 * g(5) + insurance - 500_000, 2);
    expect(r.used.cost).toBeCloseTo(700_000 * g(5) + insurance - 300_000, 2);
    expect(r.new.forgone).toBeCloseTo(r.new.cost - 587_080, 6);
  });

  it('spreads upkeep over the months', () => {
    const r = newVsUsed({ ...base, used: { ...base.used, upkeep: 12_000 } });
    expect(r.used.upkeepTotal).toBeCloseTo(60_000, 6);
    expect(r.used.cost).toBeCloseTo(477_080, 6);
  });

  it('on a loan: 80% at 9% over 5 years costs ₹1.96 lakh of interest', () => {
    // ₹8 lakh at 9%: EMI 16,607, so 60 × 16,607 − 8,00,000 ≈ 1,96,400.
    const r = newVsUsed({ ...base, loanShare: 0.8 });
    expect(r.new.emi).toBeCloseTo(16_607, 0);
    expect(r.new.interest).toBeCloseTo(r.new.emi * 60 - 800_000, 6);
    expect(r.new.interest).toBeGreaterThan(196_000);
    expect(r.new.interest).toBeLessThan(197_000);
    expect(r.new.owedAtSale).toBe(0);
    // With no return, the loan adds exactly its interest to the plain cost.
    expect(r.new.cost).toBeCloseTo(587_080 + r.new.interest, 4);
  });

  it('pays off what is still owed when the car is sold before the loan ends', () => {
    const r = newVsUsed({ ...base, years: 3, loanShare: 0.8, new: { ...base.new, sale: 700_000 } });
    expect(r.new.owedAtSale).toBeGreaterThan(0);
    // EMIs for 36 months plus the balance cleared, minus the loan: the interest for 3 years.
    expect(r.new.interest).toBeCloseTo(r.new.emi * 36 + r.new.owedAtSale - 800_000, 6);
    // Insurance for 3 years only.
    expect(r.new.insuranceTotal).toBe(3 * 3_416);
  });

  it('runs a month-by-month position that ends on the answer', () => {
    const r = newVsUsed({ ...base, investmentReturn: 0.07 });
    expect(r.usedAheadByMonth).toHaveLength(61);
    expect(r.usedAheadByMonth.at(-1)).toBeCloseTo(r.new.cost - r.used.cost, 6);
    // Month 0: only the one-off costs are sunk (₹70,000 road tax against nothing).
    expect(r.usedAheadByMonth[0]).toBeCloseTo(70_000, 6);
  });

  it('rejects a loan of the whole price', () => {
    expect(() => newVsUsed({ ...base, loanShare: 1 })).toThrow(RangeError);
  });
});

describe('newVsUsedForm', () => {
  const none = new Set<keyof NewVsUsedForm>();

  it('fills the auto fields from the data for the example', () => {
    const { form, source } = resolveNewVsUsed(newVsUsedStartForm(), none);
    // Delhi road tax on ₹10 lakh: 7% = 70,000. Third-party, 1000–1500 cc: 3,416.
    expect(form.newOneOff).toBe(70_000);
    expect(form.newInsurance).toBe(3_416);
    // Insurers' schedule: 30% off at 3 years, 50% off at 5.
    expect(form.usedPrice).toBe(700_000);
    expect(form.newSale).toBe(500_000);
    // The used car is 8 at the sale, past the schedule: the example value, labelled as such.
    expect(form.usedSale).toBe(300_000);
    expect(source.usedSale).toBe('example');
    expect(source.usedPrice).toBe('auto');
    expect(source.newPrice).toBe('example');
    expect(invalidNewVsUsedFields(form)).toEqual([]);
    const r = newVsUsed(toNewVsUsedInput(form)!);
    expect(r.better).toBe('used');
  });

  it('uses the schedule for the used sale while the car is 5 or under', () => {
    const { form, source } = resolveNewVsUsed({ ...newVsUsedStartForm(), years: 2 }, none);
    expect(form.usedSale).toBe(500_000);
    expect(source.usedSale).toBe('auto');
    expect(form.newSale).toBe(800_000);
  });

  it('keeps what the visitor typed', () => {
    const f = { ...newVsUsedStartForm(), usedPrice: 650_000, newPrice: 1_200_000 };
    const { form, source } = resolveNewVsUsed(f, new Set(['usedPrice', 'newPrice']));
    expect(form.usedPrice).toBe(650_000);
    expect(source.usedPrice).toBeUndefined();
    // ₹12 lakh is above ₹10 lakh: 10% road tax.
    expect(form.newOneOff).toBe(120_000);
  });

  it('asks for loan rates only for a loan', () => {
    const { form } = resolveNewVsUsed({ ...newVsUsedStartForm(), payment: 'loan' }, none);
    expect(invalidNewVsUsedFields(form)).toEqual(['usedLoanRate']);
    expect(toNewVsUsedInput(form)).toBeNull();
  });

  it('round-trips a share link', () => {
    const f = { ...newVsUsedStartForm(), engine: 'large' as const, usedAge: 2, usedPrice: 800_000 };
    const back = decodeShare(`?${encodeShare(f, newVsUsedShareSchema)}`, newVsUsedShareSchema);
    expect(back).toMatchObject({ engine: 'large', usedAge: 2, usedPrice: 800_000 });
  });
});
