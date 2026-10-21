/**
 * Buy a plot, or put the same money in a fixed deposit or an equity mutual fund, and hold for the
 * same whole number of years (at least three, so every gain is long-term).
 *
 * The cash is what the plot really costs today: price + stamp duty and registration + other buying
 * costs (brokerage, legal). The FD and the fund get exactly that cash.
 *
 *   Plot:  sells at price × (1 + growth)^years, less selling costs. Long-term capital-gains tax on
 *          the gain over the cash paid (stamp duty and buying costs count in the cost). The plot's
 *          yearly costs are subtracted as paid, without interest, which flatters the plot slightly.
 *   FD:    interest is taxed every year at your rate, so it grows at rate × (1 − your tax rate).
 *   Fund:  grows at your expected return; at the end, long-term capital-gains tax on the gain
 *          above the yearly exemption (assuming no other equity gains that year).
 * Cess is added to both capital-gains taxes. Rates come from src/data/incomeTax.json.
 */
import { findFlip, type Flip } from '@/engine/sensitivity';
import { toTodaysRupees } from '@/engine/timeValue';
import type { IncomeTaxData } from '@/data/schema';

export type PlotOption = 'plot' | 'fd' | 'fund';

export interface PlotVsInput {
  plotPrice: number;
  /** Stamp duty and registration together, decimal of the price. */
  stampDuty: number;
  /** Brokerage, legal and other buying costs, ₹. */
  otherBuyCosts: number;
  /** Fencing, upkeep and property tax a year, ₹. */
  yearlyCost: number;
  /** Plot price growth a year (effective). */
  plotGrowth: number;
  /** Selling costs, decimal of the sale price. */
  sellingCost: number;
  /** FD interest a year (effective). */
  fdRate: number;
  /** Your tax rate on FD interest, with cess, decimal. */
  taxRate: number;
  /** Expected fund return a year, before tax (effective). */
  fundReturn: number;
  years: number;
  inflation: number;
}

export interface OptionEnd {
  /** Value before tax at the end, ₹ (plot: after selling costs). */
  value: number;
  /** Tax paid, ₹ (FD: over the years). */
  tax: number;
  /** What you keep at the end, ₹. */
  net: number;
  /** Yearly return on the cash, after tax and costs. */
  yearlyReturn: number;
  /** Value kept each year, index 0 = today. */
  byYear: number[];
}

export interface PlotVsResult {
  cash: number;
  plot: OptionEnd & { salePrice: number; sellingCosts: number; gain: number; upkeep: number };
  fd: OptionEnd;
  fund: OptionEnd & { gain: number; exempt: number };
  best: PlotOption;
  /** Best option's lead over the next best, ₹. */
  lead: number;
  /** The best option's result in today's rupees. */
  bestToday: number;
}

function validate(i: PlotVsInput): void {
  for (const [name, v] of Object.entries(i)) {
    if (name === 'plotGrowth') continue;
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!(i.plotPrice > 0)) throw new RangeError('plotPrice must be positive');
  if (!(i.plotGrowth > -1)) throw new RangeError('plotGrowth must be above −100%');
  if (!(i.taxRate < 1 && i.sellingCost < 1)) throw new RangeError('rates must be below 100%');
  if (!Number.isInteger(i.years) || i.years < 3) {
    throw new RangeError('years must be a whole number, at least 3');
  }
}

const yearlyReturn = (end: number, start: number, years: number) =>
  end > 0 ? Math.pow(end / start, 1 / years) - 1 : -1;

export function plotVs(input: PlotVsInput, rules: IncomeTaxData): PlotVsResult {
  validate(input);
  const { years } = input;
  const cg = rules.capitalGains;
  const cgRate = cg.longTermRate * (1 + rules.cessRate);
  const cash = input.plotPrice * (1 + input.stampDuty) + input.otherBuyCosts;

  // Plot: value after selling costs, less tax on the gain and the yearly costs paid so far.
  const plotYear = (y: number) => {
    const sale = input.plotPrice * Math.pow(1 + input.plotGrowth, y);
    const afterCosts = sale * (1 - input.sellingCost);
    const gain = afterCosts - cash;
    const tax = y === 0 ? 0 : Math.max(0, gain) * cgRate;
    return { sale, afterCosts, gain, tax, kept: afterCosts - tax - input.yearlyCost * y };
  };
  const plotEnd = plotYear(years);

  // FD: interest taxed every year.
  const fdNetRate = input.fdRate * (1 - input.taxRate);
  const fdYear = (y: number) => cash * Math.pow(1 + fdNetRate, y);
  const fdGross = cash * Math.pow(1 + input.fdRate, years);
  const fdNet = fdYear(years);

  // Fund: tax once, on selling.
  const fundYear = (y: number) => {
    const value = cash * Math.pow(1 + input.fundReturn, y);
    const gain = value - cash;
    const tax = y === 0 ? 0 : Math.max(0, gain - cg.equityLongTermExemption) * cgRate;
    return { value, gain, tax, kept: value - tax };
  };
  const fundEnd = fundYear(years);

  const range = Array.from({ length: years + 1 }, (_, y) => y);
  const nets: Record<PlotOption, number> = {
    plot: plotEnd.kept,
    fd: fdNet,
    fund: fundEnd.kept,
  };
  const order = (Object.keys(nets) as PlotOption[]).sort((a, b) => nets[b] - nets[a]);
  const best = order[0]!;

  return {
    cash,
    plot: {
      value: plotEnd.afterCosts,
      tax: plotEnd.tax,
      net: plotEnd.kept,
      yearlyReturn: yearlyReturn(plotEnd.kept, cash, years),
      byYear: range.map((y) => plotYear(y).kept),
      salePrice: plotEnd.sale,
      sellingCosts: plotEnd.sale - plotEnd.afterCosts,
      gain: plotEnd.gain,
      upkeep: input.yearlyCost * years,
    },
    fd: {
      value: fdNet,
      tax: fdGross - fdNet,
      net: fdNet,
      yearlyReturn: fdNetRate,
      byYear: range.map(fdYear),
    },
    fund: {
      value: fundEnd.value,
      tax: fundEnd.tax,
      net: fundEnd.kept,
      yearlyReturn: yearlyReturn(fundEnd.kept, cash, years),
      byYear: range.map((y) => fundYear(y).kept),
      gain: fundEnd.gain,
      exempt: Math.min(Math.max(0, fundEnd.gain), cg.equityLongTermExemption),
    },
    best,
    lead: nets[best] - nets[order[1]!],
    bestToday: toTodaysRupees(nets[best], input.inflation, years * 12),
  };
}

export type PlotVsVariable = 'plotGrowth' | 'fundReturn' | 'fdRate';

export interface PlotVsFlip extends Flip {
  variable: PlotVsVariable;
}

/**
 * The plot price growth at which the plot matches the better of the FD and the fund, and the fund
 * return at which the fund matches the FD. Positive answer = the first option is ahead.
 */
export function plotVsFlips(input: PlotVsInput, rules: IncomeTaxData): PlotVsFlip[] {
  const flips: PlotVsFlip[] = [];
  const plotGap = (g: number) => {
    const r = plotVs({ ...input, plotGrowth: g }, rules);
    return r.plot.net - Math.max(r.fd.net, r.fund.net);
  };
  const plot = findFlip(plotGap, { lo: -0.05, hi: 0.4, steps: 90 });
  if (plot) flips.push({ variable: 'plotGrowth', ...plot });
  const fundGap = (g: number) => {
    const r = plotVs({ ...input, fundReturn: g }, rules);
    return r.fund.net - r.fd.net;
  };
  const fund = findFlip(fundGap, { lo: 0, hi: 0.4, steps: 80 });
  if (fund) flips.push({ variable: 'fundReturn', ...fund });
  return flips;
}
