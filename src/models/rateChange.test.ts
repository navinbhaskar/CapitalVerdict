import { describe, expect, it } from 'vitest';
import { emi, outstanding } from '@/engine/loan';
import { breakEvenRise, rateChange } from './rateChange';

const LOAN = { amount: 4_000_000, annualRate: 0.09, months: 240 };

describe('a rate change on ₹40 lakh at 9% over 20 years', () => {
  it('no change: the EMI is ₹35,989 and the interest ₹46.37 lakh', () => {
    const r = rateChange({ ...LOAN, changeAfter: 0, newRate: 0.09, mode: 'emi' });
    expect(Math.round(r.emi)).toBe(35_989);
    expect(r.totalMonths).toBe(240);
    // 240 × 35,989.04 − 40,00,000.
    expect(r.totalInterest!).toBeCloseTo(240 * emi(4_000_000, 0.09, 240) - 4_000_000, 2);
  });

  it('1% more after 3 years, EMI raised: ₹37.54 lakh owed, EMI ₹38,331 for the 204 months left', () => {
    const r = rateChange({ ...LOAN, changeAfter: 36, newRate: 0.1, mode: 'emi' });
    const owed = outstanding(4_000_000, 0.09, 240, 36);
    expect(r.balanceAtChange).toBeCloseTo(owed, 4);
    expect(Math.round(owed)).toBe(3_753_535);
    expect(r.newEmi).toBeCloseTo(emi(owed, 0.1, 204), 6);
    expect(Math.round(r.newEmi)).toBe(38_331);
    expect(r.totalMonths).toBe(240);
    // 36 EMIs at the old amount and 204 at the new one, less what was borrowed.
    expect(r.totalInterest!).toBeCloseTo(36 * r.emi + 204 * r.newEmi - 4_000_000, 2);
  });

  it('1% more after 3 years, EMI kept: 246 more EMIs, 282 months in all', () => {
    // Months to clear B at monthly rate i with EMI E: n = −ln(1 − iB/E) ÷ ln(1 + i).
    // i = 0.10 ÷ 12, B = 37,53,535, E = 35,989: n = 245.4, so 246 EMIs, the last one smaller.
    const r = rateChange({ ...LOAN, changeAfter: 36, newRate: 0.1, mode: 'tenure' });
    const i = 0.1 / 12;
    const n = -Math.log(1 - (i * r.balanceAtChange) / r.emi) / Math.log(1 + i);
    expect(Math.ceil(n)).toBe(246);
    expect(r.totalMonths).toBe(36 + 246);
  });

  it('3% more after 3 years with the EMI kept: the EMI no longer covers the interest', () => {
    // 37,53,535 × 1% = ₹37,535 a month of interest, more than the ₹35,989 EMI.
    const r = rateChange({ ...LOAN, changeAfter: 36, newRate: 0.12, mode: 'tenure' });
    expect(r.emiBelowInterest).toBe(true);
    expect(r.totalMonths).toBeNull();
    expect(r.totalInterest).toBeNull();
  });

  it('a fall shortens the loan when the EMI is kept', () => {
    const r = rateChange({ ...LOAN, changeAfter: 36, newRate: 0.08, mode: 'tenure' });
    expect(r.totalMonths!).toBeLessThan(240);
  });

  it('break-even: the floating rate that costs as much as a fixed 10% for the whole loan', () => {
    const rise = breakEvenRise({ ...LOAN, changeAfter: 36 }, 0.1);
    const fixed = rateChange({ ...LOAN, changeAfter: 0, newRate: 0.1, mode: 'emi' });
    const floating = rateChange({ ...LOAN, changeAfter: 36, newRate: rise, mode: 'emi' });
    expect(floating.totalInterest!).toBeCloseTo(fixed.totalInterest!, 2);
    expect(rise).toBeGreaterThan(0.1);
  });
});
