import { describe, expect, it } from 'vitest';
import { gold, incomeTax } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { goldCompare, type GoldInput } from './gold';
import {
  GOLD_EXAMPLE_KEYS,
  goldExampleForm,
  goldShareSchema,
  invalidGoldFields,
  toGoldInput,
} from './goldForm';

// ₹1 lakh for 5 years, gold up 8% a year, 20% slab. Hand-worked below with cess at 4%.
const base: GoldInput = {
  amount: 100_000,
  years: 5,
  growth: 0.08,
  slabRate: 0.2,
  making: 0.1,
  buybackCut: 0.05,
  spread: 0.03,
  expenseRatio: 0.005,
  sgbIssuePrice: 5_000,
  goldPriceToday: 10_000,
  sgbPremium: 0,
};
const idx5 = Math.pow(1.08, 5); // 1.469328
const lt = 0.125 * 1.04; // 13% on long-term gains

describe('goldCompare', () => {
  const r = goldCompare(base, gold, incomeTax);

  it('physical: GST on gold and making, a cut on buyback', () => {
    // 1,00,000 ÷ (1.10 × 1.03) = 88,261 of gold; × 1.4693 × 0.95 = 1,23,201.
    const proceeds = (100_000 / (1.1 * 1.03)) * idx5 * 0.95;
    const p = r.options.physical;
    expect(p.startValue).toBeCloseTo(88_261.25, 1);
    expect(p.gst + p.making + p.startValue).toBeCloseTo(100_000, 6);
    expect(p.proceeds).toBeCloseTo(proceeds, 6);
    expect(p.longTerm).toBe(true);
    expect(p.kept).toBeCloseTo(proceeds - (proceeds - 100_000) * lt, 6);
  });

  it('digital: GST on the gold, sold back below the buying price', () => {
    const proceeds = (100_000 / 1.03) * idx5 * 0.97;
    expect(r.options.digital.proceeds).toBeCloseTo(proceeds, 6);
    expect(r.options.digital.kept).toBeCloseTo(proceeds - (proceeds - 100_000) * lt, 6);
  });

  it('ETF: no GST, the expense ratio comes out each year', () => {
    const proceeds = 100_000 * idx5 * Math.pow(0.995, 5);
    expect(r.options.etf.proceeds).toBeCloseTo(proceeds, 6);
    expect(r.options.etf.kept).toBeCloseTo(proceeds - (proceeds - 100_000) * lt, 6);
  });

  it('SGB: 2.5% on the issue price twice a year, taxed at the slab rate', () => {
    // 10 grams; interest 10 × 5,000 × 2.5% = 1,250 a year, 6,250 over 5 years.
    // Kept after 20% + cess: 6,250 × (1 − 0.208) = 4,950.
    const s = r.options.sgb;
    expect(s.interestKept + s.interestTax).toBeCloseTo(6_250, 6);
    expect(s.interestKept).toBeCloseTo(4_950, 6);
    const proceeds = 100_000 * idx5;
    expect(s.kept).toBeCloseTo(proceeds - (proceeds - 100_000) * lt + 4_950, 6);
  });

  it('ranks the options by what you keep', () => {
    // SGB ≈ 1,45,782; ETF ≈ 1,37,668; digital ≈ 1,33,385; physical ≈ 1,20,185.
    expect(r.ranking).toEqual(['sgb', 'etf', 'digital', 'physical']);
    expect(r.options.sgb.kept).toBeCloseTo(145_782, -1);
    expect(r.options.physical.kept).toBeCloseTo(120_185, -1);
  });

  it('a gold ETF is long-term after 12 months, physical gold only after 24', () => {
    const r2 = goldCompare({ ...base, years: 2 }, gold, incomeTax);
    expect(r2.options.etf.longTerm).toBe(true);
    // Exactly 24 months is not more than 24: still short-term at the slab rate.
    expect(r2.options.physical.longTerm).toBe(false);
    const g = r2.options.digital.gain;
    expect(r2.options.digital.gainTax).toBeCloseTo(g * 0.2 * 1.04, 6);
  });

  it('pays no tax on a loss', () => {
    const r3 = goldCompare({ ...base, growth: -0.1 }, gold, incomeTax);
    expect(r3.options.physical.gain).toBeLessThan(0);
    expect(r3.options.physical.gainTax).toBe(0);
  });

  it('runs month by month to the answer', () => {
    expect(r.options.etf.keptByMonth).toHaveLength(60);
    expect(r.options.etf.keptByMonth.at(-1)).toBeCloseTo(r.options.etf.kept, 6);
    // The first SGB interest arrives at month 6.
    const s = goldCompare({ ...base, years: 1 }, gold, incomeTax).options.sgb;
    expect(s.interestKept + s.interestTax).toBeCloseTo(1_250, 6);
  });
});

describe('goldForm', () => {
  it('starts from the example and validates', () => {
    const f = goldExampleForm();
    expect(invalidGoldFields(f)).toEqual([]);
    expect(toGoldInput(f)).toEqual(base);
    expect(invalidGoldFields({ ...f, years: 2.5 })).toEqual(['years']);
    expect(invalidGoldFields({ ...f, amount: null })).toEqual(['amount']);
    expect(GOLD_EXAMPLE_KEYS).not.toContain('years');
  });

  it('allows a discount on the exchange, not a negative cost', () => {
    expect(invalidGoldFields({ ...goldExampleForm(), sgbPremium: -0.02 })).toEqual([]);
    expect(invalidGoldFields({ ...goldExampleForm(), making: -0.01 })).toEqual(['making']);
  });

  it('round-trips a share link', () => {
    const f = { ...goldExampleForm(), amount: 250_000, sgbPremium: -0.02 };
    const back = decodeShare(`?${encodeShare(f, goldShareSchema)}`, goldShareSchema);
    expect(back).toMatchObject({ amount: 250_000, sgbPremium: -0.02 });
  });
});
