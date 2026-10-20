/**
 * Every number quoted in the blog posts, recomputed with the same models the tools use.
 * If a model or a data value changes, this fails and the post needs updating.
 */
import { describe, expect, it } from 'vitest';
import { verifiedFuelPrices } from '@/data';
import { emi, outstanding } from '@/engine/loan';
import { simpleTariff } from '@/engine/tariff';
import { toTodaysRupees } from '@/engine/timeValue';
import { carFuelFlips, compareCarFuel } from '@/models/carFuel';
import { carFuelExample } from '@/models/carFuel.example';
import { rentBuyFlips, rentVsBuy, type RentBuyInput } from '@/models/rentBuy';
import { solarPayback } from '@/models/solar';

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
