import { describe, expect, it } from 'vitest';
import { incomeTax as rules } from '@/data';
import { breakEvenDeductions, compareRegimes, regimeTax, type TaxRegimeInput } from './taxRegime';

const salaryOnly = (salary: number, oldDeductions = 0): TaxRegimeInput => ({
  salary,
  otherIncome: 0,
  oldDeductions,
  newDeductions: 0,
});

describe('the verified rules', () => {
  it('tax year 2026-27, verified, cess 4%', () => {
    expect(rules).toMatchObject({ taxYear: '2026-27', status: 'verified', cessRate: 0.04 });
    expect(rules.regimes.new.standardDeduction).toBe(75_000);
    expect(rules.regimes.old.standardDeduction).toBe(50_000);
  });
});

describe('new regime: hand-checked', () => {
  it('₹12,75,000 salary: ₹12 lakh taxable, ₹60,000 slab tax, all rebated', () => {
    const r = regimeTax('new', salaryOnly(1_275_000), rules);
    expect(r.taxable).toBe(1_200_000);
    // 5% of 4 lakh + 10% of 4 lakh = 20,000 + 40,000.
    expect(r.slabTax).toBe(60_000);
    expect(r.total).toBe(0);
  });

  it('₹12.5 lakh taxable: marginal relief caps ₹67,500 at the ₹50,000 above ₹12 lakh', () => {
    const r = regimeTax('new', { ...salaryOnly(0), otherIncome: 1_250_000 }, rules);
    expect(r.slabTax).toBeCloseTo(67_500, 6);
    expect(r.rebate).toBeCloseTo(17_500, 6);
    expect(r.total).toBeCloseTo(52_000, 6);
  });

  it('relief ends at ₹12,70,590, the edge in the CBDT validation rules', () => {
    // Slab tax 60,000 + 15% × 70,590 = 70,588.50, just under the 70,590 above ₹12 lakh.
    const at = regimeTax('new', { ...salaryOnly(0), otherIncome: 1_270_590 }, rules);
    expect(at.slabTax).toBeCloseTo(70_588.5, 6);
    expect(at.rebate).toBe(0);
    const before = regimeTax('new', { ...salaryOnly(0), otherIncome: 1_270_000 }, rules);
    expect(before.rebate).toBeGreaterThan(0);
  });
});

describe('old regime: hand-checked', () => {
  it('₹5 lakh taxable: ₹12,500 tax, fully rebated', () => {
    const r = regimeTax('old', salaryOnly(550_000), rules);
    expect(r.taxable).toBe(500_000);
    expect(r.slabTax).toBe(12_500);
    expect(r.total).toBe(0);
  });

  it('no relief just above ₹5 lakh: ₹5,10,000 taxable pays ₹14,500 + cess', () => {
    const r = regimeTax('old', salaryOnly(560_000), rules);
    expect(r.total).toBeCloseTo(14_500 * 1.04, 6);
  });
});

describe('compareRegimes', () => {
  it('₹10 lakh salary, ₹2 lakh deductions: new regime is nil, old ₹65,000', () => {
    const r = compareRegimes(salaryOnly(1_000_000, 200_000), rules);
    // Old: 7,50,000 taxable → 12,500 + 20% × 2,50,000 = 62,500, + 4% = 65,000.
    expect(r.old.total).toBeCloseTo(65_000, 6);
    expect(r.new.total).toBe(0);
    expect(r.better).toBe('new');
    expect(r.saving).toBeCloseTo(65_000, 6);
  });

  it('₹20 lakh salary, ₹3.75 lakh deductions: new saves ₹1,04,000', () => {
    const r = compareRegimes(salaryOnly(2_000_000, 375_000), rules);
    // Old: 15,75,000 → 1,12,500 + 30% × 5,75,000 = 2,85,000 → 2,96,400 with cess.
    // New: 19,25,000 → 1,20,000 + 20% × 3,25,000 = 1,85,000 → 1,92,400 with cess.
    expect(r.old.total).toBeCloseTo(296_400, 6);
    expect(r.new.total).toBeCloseTo(192_400, 6);
    expect(r.saving).toBeCloseTo(104_000, 6);
  });

  it('flags taxable income above ₹50 lakh as out of scope (no surcharge)', () => {
    expect(compareRegimes(salaryOnly(6_000_000), rules).beyondScope).toBe(true);
    expect(compareRegimes(salaryOnly(4_000_000), rules).beyondScope).toBe(false);
  });
});

describe('breakEvenDeductions', () => {
  it('₹20 lakh salary: old wins above ₹7,08,333 of deductions', () => {
    // Old tax must fall to 1,85,000: 1,12,500 + 30% × (x − 10 lakh) → taxable 12,41,667,
    // so deductions = 20,00,000 − 50,000 − 12,41,667.
    expect(breakEvenDeductions(salaryOnly(2_000_000), rules)).toBeCloseTo(708_333.33, 0);
  });

  it('₹10 lakh salary: the new regime is nil, so the old one cannot win', () => {
    expect(breakEvenDeductions(salaryOnly(1_000_000), rules)).toBeNull();
  });
});
