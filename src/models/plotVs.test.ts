import { describe, expect, it } from 'vitest';
import { incomeTax as rules } from '@/data';
import { plotVs, plotVsFlips, type PlotVsInput } from './plotVs';

/** ₹20 lakh plot, 7% stamp duty and registration, held 10 years. Illustrative values. */
const example: PlotVsInput = {
  plotPrice: 2_000_000,
  stampDuty: 0.07,
  otherBuyCosts: 20_000,
  yearlyCost: 5_000,
  plotGrowth: 0.05,
  sellingCost: 0.02,
  fdRate: 0.07,
  taxRate: 0.312,
  fundReturn: 0.1,
  years: 10,
  inflation: 0.06,
};

describe('the verified capital-gains rules', () => {
  it('12.5% long-term, ₹1.25 lakh equity exemption, verified', () => {
    expect(rules.capitalGains).toMatchObject({
      longTermRate: 0.125,
      equityLongTermExemption: 125_000,
      status: 'verified',
    });
  });
});

describe('plotVs: hand-checked example', () => {
  const r = plotVs(example, rules);

  it('the cash is the plot’s full cost: ₹20 lakh + ₹1.4 lakh + ₹20,000', () => {
    expect(r.cash).toBe(2_160_000);
  });

  it('plot: sells for ₹32.58 lakh, keeps ₹30,08,391 after costs, tax and upkeep', () => {
    // 20,00,000 × 1.05^10 = 32,57,789.25; less 2% = 31,92,633.47.
    expect(r.plot.salePrice).toBeCloseTo(3_257_789.25, 1);
    expect(r.plot.value).toBeCloseTo(3_192_633.47, 1);
    // Gain over the ₹21.6 lakh paid: 10,32,633.47, taxed at 12.5% + 4% cess = 13%.
    expect(r.plot.gain).toBeCloseTo(1_032_633.47, 1);
    expect(r.plot.tax).toBeCloseTo(134_242.35, 1);
    // Less ₹5,000 × 10 of upkeep.
    expect(r.plot.net).toBeCloseTo(3_008_391.12, 1);
  });

  it('FD: 7% taxed at 31.2% grows at 4.816% a year', () => {
    expect(r.fd.yearlyReturn).toBeCloseTo(0.04816, 10);
    expect(r.fd.net).toBeCloseTo(2_160_000 * Math.pow(1.04816, 10), 4);
  });

  it('fund: ₹56.02 lakh, tax 13% on the gain above ₹1.25 lakh, keeps ₹51,71,211', () => {
    // 21,60,000 × 1.1^10 = 56,02,483.71; gain 34,42,483.71; taxed on 33,17,483.71.
    expect(r.fund.value).toBeCloseTo(5_602_483.71, 1);
    expect(r.fund.exempt).toBe(125_000);
    expect(r.fund.tax).toBeCloseTo(431_272.88, 1);
    expect(r.fund.net).toBeCloseTo(5_171_210.83, 1);
    expect(r.best).toBe('fund');
    expect(r.lead).toBeCloseTo(r.fund.net - r.fd.net, 6);
  });

  it('the plot needs about 11.2% a year to match the fund; the fund needs 5.3% to match the FD', () => {
    const flips = plotVsFlips(example, rules);
    expect(flips.find((f) => f.variable === 'plotGrowth')!.threshold).toBeCloseTo(0.1122, 4);
    expect(flips.find((f) => f.variable === 'fundReturn')!.threshold).toBeCloseTo(0.0534, 4);
  });
});

describe('plotVs: edge cases', () => {
  it('a plot that loses value pays no capital-gains tax', () => {
    const r = plotVs({ ...example, plotGrowth: -0.02 }, rules);
    expect(r.plot.gain).toBeLessThan(0);
    expect(r.plot.tax).toBe(0);
  });

  it('fund gains within ₹1.25 lakh are tax-free', () => {
    const r = plotVs({ ...example, plotPrice: 100_000, otherBuyCosts: 0, fundReturn: 0.05 }, rules);
    expect(r.fund.gain).toBeLessThan(125_000);
    expect(r.fund.tax).toBe(0);
  });

  it('rejects fewer than three years and part years', () => {
    expect(() => plotVs({ ...example, years: 2 }, rules)).toThrow(RangeError);
    expect(() => plotVs({ ...example, years: 5.5 }, rules)).toThrow(RangeError);
  });
});
