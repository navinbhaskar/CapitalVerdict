/**
 * Every number quoted in the blog posts, recomputed with the same models the tools use.
 * If a model or a data value changes, this fails and the post needs updating.
 */
import { describe, expect, it } from 'vitest';
import { incomeTax, smallSavings, verifiedFuelPrices } from '@/data';
import { emi, outstanding } from '@/engine/loan';
import { simpleTariff } from '@/engine/tariff';
import { toTodaysRupees } from '@/engine/timeValue';
import { carFuelFlips, compareCarFuel } from '@/models/carFuel';
import { carFuelExample } from '@/models/carFuel.example';
import { rentBuyFlips, rentVsBuy, type RentBuyInput } from '@/models/rentBuy';
import { RENT_BUY_EXAMPLE_FORM, toRentBuyInput } from '@/models/rentBuyForm';
import { solarPayback } from '@/models/solar';
import { breakEvenDeductions, compareRegimes, regimeTax } from '@/models/taxRegime';
import { monthlySaving, sipBreakEven } from '@/models/monthlySaving';

describe('posts: CNG payback, break-even, Lucknow update', () => {
  const lucknow = verifiedFuelPrices('lucknow')!;
  const input = {
    ...carFuelExample,
    base: { ...carFuelExample.base, energyPrice: lucknow.petrol },
    alternative: { ...carFuelExample.alternative, energyPrice: lucknow.cng },
  };
  const r = compareCarFuel(input);

  it('uses the prices the posts quote', () => {
    expect(lucknow).toEqual({ petrol: 101.86, cng: 107 });
    expect(r.costPerKm.base).toBeCloseTo(5.66, 2);
    expect(r.costPerKm.alternative).toBeCloseTo(4.12, 2);
    expect(r.firstMonthSaving).toBeCloseTo(2778, 0);
  });

  it('about 32 months without interest, 46 with; ₹1,26,900 owed at month 46', () => {
    expect(Math.round(r.breakevenNoInterest!.fractionalMonths)).toBe(32);
    expect(r.breakevenWithInterest!.months).toBe(46);
    expect(Math.round(r.extraPriceWithInterest[46]! / 100) * 100).toBe(126_900);
  });

  it('petrol wins below about 1,191 km a month; CNG ₹1.13 lakh ahead after 10 years', () => {
    const km = carFuelFlips(input).find((f) => f.variable === 'monthlyKm')!;
    expect(Math.round(km.threshold)).toBe(1191);
    expect(r.netAtHorizon.withInterest / 1e5).toBeCloseTo(1.13, 2);
  });

  it('at the old ₹95.75 a kg it paid back in 33 months', () => {
    expect(compareCarFuel(carFuelExample).breakevenWithInterest!.months).toBe(33);
  });
});

describe('post: rooftop solar example', () => {
  const r = solarPayback({
    systemKW: 3,
    grossCost: 180_000,
    subsidy: 0,
    generationPerKWPerDay: 4,
    degradationPerYear: 0.005,
    monthlyConsumptionKWh: 300,
    tariff: simpleTariff(7, 0),
    sanctionedLoadKW: 3,
    tariffRisePerYear: 0,
    exportRatePerKWh: 0,
    inverter: null,
    horizonYears: 25,
  });

  it('pays back in month 86 (7.2 years), ₹4.5 lakh net, about 14% a year', () => {
    expect(r.payback!.months).toBe(86);
    expect(r.firstYearSaving).toBeCloseTo(25_200, 6);
    expect(r.netAtHorizon).toBeCloseTo(450_000, 0);
    expect(r.irr!).toBeGreaterThan(0.14);
    expect(r.irr!).toBeLessThan(0.145);
    const firstYear = r.generation.slice(0, 12).reduce((a, b) => a + b, 0);
    expect(firstYear).toBeCloseTo(4380, 6);
    expect(firstYear / 3600).toBeCloseTo(1.2167, 4);
  });
});

describe('posts: rent or buy, EMI', () => {
  const illustration: RentBuyInput = {
    homePrice: 5_000_000,
    downPayment: 0.2,
    loanRate: 0.09,
    loanYears: 20,
    stampDuty: 0.07,
    otherUpfront: 50_000,
    maintenance: 0.005,
    propertyTax: 6000,
    appreciation: 0.05,
    sellingCost: 0.02,
    monthlyRent: 15_000,
    rentGrowth: 0.05,
    securityDeposit: 45_000,
    investmentReturn: 0.08,
    inflation: 0.06,
    horizonYears: 15,
  };
  const r = rentVsBuy(illustration);

  it('is the example the rent vs buy tool opens with', () => {
    expect(toRentBuyInput(RENT_BUY_EXAMPLE_FORM)).toEqual({ ...illustration, prepayYearly: 0 });
  });

  it("first month, 15-year result and today's rupees", () => {
    expect(Math.round(r.buyerOutflow[0]!)).toBe(38_572);
    expect(Math.round(r.emi)).toBe(35_989);
    expect(r.atHorizon.buyer / 1e5).toBeCloseTo(84.53, 2);
    expect(r.atHorizon.renter / 1e7).toBeCloseTo(1.09, 2);
    expect(-r.atHorizon.difference / 1e5).toBeCloseTo(24.5, 2);
    expect(-r.atHorizon.differenceToday / 1e5).toBeCloseTo(10.22, 2);
  });

  it('what flips it: 6.58% home growth, 5.64% return, 6.32% loan rate', () => {
    const flips = Object.fromEntries(rentBuyFlips(illustration).map((f) => [f.variable, f]));
    expect(flips.appreciation!.threshold).toBeCloseTo(0.0658, 4);
    expect(flips.investmentReturn!.threshold).toBeCloseTo(0.0564, 4);
    expect(flips.loanRate!.threshold).toBeCloseTo(0.0632, 4);
  });

  it('EMI post: ₹30,000 first interest, ₹46.37 lakh total interest, ₹17.34 lakh left at 15 years', () => {
    const e = emi(4_000_000, 0.09, 240);
    expect(4_000_000 * 0.0075).toBe(30_000);
    expect(Math.round(e - 30_000)).toBe(5_989);
    expect((e * 240) / 1e5).toBeCloseTo(86.37, 2);
    expect((e * 240 - 4_000_000) / 1e5).toBeCloseTo(46.37, 2);
    expect(outstanding(4_000_000, 0.09, 240, 180) / 1e5).toBeCloseTo(17.34, 2);
  });

  it('EMI post: ₹1 lakh a year prepaid clears it in year 13, interest about ₹27.97 lakh', () => {
    const p = rentVsBuy({ ...illustration, prepayYearly: 100_000 });
    expect(Math.ceil(p.loanPaidOffMonth! / 12)).toBe(13);
    expect(p.interestPaid / 1e5).toBeCloseTo(27.97, 2);
  });
});

describe("post: today's rupees", () => {
  it('₹1 crore in 15 years at 5%, 6% and 7% inflation', () => {
    const lakh = (rate: number) => toTodaysRupees(1e7, rate, 180) / 1e5;
    expect(lakh(0.05)).toBeCloseTo(48.1, 2);
    expect(lakh(0.06)).toBeCloseTo(41.73, 2);
    expect(lakh(0.07)).toBeCloseTo(36.24, 2);
    expect(Math.pow(1.06, 15)).toBeCloseTo(2.4, 1);
    expect((1.08 / 1.06 - 1) * 100).toBeCloseTo(1.9, 1);
  });
});

const salaryOnly = (salary: number, oldDeductions = 0) => ({
  salary,
  otherIncome: 0,
  oldDeductions,
  newDeductions: 0,
});

describe('post: old or new tax regime 2026-27', () => {
  it('₹10 lakh salary, ₹2 lakh deductions: new nil, old ₹65,000; old can never win', () => {
    const r = compareRegimes(salaryOnly(1_000_000, 200_000), incomeTax);
    expect(r.new.taxable).toBe(925_000);
    expect(r.old.taxable).toBe(750_000);
    expect(r.new.total).toBe(0);
    expect(r.old.total).toBeCloseTo(65_000, 6);
    expect(breakEvenDeductions(salaryOnly(1_000_000), incomeTax)).toBeNull();
  });

  it('₹15 lakh, ₹2.5 lakh deductions: new ₹97,500, old ₹1,79,400; old needs ₹5,43,750', () => {
    const r = compareRegimes(salaryOnly(1_500_000, 250_000), incomeTax);
    expect(r.new.total).toBeCloseTo(97_500, 6);
    expect(r.old.total).toBeCloseTo(179_400, 6);
    expect(breakEvenDeductions(salaryOnly(1_500_000), incomeTax)).toBeCloseTo(543_750, 0);
  });

  it('₹20 lakh, ₹3.75 lakh deductions: new ₹1,92,400, old ₹2,96,400; old needs ₹7,08,333', () => {
    const r = compareRegimes(salaryOnly(2_000_000, 375_000), incomeTax);
    expect(r.new.total).toBeCloseTo(192_400, 6);
    expect(r.old.total).toBeCloseTo(296_400, 6);
    expect(Math.round(breakEvenDeductions(salaryOnly(2_000_000), incomeTax)!)).toBe(708_333);
  });
});

describe('post: is ₹12 lakh tax-free?', () => {
  it('₹12.75 lakh salary: ₹12 lakh taxable, ₹60,000 slab tax, nil after the rebate', () => {
    const r = regimeTax('new', salaryOnly(1_275_000), incomeTax);
    expect(r.taxable).toBe(1_200_000);
    expect(r.slabTax).toBe(60_000);
    expect(r.total).toBe(0);
  });

  it('₹13 lakh salary: ₹63,750 slab tax capped at ₹25,000 by marginal relief, ₹26,000 with cess', () => {
    const r = regimeTax('new', salaryOnly(1_300_000), incomeTax);
    expect(r.taxable).toBe(1_225_000);
    expect(r.slabTax).toBeCloseTo(63_750, 6);
    expect(r.total).toBeCloseTo(26_000, 6);
    // Without relief it would be the slab tax plus cess.
    expect(r.slabTax * 1.04).toBeCloseTo(66_300, 6);
  });

  it('relief ends at ₹12,70,590 of taxable income', () => {
    const edge = regimeTax('new', { ...salaryOnly(0), otherIncome: 1_270_590 }, incomeTax);
    expect(edge.slabTax).toBeCloseTo(70_588.5, 6);
    expect(edge.rebate).toBe(0);
  });
});

describe('post: how mutual fund gains are taxed', () => {
  const cg = incomeTax.capitalGains;
  const cess = 1 + incomeTax.cessRate;

  it('rules quoted: 20% short-term, 12.5% long-term above ₹1.25 lakh, held over 12 months, 4% cess', () => {
    expect(cg).toMatchObject({
      equityShortTermRate: 0.2,
      longTermRate: 0.125,
      equityLongTermExemption: 125_000,
      listedLongTermAfterMonths: 12,
    });
    expect(incomeTax.cessRate).toBe(0.04);
  });

  it('₹50,000 short-term gain: ₹10,000 tax, ₹10,400 with cess', () => {
    expect(50_000 * cg.equityShortTermRate * cess).toBeCloseTo(10_400, 6);
  });

  it('₹3 lakh long-term gain: tax on ₹1.75 lakh = ₹21,875, ₹22,750 with cess', () => {
    expect((300_000 - cg.equityLongTermExemption) * cg.longTermRate).toBeCloseTo(21_875, 6);
    expect((300_000 - cg.equityLongTermExemption) * cg.longTermRate * cess).toBeCloseTo(22_750, 6);
  });
});

describe('post: SIP vs PPF', () => {
  const input = {
    monthly: 10_000,
    years: 15,
    sipReturn: 0.1,
    ppfRate: smallSavings.ppf.rate,
    rdRate: 0.07,
    taxRate: 0.312,
    inflation: 0.06,
  };
  const r = monthlySaving(input, incomeTax, smallSavings.ppf);

  it('₹10,000 a month for 15 years: ₹18 lakh saved; SIP about ₹5.88 lakh ahead', () => {
    expect(r.deposited).toBe(1_800_000);
    expect(r.lead / 1e5).toBeCloseTo(5.88, 2);
    expect(smallSavings.ppf.rate).toBe(0.071);
  });

  it('SIP ₹40.16 lakh before tax, ₹2.72 lakh tax (₹1,332 short-term), keeps ₹37.44 lakh', () => {
    expect(r.sip.value / 1e5).toBeCloseTo(40.16, 2);
    expect(r.sip.tax / 1e5).toBeCloseTo(2.72, 2);
    expect(Math.round(r.sip.shortTermGain * 0.2 * 1.04)).toBe(1_332);
    expect(r.sip.net / 1e5).toBeCloseTo(37.44, 2);
  });

  it('PPF ₹31.56 lakh tax-free; RD ₹26.20 lakh after ₹5.09 lakh tax', () => {
    expect(r.ppf.net / 1e5).toBeCloseTo(31.56, 2);
    expect(r.rd.net / 1e5).toBeCloseTo(26.2, 2);
    expect(r.rd.tax / 1e5).toBeCloseTo(5.09, 2);
  });

  it('the SIP needs about 7.79% a year to beat PPF; at 7% it keeps ₹29.72 lakh, behind PPF', () => {
    expect(sipBreakEven(input, incomeTax, smallSavings.ppf)!.threshold * 100).toBeCloseTo(7.79, 2);
    const at7 = monthlySaving({ ...input, sipReturn: 0.07 }, incomeTax, smallSavings.ppf);
    expect(at7.best).toBe('ppf');
    expect(at7.sip.net / 1e5).toBeCloseTo(29.72, 2);
  });
});
