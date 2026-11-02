import { describe, expect, it } from 'vitest';
import { smallSavings } from '@/data';
import { ppfCalc } from './ppf';
import {
  PPF_YEARS,
  invalidPpfFields,
  ppfExampleForm,
  ppfLimits,
  ppfShareSchema,
  toPpfInput,
  withFrequency,
} from './ppfForm';
import { decodeShare, encodeShare } from '@/lib/shareLink';

const rules = smallSavings.ppf;

describe('ppfCalc', () => {
  it('₹1.5 lakh by 5 April for 15 years at 7.1% matures at ₹40,68,209', () => {
    // An annuity due: 1,50,000 × ((1.071^15 − 1) ÷ 0.071) × 1.071 = 40,68,209.
    const r = ppfCalc({ deposit: 150_000, frequency: 'yearly', years: 15, rate: 0.071 }, rules);
    expect(r.maturity).toBeCloseTo(4_068_209, -1);
    expect(r.deposited).toBe(2_250_000);
    expect(r.interest).toBeCloseTo(1_818_209, -1);
    // Year 1: the whole ₹1.5 lakh earns 12 months, 1,50,000 × 7.1% = 10,650.
    expect(r.byYear[0]!.deposited).toBe(150_000);
    expect(r.byYear[0]!.interest).toBeCloseTo(10_650, 6);
    expect(r.byYear[0]!.balance).toBeCloseTo(160_650, 6);
  });

  it('₹12,500 by the fifth of each month earns less in year 1', () => {
    const r = ppfCalc({ deposit: 12_500, frequency: 'monthly', years: 15, rate: 0.071 }, rules);
    // Balances 12,500 … 1,50,000 sum to 12,500 × 78 = 9,75,000; × 7.1% ÷ 12 = 5,768.75.
    expect(r.byYear[0]!.interest).toBeCloseTo(5_768.75, 6);
    expect(r.byYear[0]!.balance).toBeCloseTo(155_768.75, 6);
    expect(r.deposited).toBe(2_250_000);
    expect(r.maturity).toBeLessThan(4_068_209);
    expect(r.monthly.balance).toHaveLength(180);
    expect(r.monthly.credited[11]).toBeCloseTo(5_768.75, 6);
  });

  it('interest is credited only at the end of each year', () => {
    const r = ppfCalc({ deposit: 12_500, frequency: 'monthly', years: 15, rate: 0.071 }, rules);
    expect(r.monthly.credited.slice(0, 11).every((c) => c === 0)).toBe(true);
    expect(r.monthly.balance[10]).toBe(137_500);
  });

  it('extends in 5-year blocks', () => {
    const r = ppfCalc({ deposit: 150_000, frequency: 'yearly', years: 20, rate: 0.071 }, rules);
    expect(r.byYear).toHaveLength(20);
    expect(() =>
      ppfCalc({ deposit: 150_000, frequency: 'yearly', years: 17, rate: 0.071 }, rules),
    ).toThrow(RangeError);
  });

  it('rejects deposits outside ₹500 to ₹1.5 lakh a year', () => {
    expect(() =>
      ppfCalc({ deposit: 13_000, frequency: 'monthly', years: 15, rate: 0.071 }, rules),
    ).toThrow(RangeError);
    expect(() =>
      ppfCalc({ deposit: 400, frequency: 'yearly', years: 15, rate: 0.071 }, rules),
    ).toThrow(RangeError);
  });
});

describe('ppfForm', () => {
  it('offers the term and its extensions', () => {
    expect(PPF_YEARS).toEqual([15, 20, 25, 30]);
  });

  it('limits the deposit by frequency', () => {
    expect(ppfLimits('yearly')).toEqual({ min: 500, max: 150_000 });
    expect(ppfLimits('monthly')).toEqual({ min: 42, max: 12_500 });
  });

  it('validates the deposit against its frequency', () => {
    const f = ppfExampleForm();
    expect(invalidPpfFields(f)).toEqual([]);
    expect(invalidPpfFields({ ...f, frequency: 'monthly', deposit: 150_000 })).toEqual(['deposit']);
    expect(invalidPpfFields({ ...f, rate: null })).toEqual(['rate']);
    expect(toPpfInput({ ...f, deposit: null })).toBeNull();
  });

  it('keeps the yearly total when switching how often you pay', () => {
    const f = ppfExampleForm();
    expect(withFrequency(f, 'monthly').deposit).toBe(12_500);
    expect(withFrequency({ ...f, frequency: 'monthly', deposit: 5_000 }, 'yearly').deposit).toBe(
      60_000,
    );
    // ₹500 a year is ₹42 a month, the monthly minimum.
    expect(withFrequency({ ...f, deposit: 500 }, 'monthly').deposit).toBe(42);
  });

  it('round-trips a share link, snapping years to a real term', () => {
    const f = { ...ppfExampleForm(), deposit: 6_000, frequency: 'monthly' as const, years: 25 };
    const back = decodeShare(`?${encodeShare(f, ppfShareSchema)}`, ppfShareSchema);
    expect(back).toMatchObject({ deposit: 6_000, frequency: 'monthly', years: 25 });
    expect(toPpfInput({ ...f, years: 22 })!.years).toBe(20);
  });
});
