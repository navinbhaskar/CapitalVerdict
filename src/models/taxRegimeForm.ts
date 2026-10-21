/**
 * The tax regime form. Everything is the visitor's own: salary, other income and the deductions
 * they claim. The rules themselves come from the verified data file, not from the form.
 */
import type { ShareSchema } from '@/lib/shareLink';
import type { TaxRegimeInput } from './taxRegime';

export interface TaxRegimeForm {
  salary: number | null;
  otherIncome: number | null;
  oldDeductions: number | null;
  newDeductions: number | null;
}

export const TAX_REGIME_START_FORM: TaxRegimeForm = {
  salary: null,
  otherIncome: null,
  oldDeductions: null,
  newDeductions: null,
};

export const TAX_REGIME_LIMITS = {
  salary: { min: 0, max: 10_00_00_000 },
  otherIncome: { min: 0, max: 10_00_00_000 },
  oldDeductions: { min: 0, max: 10_00_00_000 },
  newDeductions: { min: 0, max: 10_00_00_000 },
} as const satisfies Record<keyof TaxRegimeForm, { min: number; max: number }>;

/** May be left empty; empty means zero (but salary and other income cannot both be zero). */
const OPTIONAL: (keyof TaxRegimeForm)[] = [
  'salary',
  'otherIncome',
  'oldDeductions',
  'newDeductions',
];

const num = (param: string, key: keyof TaxRegimeForm) => ({
  param,
  type: 'number' as const,
  ...TAX_REGIME_LIMITS[key],
});

export const taxRegimeShareSchema: ShareSchema<TaxRegimeForm> = {
  salary: num('sal', 'salary'),
  otherIncome: num('oth', 'otherIncome'),
  oldDeductions: num('od', 'oldDeductions'),
  newDeductions: num('nd', 'newDeductions'),
};

export function invalidTaxRegimeFields(form: TaxRegimeForm): (keyof TaxRegimeForm)[] {
  const bad = (Object.keys(TAX_REGIME_LIMITS) as (keyof TaxRegimeForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = TAX_REGIME_LIMITS[key];
    return !Number.isFinite(v) || v < min || v > max;
  });
  // Some income is needed to compare anything.
  if ((form.salary ?? 0) + (form.otherIncome ?? 0) <= 0 && !bad.includes('salary')) {
    bad.push('salary');
  }
  return bad;
}

export function toTaxRegimeInput(form: TaxRegimeForm): TaxRegimeInput | null {
  if (invalidTaxRegimeFields(form).length > 0) return null;
  return {
    salary: form.salary ?? 0,
    otherIncome: form.otherIncome ?? 0,
    oldDeductions: form.oldDeductions ?? 0,
    newDeductions: form.newDeductions ?? 0,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page): a salary and a deductions total, not anyone's real figures.
 */
export const TAX_REGIME_EXAMPLE_VALUES = {
  salary: 1_500_000,
  oldDeductions: 250_000,
} as const satisfies Partial<Record<keyof TaxRegimeForm, number>>;

export const TAX_REGIME_EXAMPLE_FORM: TaxRegimeForm = {
  ...TAX_REGIME_START_FORM,
  ...TAX_REGIME_EXAMPLE_VALUES,
};

export const TAX_REGIME_EXAMPLE_KEYS = Object.keys(
  TAX_REGIME_EXAMPLE_VALUES,
) as (keyof TaxRegimeForm)[];
