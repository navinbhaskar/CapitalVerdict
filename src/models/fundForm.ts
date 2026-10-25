/**
 * Forms for the SIP, lumpsum and SWP calculators, all feeding the one fund model. The amounts and
 * years are the visitor's own; the fund return starts at the base row of the scenario table and
 * inflation at the global assumption. The lumpsum tool's FD comparison is optional and starts
 * empty: the FD rate is not verified data.
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { FundInput } from './fund';

export type FundMode = 'sip' | 'lumpsum' | 'swp';

export interface FundForm {
  lumpSum: number | null;
  monthly: number | null;
  stepUp: number | null;
  withdrawal: number | null;
  withdrawalRise: number | null;
  years: number | null;
  annualReturn: number | null;
  inflation: number | null;
  /** Lumpsum only, optional: an FD to compare with. */
  fdRate: number | null;
  taxRate: number | null;
}

export const FUND_LIMITS = {
  lumpSum: { min: 1_000, max: 1e9 },
  monthly: { min: 100, max: 1e7 },
  stepUp: { min: 0, max: 0.5 },
  withdrawal: { min: 100, max: 1e8 },
  withdrawalRise: { min: 0, max: 0.2 },
  years: { min: 1, max: 50 },
  annualReturn: { min: 0, max: 0.3 },
  inflation: { min: 0, max: 0.2 },
  fdRate: { min: 0, max: 0.2 },
  taxRate: { min: 0, max: 0.45 },
} as const satisfies Record<keyof FundForm, { min: number; max: number }>;

/** The fields each calculator uses, and which of those may be left empty. */
export const FUND_FIELDS: Record<
  FundMode,
  { used: (keyof FundForm)[]; optional: (keyof FundForm)[] }
> = {
  sip: { used: ['monthly', 'years', 'annualReturn', 'stepUp', 'inflation'], optional: [] },
  lumpsum: {
    used: ['lumpSum', 'years', 'annualReturn', 'inflation', 'fdRate', 'taxRate'],
    optional: ['fdRate', 'taxRate'],
  },
  swp: {
    used: ['lumpSum', 'withdrawal', 'years', 'annualReturn', 'withdrawalRise', 'inflation'],
    optional: [],
  },
};

const num = (param: string, key: keyof FundForm, integer = false) => ({
  param,
  type: 'number' as const,
  ...FUND_LIMITS[key],
  integer,
});

export const fundShareSchema: ShareSchema<FundForm> = {
  lumpSum: num('l', 'lumpSum'),
  monthly: num('m', 'monthly'),
  stepUp: num('su', 'stepUp'),
  withdrawal: num('w', 'withdrawal'),
  withdrawalRise: num('wr', 'withdrawalRise'),
  years: num('y', 'years', true),
  annualReturn: num('r', 'annualReturn'),
  inflation: num('inf', 'inflation'),
  fdRate: num('fd', 'fdRate'),
  taxRate: num('tax', 'taxRate'),
};

export function invalidFundFields(mode: FundMode, form: FundForm): (keyof FundForm)[] {
  const { used, optional } = FUND_FIELDS[mode];
  return used.filter((key) => {
    const v = form[key];
    if (v === null) return !optional.includes(key);
    const { min, max } = FUND_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return key === 'years' && !Number.isInteger(v);
  });
}

export function toFundInput(mode: FundMode, form: FundForm): FundInput | null {
  if (invalidFundFields(mode, form).length > 0) return null;
  const v = (key: keyof FundForm) => (FUND_FIELDS[mode].used.includes(key) ? (form[key] ?? 0) : 0);
  return {
    lumpSum: v('lumpSum'),
    monthly: v('monthly'),
    stepUp: v('stepUp'),
    withdrawal: v('withdrawal'),
    withdrawalRise: v('withdrawalRise'),
    years: form.years!,
    annualReturn: form.annualReturn!,
    inflation: form.inflation!,
  };
}

const START: FundForm = {
  lumpSum: null,
  monthly: null,
  stepUp: 0,
  withdrawal: null,
  withdrawalRise: 0,
  years: null,
  annualReturn: defaults.scenarioVariables.equityReturnNominal.values.base,
  inflation: defaults.scenarioVariables.inflation.values.base,
  fdRate: defaults.globalAssumptions.fdRate.value,
  taxRate: null,
};

/**
 * What each calculator opens with, so a first visit gets an answer straight away. ILLUSTRATIVE
 * EXAMPLES (labelled "Example" on the page), not market data.
 */
export const FUND_EXAMPLE_VALUES: Record<FundMode, Partial<FundForm>> = {
  sip: { monthly: 10_000, years: 15 },
  lumpsum: { lumpSum: 500_000, years: 10 },
  swp: {
    lumpSum: 5_000_000,
    withdrawal: 30_000,
    years: 25,
    // Living costs rise: withdrawals keep pace with the base inflation assumption by default.
    withdrawalRise: defaults.scenarioVariables.inflation.values.base,
  },
};

export const fundExampleForm = (mode: FundMode): FundForm => ({
  ...START,
  ...FUND_EXAMPLE_VALUES[mode],
});

export const fundExampleKeys = (mode: FundMode) =>
  Object.keys(FUND_EXAMPLE_VALUES[mode]) as (keyof FundForm)[];
