/**
 * The same amount every month into an equity SIP, PPF or a recurring deposit, for the same years.
 * Deposits are made at the start of each month (for PPF, by the fifth, so they earn that month).
 *
 *   SIP:  each instalment grows at the fund's return. On selling at the end, gains on instalments
 *         held 12 months or less are short-term; the rest are long-term, taxed above the yearly
 *         exemption (assuming no other equity gains that year). Cess is added.
 *   PPF:  interest each month on the balance at the rate, credited once a year (so it compounds
 *         yearly). Tax-free. The rate is held constant, though the government resets it quarterly.
 *   RD:   grows at the rate after your tax on the interest each year.
 *
 * Years are PPF's term and its extensions: 15, 20, 25 and so on.
 */
import { findFlip, type Flip } from '@/engine/sensitivity';
import { effectiveToMonthly, toTodaysRupees } from '@/engine/timeValue';
import type { IncomeTaxData, SmallSavingsData } from '@/data/schema';

export type SavingOption = 'sip' | 'ppf' | 'rd';

export interface MonthlySavingInput {
  monthly: number;
  years: number;
  /** Expected fund return a year, before tax (effective). */
  sipReturn: number;
  /** PPF interest a year. */
  ppfRate: number;
  /** RD interest a year (effective). */
  rdRate: number;
  /** Your tax rate on RD interest, with cess, decimal. */
  taxRate: number;
  inflation: number;
}

export interface SavingEnd {
  /** What you keep at the end, after tax. */
  net: number;
  tax: number;
  /** Kept if withdrawn at the end of each year, index 0 = today (0). */
  byYear: number[];
}

export interface MonthlySavingResult {
  months: number;
  deposited: number;
  sip: SavingEnd & { value: number; shortTermGain: number; longTermGain: number; exempt: number };
  ppf: SavingEnd & { interest: number };
  rd: SavingEnd;
  best: SavingOption;
  lead: number;
  bestToday: number;
}

export function validateMonthlySaving(i: MonthlySavingInput, ppf: SmallSavingsData['ppf']): void {
  for (const [name, v] of Object.entries(i)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (i.monthly * 12 > ppf.maxYearly) throw new RangeError('monthly amount is above the PPF limit');
  if (i.monthly * 12 < ppf.minYearly)
    throw new RangeError('monthly amount is below the PPF minimum');
  const extra = i.years - ppf.termYears;
  if (!Number.isInteger(i.years) || extra < 0 || extra % ppf.extensionYears !== 0) {
    throw new RangeError('years must be the PPF term or a whole extension of it');
  }
  if (!(i.taxRate < 1)) throw new RangeError('taxRate must be below 100%');
}

/** SIP value and tax if everything is sold after `months` (months ≥ 1). */
function sipAt(input: MonthlySavingInput, months: number, rules: IncomeTaxData) {
  const g = effectiveToMonthly(input.sipReturn);
  const cg = rules.capitalGains;
  const cess = 1 + rules.cessRate;
  let value = 0;
  let shortTermGain = 0;
  let longTermGain = 0;
  for (let k = 1; k <= months; k++) {
    // Bought at the start of month k, so held months − k + 1 months by the end.
    const held = months - k + 1;
    const worth = input.monthly * Math.pow(1 + g, held);
    value += worth;
    const gain = worth - input.monthly;
    if (held <= cg.listedLongTermAfterMonths) shortTermGain += gain;
    else longTermGain += gain;
  }
  const exempt = Math.min(Math.max(0, longTermGain), cg.equityLongTermExemption);
  const tax =
    (Math.max(0, shortTermGain) * cg.equityShortTermRate +
      Math.max(0, longTermGain - cg.equityLongTermExemption) * cg.longTermRate) *
    cess;
  return { value, tax, kept: value - tax, shortTermGain, longTermGain, exempt };
}

/** PPF balance month by month: interest on the balance after that month's deposit, credited yearly. */
function ppfBalances(input: MonthlySavingInput, months: number): number[] {
  const out = [0];
  let balance = 0;
  let pending = 0;
  for (let m = 1; m <= months; m++) {
    balance += input.monthly;
    pending += (balance * input.ppfRate) / 12;
    if (m % 12 === 0) {
      balance += pending;
      pending = 0;
    }
    out.push(balance);
  }
  return out;
}

export function monthlySaving(
  input: MonthlySavingInput,
  rules: IncomeTaxData,
  ppfRules: SmallSavingsData['ppf'],
): MonthlySavingResult {
  validateMonthlySaving(input, ppfRules);
  const months = input.years * 12;
  const deposited = input.monthly * months;
  const years = Array.from({ length: input.years + 1 }, (_, y) => y);

  const sipEnd = sipAt(input, months, rules);
  const ppf = ppfBalances(input, months);

  // RD: grows at the rate after tax, deposits at the start of each month.
  const gNet = effectiveToMonthly(input.rdRate * (1 - input.taxRate));
  const gGross = effectiveToMonthly(input.rdRate);
  const annuity = (g: number, n: number) =>
    g === 0 ? input.monthly * n : (input.monthly * (Math.pow(1 + g, n) - 1) * (1 + g)) / g;
  const rdNet = annuity(gNet, months);

  const nets: Record<SavingOption, number> = {
    sip: sipEnd.kept,
    ppf: ppf[months]!,
    rd: rdNet,
  };
  const order = (Object.keys(nets) as SavingOption[]).sort((a, b) => nets[b] - nets[a]);
  const best = order[0]!;

  return {
    months,
    deposited,
    sip: {
      net: sipEnd.kept,
      tax: sipEnd.tax,
      value: sipEnd.value,
      shortTermGain: sipEnd.shortTermGain,
      longTermGain: sipEnd.longTermGain,
      exempt: sipEnd.exempt,
      byYear: years.map((y) => (y === 0 ? 0 : sipAt(input, y * 12, rules).kept)),
    },
    ppf: {
      net: ppf[months]!,
      tax: 0,
      interest: ppf[months]! - deposited,
      byYear: years.map((y) => ppf[y * 12]!),
    },
    rd: {
      net: rdNet,
      tax: annuity(gGross, months) - rdNet,
      byYear: years.map((y) => annuity(gNet, y * 12)),
    },
    best,
    lead: nets[best] - nets[order[1]!],
    bestToday: toTodaysRupees(nets[best], input.inflation, months),
  };
}

export interface SavingFlip extends Flip {
  variable: 'sipReturn';
}

/** The fund return at which the SIP matches the better of PPF and the RD. */
export function sipBreakEven(
  input: MonthlySavingInput,
  rules: IncomeTaxData,
  ppfRules: SmallSavingsData['ppf'],
): SavingFlip | null {
  const gap = (r: number) => {
    const res = monthlySaving({ ...input, sipReturn: r }, rules, ppfRules);
    return res.sip.net - Math.max(res.ppf.net, res.rd.net);
  };
  const flip = findFlip(gap, { lo: 0, hi: 0.3, steps: 60 });
  return flip ? { variable: 'sipReturn', ...flip } : null;
}
