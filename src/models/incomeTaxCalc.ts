/**
 * Income tax on a year's income under one regime, with the slab-by-slab working. The tax itself is
 * `regimeTax` from the regime comparison, so both tools always agree; this adds what a single
 * calculator shows: the tax in each slab, the monthly figure, and the average and marginal rates.
 *
 * Marginal rate: the tax on the next ₹100 of income, including cess. Just above the new regime's
 * rebate limit, marginal relief makes every extra rupee of income a rupee of tax, so the marginal
 * rate there is 100% plus cess.
 */
import type { IncomeTaxData } from '@/data/schema';
import { compareRegimes, type Regime, type RegimeTax, type TaxRegimeInput } from './taxRegime';

export interface IncomeTaxInput extends TaxRegimeInput {
  regime: Regime;
}

export interface SlabLine {
  from: number;
  /** null: no upper limit. */
  upTo: number | null;
  rate: number;
  /** Taxable income inside this slab, ₹. */
  income: number;
  tax: number;
}

export interface IncomeTaxResult extends RegimeTax {
  regime: Regime;
  slabs: SlabLine[];
  monthly: number;
  /** Total tax ÷ total income (salary plus other income). */
  averageRate: number;
  /** Tax on the next rupee, with cess. */
  marginalRate: number;
  /** Total tax under the other regime, for the same income and deductions. */
  otherTotal: number;
}

export function slabLines(taxable: number, slabs: IncomeTaxData['regimes']['new']['slabs']) {
  let from = 0;
  return slabs.map((s): SlabLine => {
    const top = s.upTo ?? Infinity;
    const income = Math.max(0, Math.min(taxable, top) - from);
    const line = { from, upTo: s.upTo, rate: s.rate, income, tax: income * s.rate };
    from = top;
    return line;
  });
}

export function incomeTaxCalc(input: IncomeTaxInput, rules: IncomeTaxData): IncomeTaxResult {
  const { regime, ...amounts } = input;
  const both = compareRegimes(amounts, rules);
  const r = both[regime];
  const other = both[regime === 'new' ? 'old' : 'new'];
  const income = input.salary + input.otherIncome;
  const step = 100;
  const next = compareRegimes({ ...amounts, otherIncome: amounts.otherIncome + step }, rules);
  return {
    ...r,
    regime,
    slabs: slabLines(r.taxable, rules.regimes[regime].slabs),
    monthly: r.total / 12,
    averageRate: income > 0 ? r.total / income : 0,
    marginalRate: (next[regime].total - r.total) / step,
    otherTotal: other.total,
  };
}
