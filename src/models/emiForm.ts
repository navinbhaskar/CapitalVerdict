/**
 * The EMI calculator's form. The loan amount, rate and tenure start as ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), the same loan as the "Where your EMI goes" guide: no verified
 * market rate is implied. The yearly prepayment is optional and starts empty.
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { EmiInput } from './emi';

export interface EmiForm {
  amount: number | null;
  annualRate: number | null;
  years: number | null;
  yearlyPrepayment: number | null;
  inflation: number | null;
}

export const EMI_LIMITS = {
  amount: { min: 10_000, max: 1e9 },
  annualRate: { min: 0, max: 0.36 },
  years: { min: 1, max: 40 },
  yearlyPrepayment: { min: 0, max: 1e9 },
  inflation: { min: 0, max: 0.2 },
} as const satisfies Record<keyof EmiForm, { min: number; max: number }>;

const OPTIONAL: (keyof EmiForm)[] = ['yearlyPrepayment'];

const num = (param: string, key: keyof EmiForm, integer = false) => ({
  param,
  type: 'number' as const,
  ...EMI_LIMITS[key],
  integer,
});

export const emiShareSchema: ShareSchema<EmiForm> = {
  amount: num('a', 'amount'),
  annualRate: num('r', 'annualRate'),
  years: num('y', 'years', true),
  yearlyPrepayment: num('p', 'yearlyPrepayment'),
  inflation: num('inf', 'inflation'),
};

export function invalidEmiFields(form: EmiForm): (keyof EmiForm)[] {
  return (Object.keys(EMI_LIMITS) as (keyof EmiForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = EMI_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return key === 'years' && !Number.isInteger(v);
  });
}

export function toEmiInput(form: EmiForm): EmiInput | null {
  if (invalidEmiFields(form).length > 0) return null;
  return {
    amount: form.amount!,
    annualRate: form.annualRate!,
    years: form.years!,
    yearlyPrepayment: form.yearlyPrepayment ?? 0,
    inflation: form.inflation!,
  };
}

/** Example values, not market data: the guide's ₹40 lakh at 9% for 20 years. */
export const EMI_EXAMPLE_VALUES = { amount: 4_000_000, annualRate: 0.09, years: 20 } as const;

export const emiExampleForm = (): EmiForm => ({
  ...EMI_EXAMPLE_VALUES,
  yearlyPrepayment: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
});

export const EMI_EXAMPLE_KEYS = Object.keys(EMI_EXAMPLE_VALUES) as (keyof EmiForm)[];
