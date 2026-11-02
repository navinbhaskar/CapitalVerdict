/**
 * The PPF calculator's form. The deposit starts as an ILLUSTRATIVE EXAMPLE (labelled "Example");
 * the rate starts at the verified current rate, and the limits and terms come from the PPF data.
 */
import { smallSavings } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { PpfFrequency, PpfInput } from './ppf';

const ppf = smallSavings.ppf;

/** The term, then up to three 5-year extensions. */
export const PPF_YEARS: readonly number[] = [0, 1, 2, 3].map(
  (n) => ppf.termYears + n * ppf.extensionYears,
);

export interface PpfForm {
  deposit: number | null;
  frequency: PpfFrequency;
  years: number;
  rate: number | null;
}

export type PpfNumberKey = 'deposit' | 'rate';

export const ppfLimits = (frequency: PpfFrequency) =>
  frequency === 'yearly'
    ? { min: ppf.minYearly, max: ppf.maxYearly }
    : { min: Math.ceil(ppf.minYearly / 12), max: Math.floor(ppf.maxYearly / 12) };

export const PPF_RATE_LIMITS = { min: 0, max: 0.2 };

export const ppfShareSchema: ShareSchema<PpfForm> = {
  deposit: { param: 'd', type: 'number', min: 0, max: ppf.maxYearly },
  frequency: { param: 'f', type: 'enum', values: ['yearly', 'monthly'] },
  years: { param: 'y', type: 'number', min: ppf.termYears, max: PPF_YEARS.at(-1)!, integer: true },
  rate: { param: 'i', type: 'number', ...PPF_RATE_LIMITS },
};

export function invalidPpfFields(form: PpfForm): PpfNumberKey[] {
  const bad: PpfNumberKey[] = [];
  const { min, max } = ppfLimits(form.frequency);
  const d = form.deposit;
  if (d === null || !Number.isFinite(d) || d < min || d > max) bad.push('deposit');
  const r = form.rate;
  if (r === null || !Number.isFinite(r) || r < PPF_RATE_LIMITS.min || r > PPF_RATE_LIMITS.max)
    bad.push('rate');
  return bad;
}

/** Switching how often you pay keeps the same total a year, within that frequency's limits. */
export function withFrequency(form: PpfForm, frequency: PpfFrequency): PpfForm {
  if (form.frequency === frequency || form.deposit === null) return { ...form, frequency };
  const yearly = form.frequency === 'yearly' ? form.deposit : form.deposit * 12;
  const deposit = frequency === 'yearly' ? yearly : Math.round(yearly / 12);
  const { min, max } = ppfLimits(frequency);
  return { ...form, frequency, deposit: Math.min(max, Math.max(min, deposit)) };
}

export function toPpfInput(form: PpfForm): PpfInput | null {
  if (invalidPpfFields(form).length > 0) return null;
  return {
    deposit: form.deposit!,
    frequency: form.frequency,
    // A shared link may carry any whole number of years; snap it down to a real term.
    years: PPF_YEARS.filter((y) => y <= form.years).at(-1) ?? ppf.termYears,
    rate: form.rate!,
  };
}

/** Example deposit, not anyone's: the yearly maximum, paid by 5 April. */
export const PPF_EXAMPLE_KEYS: PpfNumberKey[] = ['deposit'];

export const ppfExampleForm = (): PpfForm => ({
  deposit: ppf.maxYearly,
  frequency: 'yearly',
  years: ppf.termYears,
  rate: ppf.status === 'verified' ? ppf.rate : null,
});
