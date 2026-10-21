import { describe, expect, it } from 'vitest';
import { incomeTax as rules, smallSavings } from '@/data';
import { monthlySaving, sipBreakEven, type MonthlySavingInput } from './monthlySaving';

const ppf = smallSavings.ppf;
/** ₹10,000 a month for 15 years. Illustrative values; PPF at the verified rate. */
const example: MonthlySavingInput = {
  monthly: 10_000,
  years: 15,
  sipReturn: 0.1,
  ppfRate: 0.071,
  rdRate: 0.07,
  taxRate: 0.312,
  inflation: 0.06,
};

describe('the verified PPF rules', () => {
  it('7.1%, ₹500 to ₹1.5 lakh a year, 15 years, tax-free', () => {
    expect(ppf).toMatchObject({
      rate: 0.071,
      minYearly: 500,
      maxYearly: 150_000,
      termYears: 15,
      interestTaxFree: true,
      status: 'verified',
    });
    expect(rules.capitalGains.listedLongTermAfterMonths).toBe(12);
  });
});

describe('PPF: hand-checked', () => {
  it('₹10,000 a month at 12%: year one earns 1% of 10,000 + 20,000 + … + 1,20,000 = ₹7,800', () => {
    const r = monthlySaving({ ...example, ppfRate: 0.12 }, rules, ppf);
    expect(r.ppf.byYear[1]).toBeCloseTo(127_800, 6);
  });

  it('each year: interest = rate ÷ 12 × (12 × opening balance + 78 × monthly), credited at the end', () => {
    let balance = 0;
    for (let y = 0; y < 15; y++) balance += 120_000 + (0.071 / 12) * (12 * balance + 78 * 10_000);
    const r = monthlySaving(example, rules, ppf);
    expect(r.ppf.net).toBeCloseTo(balance, 4);
    expect(r.ppf.tax).toBe(0);
  });
});

describe('SIP: hand-checked', () => {
  const r = monthlySaving(example, rules, ppf);
  const g = Math.pow(1.1, 1 / 12) - 1;

  it('value = 10,000 × Σ (1 + g)^h for h = 1 … 180', () => {
    let v = 0;
    for (let h = 1; h <= 180; h++) v += 10_000 * Math.pow(1 + g, h);
    expect(r.sip.value).toBeCloseTo(v, 4);
    expect(r.deposited).toBe(1_800_000);
  });

  it('the last 12 instalments are short-term (20% + cess); the rest long-term above ₹1.25 lakh', () => {
    let st = 0;
    for (let h = 1; h <= 12; h++) st += 10_000 * (Math.pow(1 + g, h) - 1);
    expect(r.sip.shortTermGain).toBeCloseTo(st, 4);
    const lt = r.sip.value - 1_800_000 - st;
    expect(r.sip.longTermGain).toBeCloseTo(lt, 4);
    expect(r.sip.tax).toBeCloseTo((st * 0.2 + (lt - 125_000) * 0.125) * 1.04, 4);
    expect(Math.round(r.sip.net)).toBe(3_743_855);
  });
});

describe('RD and the comparison', () => {
  it('RD grows at 7% × (1 − 31.2%) a year with deposits at the start of each month', () => {
    const r = monthlySaving(example, rules, ppf);
    const g = Math.pow(1 + 0.07 * 0.688, 1 / 12) - 1;
    let v = 0;
    for (let h = 1; h <= 180; h++) v += 10_000 * Math.pow(1 + g, h);
    expect(r.rd.net).toBeCloseTo(v, 4);
  });

  it('example: SIP ₹37.44 lakh, PPF ₹31.56 lakh, RD ₹26.20 lakh; SIP needs about 7.79%', () => {
    const r = monthlySaving(example, rules, ppf);
    expect(r.best).toBe('sip');
    expect(Math.round(r.ppf.net)).toBe(3_155_679);
    expect(Math.round(r.rd.net)).toBe(2_619_998);
    expect(sipBreakEven(example, rules, ppf)!.threshold).toBeCloseTo(0.0779, 4);
  });
});

describe('input checks', () => {
  it('keeps within PPF limits and term', () => {
    expect(() => monthlySaving({ ...example, monthly: 13_000 }, rules, ppf)).toThrow(RangeError);
    expect(() => monthlySaving({ ...example, monthly: 40 }, rules, ppf)).toThrow(RangeError);
    expect(() => monthlySaving({ ...example, years: 12 }, rules, ppf)).toThrow(RangeError);
    expect(() => monthlySaving({ ...example, years: 18 }, rules, ppf)).toThrow(RangeError);
    expect(() => monthlySaving({ ...example, years: 20 }, rules, ppf)).not.toThrow();
  });
});
