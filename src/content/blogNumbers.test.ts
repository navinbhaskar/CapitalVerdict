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
import { prepayFlips, prepayOrInvest, type PrepayInput } from '@/models/prepay';
import { plotVs, plotVsFlips } from '@/models/plotVs';
import { acFlips, acPayback } from '@/models/ac';
import { carLoanFlips, cashOrLoan } from '@/models/carLoan';
import { irr } from '@/engine/irr';
import { fundPlan, maxWithdrawal } from '@/models/fund';
import { payoutScaleAt, planReturn } from '@/models/planReturn';
import { eightyC, hraFigures, moneyBackFigures, rateRise, retire55 } from '@/content/guideFigures';

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

/** ₹40 lakh at 9% with 20 years left, ₹5 lakh to put in, 8% after tax: the prepay posts. */
const prepayCase: PrepayInput = {
  outstanding: 4_000_000,
  loanRate: 0.09,
  yearsLeft: 20,
  lumpSum: 500_000,
  yearlyAmount: 0,
  mode: 'reduceTenure',
  investmentReturn: 0.08,
  prepaymentCharge: 0,
  interestTaxRate: 0,
  interestDeductionCap: 0,
  inflation: 0.06,
};

describe('posts: prepay or invest; lower EMI or shorter loan', () => {
  const tenure = prepayOrInvest(prepayCase);
  const emi = prepayOrInvest({ ...prepayCase, mode: 'reduceEmi' });

  it('keeping the EMI: ₹5.66 lakh ahead, ₹18.42 lakh interest saved, 65 months sooner', () => {
    expect(tenure.emi).toBeCloseTo(35_989.04, 2);
    expect(tenure.atEnd.difference / 1e5).toBeCloseTo(5.66, 2);
    expect(tenure.interestSaved / 1e5).toBeCloseTo(18.42, 2);
    expect(tenure.monthsSaved).toBe(65);
    expect(tenure.atEnd.prepay / 1e5).toBeCloseTo(28.97, 2);
    expect(tenure.atEnd.invest / 1e5).toBeCloseTo(23.3, 2);
  });

  it('lowering the EMI: ₹31,490 a month, ₹5.80 lakh saved, ₹2.29 lakh ahead', () => {
    expect(Math.round(emi.emiAfterLump)).toBe(31_490);
    expect(Math.round(tenure.emi - emi.emiAfterLump)).toBe(4_499);
    expect(emi.interestSaved / 1e5).toBeCloseTo(5.8, 2);
    expect(emi.atEnd.difference / 1e5).toBeCloseTo(2.29, 2);
    expect(emi.atEnd.prepay / 1e5).toBeCloseTo(25.6, 2);
    expect(tenure.atEnd.prepay - emi.atEnd.prepay).toBeGreaterThan(0);
  });

  it('investing wins above 9.38%; at 10% it is ₹3.10 lakh ahead', () => {
    expect(prepayFlips(prepayCase, ['investmentReturn'])[0]!.threshold * 100).toBeCloseTo(9.38, 2);
    const at10 = prepayOrInvest({ ...prepayCase, investmentReturn: 0.1 });
    expect(-at10.atEnd.difference / 1e5).toBeCloseTo(3.1, 2);
  });

  it('with interest deductible up to ₹2 lakh a year at 31.2%: ₹49,293 ahead, break-even 8.13%', () => {
    const taxed = { ...prepayCase, interestTaxRate: 0.312, interestDeductionCap: 200_000 };
    expect(Math.round(prepayOrInvest(taxed).atEnd.difference)).toBe(49_293);
    expect(prepayFlips(taxed, ['investmentReturn'])[0]!.threshold * 100).toBeCloseTo(8.13, 2);
  });
});

describe('post: plot vs mutual fund', () => {
  const plotCase = {
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
  const r = plotVs(plotCase, incomeTax);

  it('costs ₹21.6 lakh; keeps ₹30.08 lakh after ₹65,156 selling, ₹1.34 lakh tax, ₹50,000 upkeep', () => {
    expect(r.cash).toBe(2_160_000);
    expect(r.plot.salePrice / 1e5).toBeCloseTo(32.58, 2);
    expect(Math.round(r.plot.sellingCosts)).toBe(65_156);
    expect(r.plot.tax / 1e5).toBeCloseTo(1.34, 2);
    expect(r.plot.upkeep).toBe(50_000);
    expect(r.plot.net / 1e5).toBeCloseTo(30.08, 2);
    expect(r.plot.yearlyReturn * 100).toBeCloseTo(3.37, 2);
  });

  it('FD ₹34.57 lakh, fund ₹51.71 lakh (9.12% a year after tax)', () => {
    expect(r.fd.net / 1e5).toBeCloseTo(34.57, 2);
    expect(r.fund.net / 1e5).toBeCloseTo(51.71, 2);
    expect(r.fund.yearlyReturn * 100).toBeCloseTo(9.12, 2);
  });

  it('the plot needs 11.22% a year to match; at 8% it keeps ₹39.12 lakh, still behind', () => {
    const flips = plotVsFlips(plotCase, incomeTax);
    expect(flips.find((f) => f.variable === 'plotGrowth')!.threshold * 100).toBeCloseTo(11.22, 2);
    const at8 = plotVs({ ...plotCase, plotGrowth: 0.08 }, incomeTax);
    expect(at8.plot.net / 1e5).toBeCloseTo(39.12, 2);
    expect(at8.best).toBe('fund');
  });
});

describe("post: your FD's real return", () => {
  const afterTax = (tax: number) => 0.07 * (1 - tax);
  const real = (rate: number) => ((1 + rate) / 1.06 - 1) * 100;

  it('7% at 0%, 10.4%, 20.8% and 31.2% tax, against 6% inflation', () => {
    expect(real(afterTax(0))).toBeCloseTo(0.94, 2);
    expect(afterTax(0.104) * 100).toBeCloseTo(6.27, 2);
    expect(real(afterTax(0.104))).toBeCloseTo(0.26, 2);
    expect(afterTax(0.208) * 100).toBeCloseTo(5.54, 2);
    expect(real(afterTax(0.208))).toBeCloseTo(-0.43, 2);
    expect(afterTax(0.312) * 100).toBeCloseTo(4.82, 2);
    expect(real(afterTax(0.312))).toBeCloseTo(-1.12, 2);
    expect(real(0.071)).toBeCloseTo(1.04, 2);
  });

  it('₹10 lakh for 10 years at 31.2% tax: ₹16.01 lakh, ₹8.94 lakh in today’s rupees', () => {
    const end = 1_000_000 * Math.pow(1 + afterTax(0.312), 10);
    expect(end / 1e5).toBeCloseTo(16.01, 2);
    expect(toTodaysRupees(end, 0.06, 120) / 1e5).toBeCloseTo(8.94, 2);
    expect((1_000_000 * Math.pow(1.07, 10)) / 1e5).toBeCloseTo(19.67, 2);
  });
});

describe('post: is a 5-star AC worth it?', () => {
  const ac = {
    basicPrice: 35_000,
    efficientPrice: 45_000,
    basicUnits: 1_100,
    efficientUnits: 750,
    usage: 1,
    pricePerUnit: 7,
    tariffRise: 0.03,
    interestRate: 0.09,
    years: 10,
  };
  const r = acPayback(ac);

  it('₹2,450 a year; 3 years 11 months simple, 7 years with interest; ₹3,573 after 10 years', () => {
    expect(r.firstYearSaving).toBeCloseTo(2450, 6);
    expect(r.breakevenNoInterest!.months).toBe(47);
    expect(r.breakevenWithInterest!.months).toBe(84);
    expect(Math.round(r.netGain)).toBe(3_573);
  });

  it('stops paying below 87% of the label use, ₹6.11 a unit, or above ₹46,458', () => {
    const f = acFlips(ac);
    expect(f.find((x) => x.variable === 'usage')!.threshold * 100).toBeCloseTo(87.28, 2);
    expect(f.find((x) => x.variable === 'pricePerUnit')!.threshold).toBeCloseTo(6.11, 2);
    expect(Math.round(f.find((x) => x.variable === 'efficientPrice')!.threshold)).toBe(46_458);
  });

  it('at 150% use: ₹3,675 a year, 3 years 8 months, ₹17,616; at 50%: never, ₹10,470 behind', () => {
    const heavy = acPayback({ ...ac, usage: 1.5 });
    expect(heavy.firstYearSaving).toBeCloseTo(3675, 6);
    expect(heavy.breakevenWithInterest!.months).toBe(44);
    expect(Math.round(heavy.netGain)).toBe(17_616);
    const light = acPayback({ ...ac, usage: 0.5 });
    expect(light.breakevenWithInterest).toBeNull();
    expect(Math.round(-light.netGain)).toBe(10_470);
  });
});

describe('post: car loan or cash', () => {
  const c = {
    carPrice: 1_000_000,
    downPayment: 0.2,
    loanRate: 0.09,
    loanYears: 5,
    processingFee: 5000,
    investmentReturn: 0.07,
    inflation: 0.06,
  };
  const r = cashOrLoan(c);

  it('EMI ₹16,607, interest ₹1.96 lakh, cash ₹67,298 ahead; true cost 9.67%', () => {
    expect(Math.round(r.emi)).toBe(16_607);
    expect(r.totalInterest / 1e5).toBeCloseTo(1.96, 2);
    expect(Math.round(r.atEnd.difference)).toBe(67_298);
    expect(carLoanFlips(c, ['investmentReturn'])[0]!.threshold * 100).toBeCloseTo(9.67, 2);
  });

  it('at a 10% return the loan comes out ₹8,927 ahead', () => {
    expect(Math.round(-cashOrLoan({ ...c, investmentReturn: 0.1 }).atEnd.difference)).toBe(8_927);
  });

  it('a flat 5% on ₹8 lakh over 5 years: ₹2 lakh interest, EMI ₹16,667, about 9.15% reducing', () => {
    const interest = 800_000 * 0.05 * 5;
    const emi = (800_000 + interest) / 60;
    expect(interest).toBe(200_000);
    expect(Math.round(emi)).toBe(16_667);
    const monthly = irr([800_000, ...Array<number>(60).fill(-emi)])!;
    expect(monthly * 12 * 100).toBeCloseTo(9.15, 2);
  });
});

describe('post: step-up SIP', () => {
  const plan = {
    lumpSum: 0,
    monthly: 10_000,
    stepUp: 0,
    withdrawal: 0,
    withdrawalRise: 0,
    years: 15,
    annualReturn: 0.1,
    inflation: 0.06,
  };
  const flat = fundPlan(plan, incomeTax);
  const up = fundPlan({ ...plan, stepUp: 0.1 }, incomeTax);
  const lakh = (v: number) => v / 1e5;

  it('flat: ₹18 lakh in, ₹40.16 lakh, ₹2.72 lakh tax, ₹37.44 lakh kept', () => {
    expect(flat.invested).toBe(1_800_000);
    expect(lakh(flat.value)).toBeCloseTo(40.16, 2);
    expect(lakh(flat.sale.tax)).toBeCloseTo(2.72, 2);
    expect(lakh(flat.kept)).toBeCloseTo(37.44, 2);
  });

  it('10% step-up: ₹37,975 a month by year 15, ₹38.13 lakh in, ₹4.26 lakh tax, ₹67.74 lakh kept', () => {
    expect(Math.round(10_000 * Math.pow(1.1, 14))).toBe(37_975);
    expect(lakh(up.invested)).toBeCloseTo(38.13, 2);
    expect(lakh(up.sale.tax)).toBeCloseTo(4.26, 2);
    expect(lakh(up.kept)).toBeCloseTo(67.74, 2);
    expect(lakh(up.invested - flat.invested)).toBeCloseTo(20.13, 2);
    expect(lakh(up.kept - flat.kept)).toBeCloseTo(30.3, 2);
  });
});

describe('post: SWP in retirement', () => {
  const plan = {
    lumpSum: 5_000_000,
    monthly: 0,
    stepUp: 0,
    withdrawal: 30_000,
    withdrawalRise: 0.06,
    years: 25,
    annualReturn: 0.1,
    inflation: 0.06,
  };

  it('flat ₹30,000 lasts 25 years with ₹1.72 crore left; worth ₹6,990 by then', () => {
    const flat = fundPlan({ ...plan, withdrawalRise: 0 }, incomeTax);
    expect(flat.depletedMonth).toBeNull();
    expect(flat.value / 1e7).toBeCloseTo(1.72, 2);
    expect(Math.round(toTodaysRupees(30_000, 0.06, 300))).toBe(6_990);
  });

  it('rising 6%: runs out after 20 years 5 months, ₹1.38 crore taken, ₹8.33 lakh tax', () => {
    const r = fundPlan(plan, incomeTax);
    expect(r.depletedMonth).toBe(246);
    expect(r.withdrawn / 1e7).toBeCloseTo(1.38, 2);
    expect(r.withdrawalTax / 1e5).toBeCloseTo(8.33, 2);
  });

  it('most for 25 years: ₹26,409 rising to ₹1,06,928; ₹19,302 at 7%', () => {
    const max = maxWithdrawal(plan, incomeTax);
    expect(max).toBe(26_409);
    expect(Math.round(max * Math.pow(1.06, 24))).toBe(106_928);
    expect(maxWithdrawal({ ...plan, annualReturn: 0.07 }, incomeTax)).toBe(19_302);
  });
});

describe('post: a plan that pays back 3 times', () => {
  const r = planReturn({
    premium: 50_000,
    payFrequency: 'yearly',
    payYears: 15,
    income: 5_000,
    incomeFrequency: 'monthly',
    incomeStartYear: 16,
    incomeYears: 25,
    lumpSums: [{ amount: 750_000, year: 40 }],
    taxRate: 0,
    inflation: 0.06,
  });

  it('₹7.5 lakh in, ₹22.5 lakh back: 4.8% a year, −1.1% after inflation, even in year 28', () => {
    expect(r.paid).toBe(750_000);
    expect(r.received).toBe(2_250_000);
    expect(r.annualReturn).toBeCloseTo(0.048, 3);
    expect(r.realReturn).toBeCloseTo(-0.011, 3);
    expect(r.paybackYear).toBe(28);
  });

  it("at PPF's 7.1%: ₹7,975 a month and ₹11.96 lakh at the end", () => {
    expect(smallSavings.ppf.rate).toBe(0.071);
    const scale = payoutScaleAt(r, smallSavings.ppf.rate)!;
    expect(Math.round(5_000 * scale)).toBe(7_975);
    expect((750_000 * scale) / 1e5).toBeCloseTo(11.96, 2);
  });

  it("today's rupees: ₹2,076 in year 16, ₹486 in year 40, ₹72,900 for the ₹7.5 lakh", () => {
    expect(Math.round(r.firstIncomeToday!)).toBe(2_076);
    expect(Math.round(toTodaysRupees(5_000, 0.06, 480))).toBe(486);
    expect(Math.round(toTodaysRupees(750_000, 0.06, 480) / 100) * 100).toBe(72_900);
  });

  it('3 times in one go: 24.57% over 5 years down to 2.78% over 40', () => {
    expect(Math.pow(3, 1 / 5) - 1).toBeCloseTo(0.2457, 4);
    expect(Math.pow(3, 1 / 40) - 1).toBeCloseTo(0.0278, 4);
  });
});

describe('post: old or new tax regime, what counts as a deduction', () => {
  it('the limits it quotes', () => {
    const d = incomeTax.deductions;
    expect(d.section80C).toBe(150_000);
    expect(d.nps80CCD1B).toBe(50_000);
    expect([d.health80D.self, d.health80D.parents, d.health80D.selfSenior]).toEqual([
      25_000, 25_000, 50_000,
    ]);
    expect(d.homeLoanInterestSelfOccupied).toBe(200_000);
    expect(incomeTax.hra.largeCities).toHaveLength(8);
    expect([incomeTax.hra.largeCityShare, incomeTax.hra.otherShare]).toEqual([0.5, 0.4]);
  });

  it('₹15 lakh with HRA, full 80C and health: ₹4.15 lakh, about ₹1.29 lakh short of ₹5,43,750', () => {
    const input = {
      salary: 1_500_000,
      otherIncome: 0,
      oldDeductions: 240_000 + 150_000 + 25_000,
      newDeductions: 0,
    };
    const breakEven = breakEvenDeductions(input, incomeTax)!;
    expect(breakEven).toBeCloseTo(543_750, 0);
    expect((breakEven - input.oldDeductions) / 1e5).toBeCloseTo(1.29, 2);
  });
});

describe('post: what a 1% rate rise does to your EMI', () => {
  const lakh = (x: number) => Math.round(x / 1e3) / 100;
  const f = rateRise;

  it('the loan, and what is owed after three years', () => {
    expect(Math.round(f.base.emi)).toBe(35_989);
    expect(lakh(f.base.totalInterest!)).toBe(46.37);
    expect(lakh(f.base.balanceAtChange)).toBe(37.54);
  });

  it('way one: the EMI rises by ₹2,342 to ₹38,331, ₹4.78 lakh more interest', () => {
    expect(Math.round(f.up1Emi.newEmi)).toBe(38_331);
    expect(Math.round(f.up1Emi.newEmi) - Math.round(f.base.emi)).toBe(2_342);
    expect(lakh(f.up1Emi.totalInterest!)).toBe(51.15);
    expect(lakh(f.up1Emi.totalInterest! - f.base.totalInterest!)).toBe(4.78);
    expect(Math.round(f.fromStart.emi === f.base.emi ? f.fromStart.newEmi : 0)).toBe(38_601);
    expect(f.fromStart.newEmi / f.base.emi - 1).toBeCloseTo(0.07, 2);
  });

  it('way two: 23 years 6 months, ₹61.15 lakh, ₹14.77 lakh more', () => {
    expect(f.up1Tenure.totalMonths).toBe(282);
    expect(lakh(f.up1Tenure.totalInterest!)).toBe(61.15);
    expect(lakh(f.up1Tenure.totalInterest! - f.base.totalInterest!)).toBe(14.77);
  });

  it('bigger rises, and a fall', () => {
    expect(Math.round(f.up2Emi.newEmi)).toBe(40_740);
    expect(f.up2Tenure.totalMonths).toBe(379);
    expect(lakh(f.up2Tenure.totalInterest!)).toBe(96.2);
    expect(Math.round(f.up3Tenure.balanceAtChange * 0.01)).toBe(37_535);
    expect(f.up3Tenure.emiBelowInterest).toBe(true);
    expect(Math.round(f.up3Emi.newEmi)).toBe(43_211);
    expect(240 - f.down1Tenure.totalMonths!).toBe(25);
  });

  it('break-even floating rates for a fixed 9.5% and 10%', () => {
    expect(f.breakEven.map((b) => Math.round(b.floating * 10_000) / 100)).toEqual([9.65, 10.31]);
  });
});

describe('post: ₹1 lakh a year in 80C', () => {
  const lakh = (x: number) => Math.round(x / 1e3) / 100;
  const e = eightyC;

  it('the same tax saved: ₹31,200 a year, ₹3.74 lakh over 12 years', () => {
    // ₹1 lakh × 30% × 1.04.
    expect(Math.round(e.taxSavedYearly)).toBe(31_200);
    expect(lakh(e.taxSavedTotal)).toBe(3.74);
  });

  it('the endowment example: ₹12 lakh paid, ₹20 lakh back, 3.5% a year', () => {
    expect(e.paid).toBe(1_200_000);
    expect(e.plan).toBe(2_000_000);
    expect(Math.round(e.planReturn * 1000) / 10).toBe(3.5);
  });

  it('PPF: ₹1 lakh at the start of years 1 to 12, at 7.1% to the end of year 20: ₹33.36 lakh', () => {
    const direct = Array.from({ length: 12 }, (_, k) => 100_000 * Math.pow(1.071, 20 - k)).reduce(
      (a, b) => a + b,
      0,
    );
    expect(e.ppf).toBeCloseTo(direct, 2);
    expect(lakh(e.ppf)).toBe(33.36);
  });

  it('ELSS at 10%: ₹50.42 lakh, ₹4.83 lakh tax, ₹45.59 lakh kept', () => {
    // Gain 50.42 − 12 = 38.42 lakh; (38.42 − 1.25) × 12.5% × 1.04 = 4.83 lakh.
    expect(lakh(e.elssGross)).toBe(50.42);
    expect(e.elssTax).toBeCloseTo((e.elssGross - 1_200_000 - 125_000) * 0.125 * 1.04, 4);
    expect(lakh(e.elssTax)).toBe(4.83);
    expect(lakh(e.elss)).toBe(45.59);
  });
});

describe('post: HRA in the 8 cities', () => {
  const h = hraFigures;
  const at = (rent: number) => h.rows.find((r) => r.monthlyRent === rent)!;

  it('the four new 50% cities', () => {
    expect(h.newCities).toEqual(['bengaluru', 'hyderabad', 'pune', 'ahmedabad']);
  });

  it('₹30,000 rent: rent − 10% of salary (₹2.8 lakh) already set the limit, so nothing changes', () => {
    // 3,60,000 − 80,000 = 2,80,000, below 40% of 8 lakh (3,20,000).
    expect(at(30_000)).toMatchObject({ before: 280_000, now: 280_000, extra: 0 });
  });

  it('₹35,000 rent: ₹3.2 lakh to ₹3.4 lakh', () => {
    // 4,20,000 − 80,000 = 3,40,000, between 40% (3.2 lakh) and 50% (4 lakh).
    expect(at(35_000)).toMatchObject({ before: 320_000, now: 340_000, extra: 20_000 });
  });

  it('₹40,000 rent: ₹80,000 more exempt, ₹24,960 less tax', () => {
    // 4,80,000 − 80,000 = 4,00,000; 50% of salary 4,00,000; HRA 4,00,000. 80,000 × 30% × 1.04.
    expect(at(40_000)).toMatchObject({ before: 320_000, now: 400_000, extra: 80_000 });
    expect(Math.round(at(40_000).taxSaved)).toBe(24_960);
  });

  it('the change starts to help above ₹33,333 rent, and adds at most ₹80,000', () => {
    expect(Math.round(h.gainsAbove)).toBe(33_333);
    expect(Math.round(h.maxExtra)).toBe(80_000);
    expect(at(50_000).extra).toBe(80_000);
  });
});

describe('post: money-back plans vs PPF', () => {
  const m = moneyBackFigures;
  const lakh = (x: number) => Math.round(x / 1e3) / 100;

  it('₹6 lakh in, ₹9 lakh out, about 4.4% a year, −1.5% after 6% inflation', () => {
    expect(m.plan.paid).toBe(600_000);
    expect(m.plan.received).toBe(900_000);
    expect(Math.round(m.plan.annualReturn! * 1000) / 10).toBe(4.4);
    expect(Math.round(m.plan.realReturn! * 1000) / 10).toBe(-1.5);
  });

  it('at PPF’s 7.1% every payout is 25% larger: ₹1.25 lakh, and ₹11.28 lakh in all', () => {
    expect(Math.round(m.scale * 100) / 100).toBe(1.25);
    expect(lakh(100_000 * m.scale)).toBe(1.25);
    expect(lakh(m.plan.kept * m.scale)).toBe(11.28);
  });

  it('PPF check: the premiums grown at 7.1% to year 20 match the scaled payouts grown the same way', () => {
    const fv = (amount: number, fromYear: number) => amount * Math.pow(1.071, 20 - fromYear);
    const premiums = Array.from({ length: 15 }, (_, k) => fv(40_000, k)).reduce((a, b) => a + b, 0);
    const payouts = [5, 10, 15].map((y) => fv(100_000, y)).reduce((a, b) => a + b, 600_000);
    expect(premiums / payouts).toBeCloseTo(m.scale, 6);
  });

  it('₹3 lakh back of ₹6 lakh by year 15; all of it only in year 20', () => {
    expect(m.plan.paybackYear).toBe(20);
    expect(m.table.rows.map((r) => r[1])).toEqual([
      '₹2.00 lakh',
      '₹4.00 lakh',
      '₹6.00 lakh',
      '₹6.00 lakh',
    ]);
  });
});

describe('post: how much to save to retire at 55', () => {
  const r = retire55;
  const crore = (x: number) => Math.round(x / 1e5) / 100;
  const at = (ret: number) => r.rows.find((x) => x.annualReturn === ret)!;

  it('₹50,000 today is ₹2,14,594 a month at 55, 4.3 times as much', () => {
    // 50,000 × 1.06^25.
    expect(Math.round(r.need)).toBe(214_594);
    expect(Math.round(Math.pow(1.06, 25) * 10) / 10).toBe(4.3);
  });

  it('at 10%: a ₹4.51 crore pot, ₹1.05 crore today, about 210 times ₹50,000', () => {
    expect(crore(r.base.pot)).toBe(4.51);
    expect(crore(r.base.potToday)).toBe(1.05);
    expect(Math.round(r.base.potToday / 50_000)).toBe(210);
  });

  it('₹40,265 a month flat, or ₹15,770 rising 10% a year (over ₹1.5 lakh by 54)', () => {
    expect(Math.round(r.base.flat)).toBe(40_265);
    expect(Math.round(r.base.stepped)).toBe(15_770);
    expect(r.base.stepped * Math.pow(1.1, 24)).toBeGreaterThan(150_000);
  });

  it('8% and 12%', () => {
    expect(crore(at(0.08).pot)).toBe(5.73);
    expect(Math.round(at(0.08).flat)).toBe(68_571);
    expect(crore(at(0.12).pot)).toBe(3.66);
    expect(Math.round(at(0.12).flat)).toBe(24_044);
  });
});
