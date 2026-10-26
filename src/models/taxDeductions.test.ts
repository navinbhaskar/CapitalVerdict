import { describe, expect, it } from 'vitest';
import { incomeTax } from '@/data';
import { compareRegimes } from './taxRegime';
import { hraExemption, itemisedDeductions, type DeductionInput } from './taxDeductions';

const none: DeductionInput = {
  salary: 0,
  otherIncome: 0,
  basicPlusDa: 0,
  hraReceived: 0,
  rentPaid: 0,
  largeCity: true,
  section80C: 0,
  npsExtra: 0,
  healthSelf: 0,
  healthSelfSenior: false,
  healthParents: 0,
  healthParentsSenior: false,
  homeLoanInterest: 0,
  educationLoanInterest: 0,
  savingsInterest: 0,
  employerNps: 0,
  governmentEmployer: false,
};

describe('HRA exemption: the least of three', () => {
  const hra = incomeTax.hra;
  // Basic + DA ₹6,00,000, HRA received ₹2,40,000.
  const base = { basicPlusDa: 600_000, hraReceived: 240_000, largeCity: true };

  it('rent ₹3,00,000 in a large city: least of 2,40,000, 2,40,000 and 3,00,000 = ₹2,40,000', () => {
    expect(hraExemption({ ...base, rentPaid: 300_000 }, hra)).toBe(240_000);
  });

  it('rent ₹1,80,000: rent − 10% of salary = ₹1,20,000 is the least', () => {
    expect(hraExemption({ ...base, rentPaid: 180_000 }, hra)).toBe(120_000);
  });

  it('elsewhere, 40% of salary caps it: ₹2,40,000 at rent ₹4,00,000 with HRA ₹3,00,000', () => {
    expect(
      hraExemption({ ...base, hraReceived: 300_000, rentPaid: 400_000, largeCity: false }, hra),
    ).toBe(240_000);
    expect(
      hraExemption({ ...base, hraReceived: 300_000, rentPaid: 400_000, largeCity: true }, hra),
    ).toBe(300_000);
  });

  it('rent under 10% of salary: no exemption', () => {
    expect(hraExemption({ ...base, rentPaid: 50_000 }, hra)).toBe(0);
  });

  it('eight cities get the 50% limit from 2026-27', () => {
    expect(hra.largeCities).toEqual([
      'delhi',
      'mumbai',
      'kolkata',
      'chennai',
      'bengaluru',
      'hyderabad',
      'pune',
      'ahmedabad',
    ]);
  });
});

describe('limits', () => {
  it('80C stops at ₹1.5 lakh, extra NPS at ₹50,000, 80TTA at ₹10,000', () => {
    const r = itemisedDeductions(
      { ...none, section80C: 200_000, npsExtra: 80_000, savingsInterest: 15_000 },
      incomeTax,
    );
    const allowed = Object.fromEntries(r.old.map((l) => [l.key, l.allowed]));
    expect(allowed.section80C).toBe(150_000);
    expect(allowed.npsExtra).toBe(50_000);
    expect(allowed.savingsInterest).toBe(10_000);
    expect(r.roomLeft.section80C).toBe(0);
  });

  it('80D: ₹25,000 each for self and parents, ₹50,000 where a senior is covered', () => {
    const young = itemisedDeductions(
      { ...none, healthSelf: 40_000, healthParents: 40_000 },
      incomeTax,
    );
    expect(young.oldTotal).toBe(50_000);
    const seniorParents = itemisedDeductions(
      { ...none, healthSelf: 40_000, healthParents: 40_000, healthParentsSenior: true },
      incomeTax,
    );
    expect(seniorParents.oldTotal).toBe(25_000 + 40_000);
    expect(seniorParents.roomLeft.healthParents).toBe(10_000);
  });

  it('home-loan interest stops at ₹2 lakh; education-loan interest has no limit', () => {
    const r = itemisedDeductions(
      { ...none, homeLoanInterest: 350_000, educationLoanInterest: 300_000 },
      incomeTax,
    );
    expect(r.oldTotal).toBe(200_000 + 300_000);
  });

  it('employer NPS: up to 14% of basic + DA in the new regime, 10% in the old (14% for government)', () => {
    const i = { ...none, basicPlusDa: 1_000_000, employerNps: 150_000 };
    const r = itemisedDeductions(i, incomeTax);
    expect(r.newTotal).toBe(140_000);
    expect(r.oldTotal).toBe(100_000);
    expect(itemisedDeductions({ ...i, governmentEmployer: true }, incomeTax).oldTotal).toBe(
      140_000,
    );
  });

  it('only the employer NPS counts in the new regime', () => {
    const r = itemisedDeductions(
      { ...none, section80C: 150_000, healthSelf: 25_000, homeLoanInterest: 200_000 },
      incomeTax,
    );
    expect(r.newTotal).toBe(0);
    expect(r.oldTotal).toBe(375_000);
  });
});

describe('into the regime comparison', () => {
  it('savings interest is income in both regimes and a deduction only in the old', () => {
    const r = itemisedDeductions({ ...none, salary: 1_000_000, savingsInterest: 8_000 }, incomeTax);
    expect(r.regimeInput).toEqual({
      salary: 1_000_000,
      otherIncome: 8_000,
      oldDeductions: 8_000,
      newDeductions: 0,
    });
  });

  it('₹15 lakh salary with rent, full 80C and 80D: the old total feeds compareRegimes', () => {
    const r = itemisedDeductions(
      {
        ...none,
        salary: 1_500_000,
        basicPlusDa: 600_000,
        hraReceived: 240_000,
        rentPaid: 300_000,
        section80C: 150_000,
        healthSelf: 25_000,
      },
      incomeTax,
    );
    expect(r.oldTotal).toBe(240_000 + 150_000 + 25_000);
    const c = compareRegimes(r.regimeInput, incomeTax);
    expect(c.old.deductions).toBe(415_000);
    expect(c.new.deductions).toBe(0);
  });

  it('rejects negative amounts', () => {
    expect(() => itemisedDeductions({ ...none, rentPaid: -1 }, incomeTax)).toThrow(RangeError);
  });
});
