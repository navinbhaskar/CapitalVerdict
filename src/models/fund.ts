/**
 * An equity mutual fund, month by month: a lump sum at the start, a SIP at the start of every month
 * (rising each year by a step-up), and withdrawals at the end of every month (an SWP, rising each
 * year if asked). One model for the SIP, lumpsum and SWP calculators.
 *
 * Every purchase is kept as its own lot, so tax follows the rules for each: units held 12 months or
 * less are short-term, the rest long-term; units are sold oldest first. Tax is worked out per
 * year of the plan (12-month blocks from the start, standing in for financial years) on the gains
 * actually sold: short-term at the short-term rate, long-term above the yearly exemption at the
 * long-term rate, plus cess. Rates come from the verified income tax data.
 *
 * The return is effective a year (12% a year means 12% a year), applied monthly as
 * (1 + r)^(1/12) − 1. Many calculators use r ÷ 12 a month instead, which compounds to a little more.
 */
import { effectiveToMonthly, toTodaysRupees } from '@/engine/timeValue';
import { findFlip } from '@/engine/sensitivity';
import type { IncomeTaxData } from '@/data/schema';

export interface FundInput {
  /** Invested at the start, ₹. */
  lumpSum: number;
  /** SIP at the start of each month in year 1, ₹. */
  monthly: number;
  /** Yearly rise in the SIP, decimal (0.1 = 10% more each year). */
  stepUp: number;
  /** Withdrawn at the end of each month in year 1, ₹. */
  withdrawal: number;
  /** Yearly rise in the withdrawal, decimal. */
  withdrawalRise: number;
  /** Whole years, 1 to 50. */
  years: number;
  /** Fund return a year before tax, effective. */
  annualReturn: number;
  /** For today's-rupees figures. */
  inflation: number;
}

export interface FundYear {
  /** 0 = today. */
  year: number;
  /** Put in during the year, ₹. */
  invested: number;
  /** Taken out during the year, ₹. */
  withdrawn: number;
  /** Tax on the gains in this year's withdrawals, ₹. */
  tax: number;
  /** Fund value at the end of the year, ₹. */
  value: number;
  /** Put in so far, ₹. */
  investedToDate: number;
}

export interface CapitalGains {
  shortTermGain: number;
  longTermGain: number;
  /** Long-term gain covered by the yearly exemption, ₹. */
  exempt: number;
  tax: number;
}

export interface FundResult {
  months: number;
  /** Total put in, ₹. */
  invested: number;
  /** Total taken out, ₹. */
  withdrawn: number;
  /** Tax on the gains in the withdrawals, ₹. */
  withdrawalTax: number;
  /** Fund value at the end, before any sale, ₹. */
  value: number;
  /** Tax if everything left were sold at the end. */
  sale: CapitalGains;
  /** What you keep if you sell at the end: value − sale tax. */
  kept: number;
  /** `kept` in today's rupees. */
  keptToday: number;
  /** First month the fund could not pay the full withdrawal, or null if it lasted. */
  depletedMonth: number | null;
  /** Fund value at the end of each month, index 0 = today (after any lump sum). */
  valueByMonth: number[];
  /** Put in so far, by month (index 0 = today). */
  investedByMonth: number[];
  /** Taken out so far, by month (index 0 = today). */
  withdrawnByMonth: number[];
  byYear: FundYear[];
}

interface Lot {
  /** Month the units were bought at (0 = start). */
  bought: number;
  units: number;
}

export function validateFund(i: FundInput): void {
  for (const [name, v] of Object.entries(i)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!Number.isInteger(i.years) || i.years < 1 || i.years > 50) {
    throw new RangeError('years must be a whole number from 1 to 50');
  }
  if (i.lumpSum + i.monthly <= 0) throw new RangeError('something must be invested');
}

/** Tax on one year's sold gains under the equity rules, with cess. */
export function equityGainsTax(
  shortTermGain: number,
  longTermGain: number,
  rules: IncomeTaxData,
): CapitalGains {
  const cg = rules.capitalGains;
  const short = Math.max(0, shortTermGain);
  const long = Math.max(0, longTermGain);
  const exempt = Math.min(long, cg.equityLongTermExemption);
  const tax =
    (short * cg.equityShortTermRate + (long - exempt) * cg.longTermRate) * (1 + rules.cessRate);
  return { shortTermGain: short, longTermGain: long, exempt, tax };
}

export function fundPlan(input: FundInput, rules: IncomeTaxData): FundResult {
  validateFund(input);
  const months = input.years * 12;
  const g = effectiveToMonthly(input.annualReturn);
  const nav = (m: number) => Math.pow(1 + g, m);
  const longAfter = rules.capitalGains.listedLongTermAfterMonths;
  const lots: Lot[] = [];
  const buy = (amount: number, month: number) => {
    if (amount > 0) lots.push({ bought: month, units: amount / nav(month) });
  };
  const unitsHeld = () => lots.reduce((s, l) => s + l.units, 0);

  /** Sell `amount` of value at month m, oldest units first. Returns the gains and what was sold. */
  const sell = (amount: number, m: number) => {
    const price = nav(m);
    let units = amount / price;
    let short = 0;
    let long = 0;
    let sold = 0;
    while (units > 1e-12 && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(lot.units, units);
      const gain = take * (price - nav(lot.bought));
      if (m - lot.bought <= longAfter) short += gain;
      else long += gain;
      sold += take * price;
      lot.units -= take;
      units -= take;
      if (lot.units <= 1e-12) lots.shift();
    }
    return { short, long, sold };
  };

  buy(input.lumpSum, 0);
  let invested = input.lumpSum;
  let withdrawn = 0;
  let withdrawalTax = 0;
  let depletedMonth: number | null = null;
  const valueByMonth = [unitsHeld() * nav(0)];
  const investedByMonth = [invested];
  const withdrawnByMonth = [0];
  const byYear: FundYear[] = [
    {
      year: 0,
      invested: 0,
      withdrawn: 0,
      tax: 0,
      value: valueByMonth[0]!,
      investedToDate: invested,
    },
  ];
  let yearInvested = 0;
  let yearWithdrawn = 0;
  let yearShort = 0;
  let yearLong = 0;

  for (let m = 1; m <= months; m++) {
    const year = Math.ceil(m / 12);
    // SIP at the start of month m (time m − 1).
    const sip = input.monthly * Math.pow(1 + input.stepUp, year - 1);
    buy(sip, m - 1);
    invested += sip;
    yearInvested += sip;
    // Withdrawal at the end of month m.
    const want = input.withdrawal * Math.pow(1 + input.withdrawalRise, year - 1);
    if (want > 0) {
      const available = unitsHeld() * nav(m);
      if (want > available + 1e-6 && depletedMonth === null) depletedMonth = m;
      const { short, long, sold } = sell(Math.min(want, available), m);
      yearShort += short;
      yearLong += long;
      withdrawn += sold;
      yearWithdrawn += sold;
    }
    valueByMonth.push(unitsHeld() * nav(m));
    investedByMonth.push(invested);
    withdrawnByMonth.push(withdrawn);
    if (m % 12 === 0) {
      const tax = equityGainsTax(yearShort, yearLong, rules).tax;
      withdrawalTax += tax;
      byYear.push({
        year,
        invested: yearInvested,
        withdrawn: yearWithdrawn,
        tax,
        value: valueByMonth[m]!,
        investedToDate: invested,
      });
      // The last year's withdrawal gains stay counted, for the sale at the end.
      if (m < months) {
        yearShort = 0;
        yearLong = 0;
      }
      yearInvested = 0;
      yearWithdrawn = 0;
    }
  }

  // Selling everything at the end falls in the last year, alongside that year's withdrawals.
  const value = valueByMonth[months]!;
  const withdrawalsOnly = equityGainsTax(yearShort, yearLong, rules);
  const rest = sell(value, months);
  const all = equityGainsTax(yearShort + rest.short, yearLong + rest.long, rules);
  const sale: CapitalGains = {
    shortTermGain: rest.short,
    longTermGain: rest.long,
    exempt: all.exempt - withdrawalsOnly.exempt,
    tax: all.tax - withdrawalsOnly.tax,
  };
  const kept = value - sale.tax;

  return {
    months,
    invested,
    withdrawn,
    withdrawalTax,
    value,
    sale,
    kept,
    keptToday: toTodaysRupees(kept, input.inflation, months),
    depletedMonth,
    valueByMonth,
    investedByMonth,
    withdrawnByMonth,
    byYear,
  };
}

/**
 * The largest first-year monthly withdrawal the fund can pay for all its years (rising as set),
 * to the nearest rupee. 0 if nothing is invested.
 */
export function maxWithdrawal(input: FundInput, rules: IncomeTaxData): number {
  const lasts = (w: number) => fundPlan({ ...input, withdrawal: w }, rules).depletedMonth === null;
  let lo = 0;
  let hi = Math.max(1, input.lumpSum + input.monthly * input.years * 12);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lasts(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** The fund return a year at which the plan's withdrawals just last (SWP), or null if none in range. */
export function returnToLast(input: FundInput, rules: IncomeTaxData) {
  const left = (r: number) => {
    const p = fundPlan({ ...input, annualReturn: r }, rules);
    return p.depletedMonth === null ? p.value : -(p.months - p.depletedMonth + 1);
  };
  return findFlip(left, { lo: 0, hi: 0.3, steps: 60 });
}
