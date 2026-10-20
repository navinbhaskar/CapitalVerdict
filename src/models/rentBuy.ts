/**
 * Rent vs buy a home: net worth of a buyer and of a renter who invests the difference.
 *
 * Month by month over the horizon:
 *   Buyer pays EMI (until the loan ends) + maintenance (a share of the home's value, a year) +
 *   property tax (rising with inflation each year).
 *   Renter pays rent (rising by the rent growth each year).
 *   Whoever spends less that month invests the difference at the post-tax return.
 * At the start, the renter invests what the buyer spent upfront (down payment, stamp duty and
 * registration, other costs) minus the security deposit, which comes back at the end.
 *
 *   Buyer net worth  = home value − outstanding loan − selling cost + buyer's investments
 *   Renter net worth = renter's investments + security deposit
 *
 * Not modelled in v1 (shown on the page): income-tax benefits on home loans, home insurance,
 * vacancy, rent agreement costs, and moving costs.
 */
import { breakeven } from '@/engine/breakeven';
import { emi as loanEmi } from '@/engine/loan';
import { runScenarios } from '@/engine/scenarios';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { effectiveToMonthly, growthFactor, toTodaysRupees } from '@/engine/timeValue';

export interface RentBuyInput {
  homePrice: number;
  /** Decimal of the price, e.g. 0.2. */
  downPayment: number;
  /** Annual, nominal, monthly compounding. */
  loanRate: number;
  loanYears: number;
  /** Stamp duty and registration, decimal of the price. */
  stampDuty: number;
  /** Brokerage, legal, interiors you would not buy as a renter, ₹. */
  otherUpfront: number;
  /** Maintenance and repairs a year, decimal of the home's value. */
  maintenance: number;
  /** Property tax a year at the start, ₹. Rises with inflation. */
  propertyTax: number;
  /** Home price growth a year (effective). */
  appreciation: number;
  /** Selling cost at the end, decimal of the value. */
  sellingCost: number;
  monthlyRent: number;
  /** Rent increase a year. */
  rentGrowth: number;
  securityDeposit: number;
  /** Return on invested money after tax, a year (effective). */
  investmentReturn: number;
  /** Used for property tax growth and today's-rupees figures. */
  inflation: number;
  horizonYears: number;
  /**
   * Extra paid towards the loan at the end of every year, ₹ (optional). The EMI stays the same,
   * so the loan ends sooner. It is part of the buyer's outflow, so the renter invests it too.
   */
  prepayYearly?: number;
}

export interface RentBuyResult {
  emi: number;
  loanAmount: number;
  /** Cash the buyer spends at purchase: down payment + stamp duty + other costs. */
  upfrontCash: number;
  /** Per month, index 0 = month 1. */
  homeValue: number[];
  outstanding: number[];
  buyerOutflow: number[];
  rent: number[];
  buyerNetWorth: number[];
  renterNetWorth: number[];
  /** buyer − renter, index = month, 0 = purchase day. */
  difference: number[];
  /** First month the buyer's net worth reaches the renter's, if it does. */
  crossover: { months: number; years: number } | null;
  atHorizon: { buyer: number; renter: number; difference: number; differenceToday: number };
  /** Prepayment made each month (non-zero at year ends only), index 0 = month 1. */
  prepaid: number[];
  /** Interest paid on the loan within the horizon, ₹. */
  interestPaid: number;
  /** Month the loan is fully repaid; null if it runs past the horizon (0 without a loan). */
  loanPaidOffMonth: number | null;
  /** Components at the horizon, for the working. */
  end: {
    homeValue: number;
    outstanding: number;
    sellingCost: number;
    buyerInvestments: number;
    renterInvestments: number;
  };
}

function validate(i: RentBuyInput): void {
  const nonNegative = {
    homePrice: i.homePrice,
    loanRate: i.loanRate,
    stampDuty: i.stampDuty,
    otherUpfront: i.otherUpfront,
    maintenance: i.maintenance,
    propertyTax: i.propertyTax,
    sellingCost: i.sellingCost,
    monthlyRent: i.monthlyRent,
    securityDeposit: i.securityDeposit,
  };
  for (const [name, v] of Object.entries(nonNegative)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!(i.downPayment >= 0 && i.downPayment <= 1)) throw new RangeError('downPayment is 0–1');
  if (!Number.isInteger(i.horizonYears) || i.horizonYears < 1) {
    throw new RangeError('horizonYears must be a positive whole number');
  }
  if (i.downPayment < 1 && !(Number.isInteger(i.loanYears) && i.loanYears >= 1)) {
    throw new RangeError('loanYears must be a positive whole number');
  }
  if (i.prepayYearly !== undefined && !(i.prepayYearly >= 0)) {
    throw new RangeError('prepayYearly must not be negative');
  }
}

export function rentVsBuy(input: RentBuyInput): RentBuyResult {
  validate(input);
  const months = input.horizonYears * 12;
  const loanAmount = input.homePrice * (1 - input.downPayment);
  const loanMonths = Math.max(1, input.loanYears * 12);
  const r = input.loanRate / 12;
  const emi = loanAmount > 0 ? loanEmi(loanAmount, input.loanRate, loanMonths) : 0;
  const invest = effectiveToMonthly(input.investmentReturn);
  const upfrontCash =
    input.homePrice * input.downPayment + input.homePrice * input.stampDuty + input.otherUpfront;

  let balance = loanAmount;
  let renterPot = upfrontCash - input.securityDeposit;
  let buyerPot = 0;
  const homeValue: number[] = [];
  const outstanding: number[] = [];
  const buyerOutflow: number[] = [];
  const rent: number[] = [];
  const buyerNetWorth: number[] = [];
  const renterNetWorth: number[] = [];
  const prepaid: number[] = [];
  let interestPaid = 0;
  let loanPaidOffMonth: number | null = loanAmount > 0 ? null : 0;
  const difference = [
    input.homePrice * (1 - input.sellingCost) - loanAmount - (renterPot + input.securityDeposit),
  ];

  for (let m = 1; m <= months; m++) {
    const year = Math.floor((m - 1) / 12);
    const valueBefore = input.homePrice * Math.pow(1 + input.appreciation, (m - 1) / 12);
    const value = input.homePrice * Math.pow(1 + input.appreciation, m / 12);

    let payment = 0;
    if (balance > 1e-9) {
      const interest = balance * r;
      interestPaid += interest;
      payment = Math.min(emi, balance + interest);
      balance = balance + interest - payment;
      // Under a paisa left is rounding, not debt.
      if (balance < 0.01) balance = 0;
    }
    // Yearly prepayment, after the twelfth EMI of each year.
    let extra = 0;
    if (input.prepayYearly && m % 12 === 0 && balance > 1e-9) {
      extra = Math.min(input.prepayYearly, balance);
      balance -= extra;
    }
    if (loanPaidOffMonth === null && balance <= 1e-9) loanPaidOffMonth = m;
    prepaid.push(extra);
    const outflow =
      payment +
      extra +
      (valueBefore * input.maintenance) / 12 +
      (input.propertyTax * growthFactor(input.inflation, year)) / 12;
    const rentNow = input.monthlyRent * growthFactor(input.rentGrowth, year);
    const gap = outflow - rentNow;
    renterPot = renterPot * (1 + invest) + Math.max(gap, 0);
    buyerPot = buyerPot * (1 + invest) + Math.max(-gap, 0);

    const buyer = value - balance - input.sellingCost * value + buyerPot;
    const renter = renterPot + input.securityDeposit;
    homeValue.push(value);
    outstanding.push(balance);
    buyerOutflow.push(outflow);
    rent.push(rentNow);
    buyerNetWorth.push(buyer);
    renterNetWorth.push(renter);
    difference.push(buyer - renter);
  }

  const cross = breakeven(
    difference,
    difference.map(() => 0),
  );
  const last = months - 1;
  const diff = buyerNetWorth[last]! - renterNetWorth[last]!;
  return {
    emi,
    loanAmount,
    upfrontCash,
    homeValue,
    outstanding,
    buyerOutflow,
    rent,
    buyerNetWorth,
    renterNetWorth,
    difference,
    prepaid,
    interestPaid,
    loanPaidOffMonth,
    crossover: cross && cross.month > 0 ? { months: cross.month, years: cross.month / 12 } : null,
    atHorizon: {
      buyer: buyerNetWorth[last]!,
      renter: renterNetWorth[last]!,
      difference: diff,
      differenceToday: toTodaysRupees(diff, input.inflation, months),
    },
    end: {
      homeValue: homeValue[last]!,
      outstanding: outstanding[last]!,
      sellingCost: input.sellingCost * homeValue[last]!,
      buyerInvestments:
        buyerNetWorth[last]! -
        homeValue[last]! +
        outstanding[last]! +
        input.sellingCost * homeValue[last]!,
      renterInvestments: renterNetWorth[last]! - input.securityDeposit,
    },
  };
}

export interface RentBuyScenarioSets {
  appreciation: { pessimistic: number; base: number; optimistic: number };
  rentGrowth: { pessimistic: number; base: number; optimistic: number };
}

/**
 * The default scenario table, read as "how the economy turns out": pessimistic = low home price
 * growth and high rent growth, and so on. Each run changes only these two inputs.
 */
export function rentBuyScenarios(input: RentBuyInput, sets: RentBuyScenarioSets) {
  const pick = (k: 'pessimistic' | 'base' | 'optimistic') => ({
    appreciation: sets.appreciation[k],
    rentGrowth: sets.rentGrowth[k],
  });
  return runScenarios(rentVsBuy, input, {
    pessimistic: pick('pessimistic'),
    base: pick('base'),
    optimistic: pick('optimistic'),
  });
}

export type RentBuyVariable = 'appreciation' | 'investmentReturn' | 'monthlyRent' | 'loanRate';

export interface RentBuyFlip extends Flip {
  variable: RentBuyVariable;
}

/** Where buying and renting end level at the horizon, one input at a time. Positive = buying wins. */
export function rentBuyFlips(input: RentBuyInput, only?: RentBuyVariable[]): RentBuyFlip[] {
  const diff = (i: RentBuyInput) => rentVsBuy(i).atHorizon.difference;
  const probes: { variable: RentBuyVariable; lo: number; hi: number }[] = [
    { variable: 'appreciation', lo: -0.05, hi: 0.2 },
    { variable: 'investmentReturn', lo: 0, hi: 0.2 },
    { variable: 'monthlyRent', lo: 0, hi: Math.max(input.monthlyRent * 4, 1) },
    { variable: 'loanRate', lo: 0, hi: 0.2 },
  ];
  const flips: RentBuyFlip[] = [];
  for (const { variable, lo, hi } of probes) {
    if (only && !only.includes(variable)) continue;
    if (variable === 'loanRate' && input.downPayment >= 1) continue;
    const flip = findFlip((v) => diff({ ...input, [variable]: v }), { lo, hi, steps: 50 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}
