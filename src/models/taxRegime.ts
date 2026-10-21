/**
 * Old or new income-tax regime: the tax on the same income under each, for one tax year.
 *
 * For each regime:
 *   taxable = salary + other income − standard deduction (up to the salary) − your deductions
 *   tax     = slab tax − rebate, where the rebate wipes out the tax up to its limit when taxable
 *             income is within the rebate's income limit
 *   new regime only: just above that limit, marginal relief caps the tax at the income above it
 *   total   = tax × (1 + cess)
 *
 * The rules (slabs, standard deduction, rebate, cess) come from src/data/incomeTax.json, verified
 * against the Income Tax Department. Not modelled: surcharge (so taxable income above the
 * surcharge threshold is out of scope), age-based slabs (under 60 only), special-rate income such
 * as capital gains, and rounding of income and tax to the nearest ten rupees.
 */
import { slabTax } from '@/engine/tax';
import { findFlip } from '@/engine/sensitivity';
import type { IncomeTaxData } from '@/data/schema';

export type Regime = 'old' | 'new';

export interface TaxRegimeInput {
  /** Taxable salary for the year (after exempt allowances), ₹. */
  salary: number;
  /** Other taxable income at slab rates (interest, rent after its deductions), ₹. */
  otherIncome: number;
  /** Deductions and exemptions you claim under the old regime (beyond the standard deduction), ₹. */
  oldDeductions: number;
  /** Deductions allowed under the new regime too (such as the employer's NPS contribution), ₹. */
  newDeductions: number;
}

export interface RegimeTax {
  standardDeduction: number;
  deductions: number;
  taxable: number;
  slabTax: number;
  /** Rebate plus marginal relief: what comes off the slab tax. */
  rebate: number;
  cess: number;
  total: number;
  /** Above the surcharge threshold: this answer leaves out surcharge. */
  beyondScope: boolean;
}

export interface TaxRegimeResult {
  old: RegimeTax;
  new: RegimeTax;
  /** The regime with less tax (new on a tie, as it is the default). */
  better: Regime;
  /** How much less tax the better regime charges, ₹ a year. */
  saving: number;
  beyondScope: boolean;
}

function validate(i: TaxRegimeInput): void {
  for (const [name, v] of Object.entries(i)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
}

export function regimeTax(regime: Regime, input: TaxRegimeInput, rules: IncomeTaxData): RegimeTax {
  const r = rules.regimes[regime];
  const standardDeduction = Math.min(r.standardDeduction, input.salary);
  const deductions = regime === 'old' ? input.oldDeductions : input.newDeductions;
  const taxable = Math.max(0, input.salary + input.otherIncome - standardDeduction - deductions);
  const gross = slabTax(taxable, r.slabs);
  let net = gross;
  if (taxable <= r.rebate.incomeLimit) {
    net = Math.max(0, gross - r.rebate.max);
  } else if (r.rebate.marginalRelief) {
    // Just over the limit, the tax may not exceed the income above it.
    net = Math.min(gross, taxable - r.rebate.incomeLimit);
  }
  const cess = net * rules.cessRate;
  return {
    standardDeduction,
    deductions,
    taxable,
    slabTax: gross,
    rebate: gross - net,
    cess,
    total: net + cess,
    beyondScope: taxable > rules.surchargeFrom,
  };
}

export function compareRegimes(input: TaxRegimeInput, rules: IncomeTaxData): TaxRegimeResult {
  validate(input);
  const oldTax = regimeTax('old', input, rules);
  const newTax = regimeTax('new', input, rules);
  const better: Regime = oldTax.total < newTax.total ? 'old' : 'new';
  return {
    old: oldTax,
    new: newTax,
    better,
    saving: Math.abs(oldTax.total - newTax.total),
    beyondScope: oldTax.beyondScope || newTax.beyondScope,
  };
}

/**
 * The old-regime deductions at which both regimes charge the same tax, or null if the old regime
 * cannot catch up (or is already ahead with no deductions). Above it, the old regime wins.
 */
export function breakEvenDeductions(input: TaxRegimeInput, rules: IncomeTaxData): number | null {
  const gap = (d: number) => {
    const r = compareRegimes({ ...input, oldDeductions: d }, rules);
    // The old regime has to be cheaper, not just level (both can be nil).
    return r.new.total - r.old.total - 0.01;
  };
  const most = input.salary + input.otherIncome;
  if (most <= 0) return null;
  const flip = findFlip(gap, { lo: 0, hi: most, steps: 400 });
  return flip ? flip.threshold : null;
}
