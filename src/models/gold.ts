/**
 * Four ways to put the same money into gold, followed month by month to the day you sell, and
 * what you keep after costs and tax.
 *
 *   Physical gold   you pay GST on the gold and its making charges; the jeweller or dealer
 *                   takes a cut when buying it back.
 *   Digital gold    you pay GST on the gold; the platform buys back below its selling price.
 *   Gold ETF        no GST; the fund charges a yearly expense ratio out of its value.
 *   SGB             bought on the stock exchange at today's price (plus any premium); pays
 *                   interest twice a year on the series' issue price, taxed as income and kept
 *                   as cash (not reinvested); sold at the gold price.
 *
 * Tax on the gain (what you get back − everything you paid): 12.5% once long-term, else your slab
 * rate, both plus cess. Gold ETFs and SGBs on the exchange are listed (long-term after 12
 * months); physical and digital gold after 24. A loss pays no tax (setting it off against other
 * gains is left out). The SGB maturity exemption is only for bonds held from original issue, so
 * it does not apply to a bond bought on the exchange.
 */
import type { GoldData, IncomeTaxData } from '@/data/schema';

export type GoldOption = 'physical' | 'digital' | 'etf' | 'sgb';
export const GOLD_OPTIONS: GoldOption[] = ['physical', 'digital', 'etf', 'sgb'];

export interface GoldInput {
  amount: number;
  years: number;
  /** Gold price rise a year (effective). */
  growth: number;
  /** Your income-tax slab rate, before cess, for short-term gains and SGB interest. */
  slabRate: number;
  /** Physical: making charges as a share of the gold's value. */
  making: number;
  /** Physical: share taken off the gold's value when sold back. */
  buybackCut: number;
  /** Digital: how far below the buying price the platform buys back. */
  spread: number;
  /** ETF: expense ratio a year. */
  expenseRatio: number;
  /** SGB: the series' issue price and today's gold price, ₹ a gram. */
  sgbIssuePrice: number;
  goldPriceToday: number;
  /** SGB: premium over the gold price paid on the exchange (negative for a discount). */
  sgbPremium: number;
}

export interface GoldSale {
  /** What the sale brings in, before tax, ₹. */
  proceeds: number;
  gain: number;
  longTerm: boolean;
  gainTax: number;
  /** SGB interest received after tax, ₹ (0 for the others). */
  interestKept: number;
  interestTax: number;
  /** What you keep: proceeds − gain tax + interest kept. */
  kept: number;
}

export interface GoldOptionResult extends GoldSale {
  /** Upfront costs inside the amount: GST and making charges, ₹. */
  gst: number;
  making: number;
  /** Gold (or fund value) you own on day one, ₹. */
  startValue: number;
  /** Index m = month m (1 … months): what you keep if you sold that month. */
  keptByMonth: number[];
}

export interface GoldResult {
  months: number;
  options: Record<GoldOption, GoldOptionResult>;
  best: GoldOption;
  /** Options ordered best first. */
  ranking: GoldOption[];
}

function validate(i: GoldInput): void {
  if (!(i.amount > 0)) throw new RangeError('amount must be positive');
  if (!Number.isInteger(i.years) || i.years < 1) throw new RangeError('years must be whole, ≥ 1');
  if (!(i.growth > -1)) throw new RangeError('growth must be above −100%');
  for (const k of ['slabRate', 'making', 'buybackCut', 'spread', 'expenseRatio'] as const) {
    if (!(i[k] >= 0 && i[k] < 1)) throw new RangeError(`${k} must be 0 to below 1`);
  }
  if (!(i.sgbIssuePrice > 0 && i.goldPriceToday > 0))
    throw new RangeError('prices must be positive');
  if (!(i.sgbPremium > -1)) throw new RangeError('premium must be above −100%');
}

export function goldCompare(input: GoldInput, gold: GoldData, tax: IncomeTaxData): GoldResult {
  validate(input);
  const months = input.years * 12;
  const cess = 1 + tax.cessRate;
  const index = (m: number) => Math.pow(1 + input.growth, m / 12);
  const gstRate = gold.gst.rate;

  const gainTax = (gain: number, m: number, listed: boolean) => {
    const after = listed
      ? gold.holding.listedLongTermAfterMonths
      : gold.holding.otherLongTermAfterMonths;
    const longTerm = m > after;
    const rate = longTerm ? tax.capitalGains.longTermRate : input.slabRate;
    return { longTerm, tax: Math.max(0, gain) * rate * cess };
  };

  const sale = (
    m: number,
    proceeds: number,
    listed: boolean,
    interestKept = 0,
    interestTax = 0,
  ): GoldSale => {
    const gain = proceeds - input.amount;
    const t = gainTax(gain, m, listed);
    return {
      proceeds,
      gain,
      longTerm: t.longTerm,
      gainTax: t.tax,
      interestKept,
      interestTax,
      kept: proceeds - t.tax + interestKept,
    };
  };

  // Physical: GST on the gold and the making charges together.
  const physStart = input.amount / ((1 + input.making) * (1 + gstRate));
  const physical = (m: number) => sale(m, physStart * index(m) * (1 - input.buybackCut), false);

  // Digital: GST on the gold; sold back below the buying price.
  const digiStart = input.amount / (1 + gstRate);
  const digital = (m: number) => sale(m, digiStart * index(m) * (1 - input.spread), false);

  // ETF: the expense ratio comes out of the value through the year.
  const etf = (m: number) =>
    sale(m, input.amount * index(m) * Math.pow(1 - input.expenseRatio, m / 12), true);

  // SGB: grams bought at today's price plus premium; interest on the issue price.
  const grams = input.amount / (input.goldPriceToday * (1 + input.sgbPremium));
  const coupon = (grams * input.sgbIssuePrice * gold.sgb.couponRate) / gold.sgb.couponsPerYear;
  const couponEvery = 12 / gold.sgb.couponsPerYear;
  const sgb = (m: number) => {
    const paid = Math.floor(m / couponEvery) * coupon;
    const interestTax = paid * input.slabRate * cess;
    return sale(m, grams * input.goldPriceToday * index(m), true, paid - interestTax, interestTax);
  };

  const run = { physical, digital, etf, sgb };
  const start: Record<GoldOption, { gst: number; making: number; startValue: number }> = {
    physical: {
      gst: physStart * (1 + input.making) * gstRate,
      making: physStart * input.making,
      startValue: physStart,
    },
    digital: { gst: digiStart * gstRate, making: 0, startValue: digiStart },
    etf: { gst: 0, making: 0, startValue: input.amount },
    sgb: { gst: 0, making: 0, startValue: grams * input.goldPriceToday },
  };

  const options = {} as Record<GoldOption, GoldOptionResult>;
  for (const o of GOLD_OPTIONS) {
    const keptByMonth = Array.from({ length: months }, (_, i) => run[o](i + 1).kept);
    options[o] = { ...run[o](months), ...start[o], keptByMonth };
  }
  const ranking = [...GOLD_OPTIONS].sort((a, b) => options[b].kept - options[a].kept);
  return { months, options, best: ranking[0]!, ranking };
}
