/**
 * The SIP vs PPF vs RD form. The monthly amount, RD rate and tax rate are the visitor's own. The
 * PPF rate starts at the verified current rate; the fund return at the base row of the scenario
 * table. Years follow PPF: its term, or a whole number of extensions on top.
 */
import { defaults, smallSavings } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { MonthlySavingInput } from './monthlySaving';

export interface MonthlySavingForm {
  monthly: number | null;
  years: number | null;
  sipReturn: number | null;
  ppfRate: number | null;
  rdRate: number | null;
  taxRate: number | null;
  inflation: number | null;
}

const ppf = smallSavings.ppf;

export const MONTHLY_SAVING_START_FORM: MonthlySavingForm = {
  monthly: null,
  years: ppf.termYears,
  sipReturn: defaults.scenarioVariables.equityReturnNominal.values.base,
  ppfRate: ppf.status === 'verified' ? ppf.rate : null,
  rdRate: defaults.globalAssumptions.fdRate.value,
  taxRate: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
};

export const MONTHLY_SAVING_LIMITS = {
  monthly: { min: Math.ceil(ppf.minYearly / 12), max: Math.floor(ppf.maxYearly / 12) },
  years: { min: ppf.termYears, max: 50 },
  sipReturn: { min: 0, max: 0.3 },
  ppfRate: { min: 0, max: 0.2 },
  rdRate: { min: 0, max: 0.2 },
  taxRate: { min: 0, max: 0.45 },
  inflation: { min: 0, max: 0.2 },
} as const satisfies Record<keyof MonthlySavingForm, { min: number; max: number }>;

const num = (param: string, key: keyof MonthlySavingForm, integer = false) => ({
  param,
  type: 'number' as const,
  ...MONTHLY_SAVING_LIMITS[key],
  integer,
});

export const monthlySavingShareSchema: ShareSchema<MonthlySavingForm> = {
  monthly: num('m', 'monthly'),
  years: num('y', 'years', true),
  sipReturn: num('sip', 'sipReturn'),
  ppfRate: num('ppf', 'ppfRate'),
  rdRate: num('rd', 'rdRate'),
  taxRate: num('tax', 'taxRate'),
  inflation: num('inf', 'inflation'),
};

export function invalidMonthlySavingFields(form: MonthlySavingForm): (keyof MonthlySavingForm)[] {
  return (Object.keys(MONTHLY_SAVING_LIMITS) as (keyof MonthlySavingForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return true;
    const { min, max } = MONTHLY_SAVING_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    // PPF runs its term and then whole extensions: 15, 20, 25 years and so on.
    if (key === 'years')
      return !Number.isInteger(v) || (v - ppf.termYears) % ppf.extensionYears !== 0;
    return false;
  });
}

export function toMonthlySavingInput(form: MonthlySavingForm): MonthlySavingInput | null {
  if (invalidMonthlySavingFields(form).length > 0) return null;
  return {
    monthly: form.monthly!,
    years: form.years!,
    sipReturn: form.sipReturn!,
    ppfRate: form.ppfRate!,
    rdRate: form.rdRate!,
    taxRate: form.taxRate!,
    inflation: form.inflation!,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data.
 */
export const MONTHLY_SAVING_EXAMPLE_VALUES = {
  monthly: 10_000,
  rdRate: 0.07,
  taxRate: 0.312,
} as const satisfies Partial<Record<keyof MonthlySavingForm, number>>;

export const MONTHLY_SAVING_EXAMPLE_FORM: MonthlySavingForm = {
  ...MONTHLY_SAVING_START_FORM,
  ...MONTHLY_SAVING_EXAMPLE_VALUES,
};

export const MONTHLY_SAVING_EXAMPLE_KEYS = Object.keys(
  MONTHLY_SAVING_EXAMPLE_VALUES,
) as (keyof MonthlySavingForm)[];
