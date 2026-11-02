/**
 * The income tax calculator's form. The salary starts as an ILLUSTRATIVE EXAMPLE (labelled
 * "Example"); other income and deductions start empty, which counts as nil. The new regime is
 * selected first, as it applies unless you choose the old one.
 */
import type { ShareSchema } from '@/lib/shareLink';
import type { Regime } from './taxRegime';
import type { IncomeTaxInput } from './incomeTaxCalc';

export interface IncomeTaxForm {
  regime: Regime;
  salary: number | null;
  otherIncome: number | null;
  oldDeductions: number | null;
  newDeductions: number | null;
}

export type IncomeTaxNumberKey = Exclude<keyof IncomeTaxForm, 'regime'>;

const MAX = 10_00_00_000;
export const INCOME_TAX_LIMITS: Record<IncomeTaxNumberKey, { min: number; max: number }> = {
  salary: { min: 0, max: MAX },
  otherIncome: { min: 0, max: MAX },
  oldDeductions: { min: 0, max: MAX },
  newDeductions: { min: 0, max: MAX },
};
/** Only the salary must be filled in; the rest default to nil. */
const OPTIONAL: IncomeTaxNumberKey[] = ['otherIncome', 'oldDeductions', 'newDeductions'];

const num = (param: string, key: IncomeTaxNumberKey) => ({
  param,
  type: 'number' as const,
  ...INCOME_TAX_LIMITS[key],
});

export const incomeTaxShareSchema: ShareSchema<IncomeTaxForm> = {
  regime: { param: 'g', type: 'enum', values: ['new', 'old'] },
  salary: num('s', 'salary'),
  otherIncome: num('o', 'otherIncome'),
  oldDeductions: num('d', 'oldDeductions'),
  newDeductions: num('n', 'newDeductions'),
};

export function invalidIncomeTaxFields(form: IncomeTaxForm): IncomeTaxNumberKey[] {
  return (Object.keys(INCOME_TAX_LIMITS) as IncomeTaxNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = INCOME_TAX_LIMITS[key];
    return !Number.isFinite(v) || v < min || v > max;
  });
}

export function toIncomeTaxInput(form: IncomeTaxForm): IncomeTaxInput | null {
  if (invalidIncomeTaxFields(form).length > 0) return null;
  return {
    regime: form.regime,
    salary: form.salary!,
    otherIncome: form.otherIncome ?? 0,
    oldDeductions: form.oldDeductions ?? 0,
    newDeductions: form.newDeductions ?? 0,
  };
}

/** Example salary, not anyone's: ₹15 lakh a year. */
export const INCOME_TAX_EXAMPLE_KEYS: IncomeTaxNumberKey[] = ['salary'];

export const incomeTaxExampleForm = (): IncomeTaxForm => ({
  regime: 'new',
  salary: 1_500_000,
  otherIncome: null,
  oldDeductions: null,
  newDeductions: null,
});
