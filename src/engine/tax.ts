/**
 * Income tax, versioned by financial year and regime.
 *
 * This module is mechanics only. Actual slab tables, cess and capital-gains rates live in data files
 * and must be verified against official sources (TODO_VERIFY) before use.
 *
 * Deliberately not modelled in v1: rebates, surcharge and marginal relief, deductions, and
 * set-off of losses. The site states this wherever tax is used.
 */

import { progressiveSum, validateBands, type Band } from './bands';

/** Band of taxable income in ₹. */
export type Slab = Band;

export type VerificationStatus = 'TODO_VERIFY' | 'verified';

export interface TaxTable {
  /** For example "2025-26". */
  financialYear: string;
  regime: 'old' | 'new';
  slabs: Slab[];
  cessRate: number;
  source: string;
  status: VerificationStatus;
}

export const validateSlabs = validateBands;

/** Progressive tax: each band's rate applies only to income inside that band. */
export function slabTax(income: number, slabs: readonly Slab[]): number {
  return progressiveSum(income, slabs);
}

/** Rate on the next rupee of income (before cess). Income exactly on a bound stays in the lower band. */
export function marginalSlabRate(income: number, slabs: readonly Slab[]): number {
  validateSlabs(slabs);
  const slab = slabs.find((s) => s.upTo === null || income < s.upTo) ?? slabs.at(-1)!;
  return slab.rate;
}

export function incomeTax(income: number, table: TaxTable): number {
  return slabTax(income, table.slabs) * (1 + table.cessRate);
}

export function marginalRateWithCess(income: number, table: TaxTable): number {
  return marginalSlabRate(income, table.slabs) * (1 + table.cessRate);
}

/** Return left after tax when the return is taxed every year at the marginal rate (e.g. FD interest). */
export function postTaxRate(preTaxRate: number, marginalTaxRate: number): number {
  return preTaxRate * (1 - marginalTaxRate);
}

export interface CapitalGainsRule {
  rate: number;
  /** Gains up to this amount are not taxed. */
  exemption: number;
  cessRate: number;
}

export function capitalGainsTax(gain: number, rule: CapitalGainsRule): number {
  return Math.max(0, gain - rule.exemption) * rule.rate * (1 + rule.cessRate);
}

export function findTaxTable(
  tables: readonly TaxTable[],
  financialYear: string,
  regime: TaxTable['regime'],
): TaxTable {
  const table = tables.find((t) => t.financialYear === financialYear && t.regime === regime);
  if (!table) throw new Error(`no tax table for FY ${financialYear} (${regime} regime)`);
  return table;
}
