/**
 * The prepay or invest form. The visitor's own figures (loan, rate, amount, return) start empty;
 * inflation starts at the base row of the default scenario table. Prepayment charges and the tax
 * deduction depend on the visitor's loan and regime, so they start empty (counted as none).
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { PrepayInput, PrepayMode } from './prepay';

export interface PrepayForm {
  outstanding: number | null;
  loanRate: number | null;
  yearsLeft: number | null;
  lumpSum: number | null;
  yearlyAmount: number | null;
  mode: PrepayMode;
  investmentReturn: number | null;
  prepaymentCharge: number | null;
  interestTaxRate: number | null;
  interestDeductionCap: number | null;
  inflation: number | null;
}

export type PrepayNumberField = Exclude<keyof PrepayForm, 'mode'>;

export const PREPAY_START_FORM: PrepayForm = {
  outstanding: null,
  loanRate: null,
  yearsLeft: null,
  lumpSum: null,
  yearlyAmount: null,
  mode: 'reduceTenure',
  investmentReturn: null,
  prepaymentCharge: null,
  interestTaxRate: null,
  interestDeductionCap: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
};

export const PREPAY_LIMITS = {
  outstanding: { min: 1, max: 50_00_00_000 },
  loanRate: { min: 0, max: 0.25 },
  yearsLeft: { min: 1, max: 30 },
  lumpSum: { min: 0, max: 50_00_00_000 },
  yearlyAmount: { min: 0, max: 10_00_00_000 },
  investmentReturn: { min: 0, max: 0.3 },
  prepaymentCharge: { min: 0, max: 0.1 },
  interestTaxRate: { min: 0, max: 0.45 },
  interestDeductionCap: { min: 0, max: 1_00_00_000 },
  inflation: { min: 0, max: 0.2 },
} as const satisfies Record<PrepayNumberField, { min: number; max: number }>;

/** May be left empty; empty means zero. */
const OPTIONAL: PrepayNumberField[] = [
  'lumpSum',
  'yearlyAmount',
  'prepaymentCharge',
  'interestTaxRate',
  'interestDeductionCap',
];
const INTEGER: PrepayNumberField[] = ['yearsLeft'];

const num = (param: string, key: PrepayNumberField) => ({
  param,
  type: 'number' as const,
  ...PREPAY_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const prepayShareSchema: ShareSchema<PrepayForm> = {
  outstanding: num('owed', 'outstanding'),
  loanRate: num('lr', 'loanRate'),
  yearsLeft: num('yl', 'yearsLeft'),
  lumpSum: num('lump', 'lumpSum'),
  yearlyAmount: num('yr', 'yearlyAmount'),
  mode: { param: 'mode', type: 'enum', values: ['reduceTenure', 'reduceEmi'] },
  investmentReturn: num('ret', 'investmentReturn'),
  prepaymentCharge: num('chg', 'prepaymentCharge'),
  interestTaxRate: num('tax', 'interestTaxRate'),
  interestDeductionCap: num('cap', 'interestDeductionCap'),
  inflation: num('inf', 'inflation'),
};

export function invalidPrepayFields(form: PrepayForm): PrepayNumberField[] {
  const bad = (Object.keys(PREPAY_LIMITS) as PrepayNumberField[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = PREPAY_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
  // Something has to go somewhere: a lump sum, a yearly amount, or both.
  if (!((form.lumpSum ?? 0) > 0 || (form.yearlyAmount ?? 0) > 0) && !bad.includes('lumpSum')) {
    bad.push('lumpSum');
  }
  // A tax rate needs the yearly limit it applies up to.
  if ((form.interestTaxRate ?? 0) > 0 && form.interestDeductionCap === null) {
    bad.push('interestDeductionCap');
  }
  return bad;
}

export function toPrepayInput(form: PrepayForm): PrepayInput | null {
  if (invalidPrepayFields(form).length > 0) return null;
  return {
    outstanding: form.outstanding!,
    loanRate: form.loanRate!,
    yearsLeft: form.yearsLeft!,
    lumpSum: form.lumpSum ?? 0,
    yearlyAmount: form.yearlyAmount ?? 0,
    mode: form.mode,
    investmentReturn: form.investmentReturn!,
    prepaymentCharge: form.prepaymentCharge ?? 0,
    interestTaxRate: form.interestTaxRate ?? 0,
    interestDeductionCap: form.interestDeductionCap ?? 0,
    inflation: form.inflation!,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data: the loan from the "Where your EMI goes" guide.
 */
export const PREPAY_EXAMPLE_VALUES = {
  outstanding: 4_000_000,
  loanRate: 0.09,
  yearsLeft: 20,
  lumpSum: 500_000,
  investmentReturn: 0.08,
} as const satisfies Partial<Record<PrepayNumberField, number>>;

export const PREPAY_EXAMPLE_FORM: PrepayForm = { ...PREPAY_START_FORM, ...PREPAY_EXAMPLE_VALUES };

export const PREPAY_EXAMPLE_KEYS = Object.keys(PREPAY_EXAMPLE_VALUES) as PrepayNumberField[];
