/**
 * The tax regime form. Everything is the visitor's own: salary, other income and the deductions
 * they claim. The rules themselves come from the verified data file, not from the form.
 *
 * Deductions come in one of two ways: item by item (each claim held to its limit by
 * models/taxDeductions.ts), or as one old-regime total the visitor already knows.
 */
import { incomeTax } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import { itemisedDeductions, type DeductionInput, type DeductionResult } from './taxDeductions';
import type { TaxRegimeInput } from './taxRegime';

export type DeductionMode = 'items' | 'total';

/** The kinds of claim a visitor can switch on, each opening its own fields. */
export const DEDUCTION_GROUPS = [
  'rent',
  'invest',
  'health',
  'homeLoan',
  'nps',
  'education',
  'savings',
] as const;
export type DeductionGroup = (typeof DEDUCTION_GROUPS)[number];

export interface TaxRegimeForm {
  mode: DeductionMode;
  salary: number | null;
  otherIncome: number | null;
  /** "One total" mode only. */
  oldDeductions: number | null;
  newDeductions: number | null;
  // Which claims apply ("item by item" mode).
  rent: boolean;
  invest: boolean;
  health: boolean;
  homeLoan: boolean;
  nps: boolean;
  education: boolean;
  savings: boolean;
  // The claims themselves; empty means zero.
  basicPlusDa: number | null;
  hraReceived: number | null;
  rentPaid: number | null;
  largeCity: boolean;
  section80C: number | null;
  healthSelf: number | null;
  healthSelfSenior: boolean;
  healthParents: number | null;
  healthParentsSenior: boolean;
  homeLoanInterest: number | null;
  npsExtra: number | null;
  employerNps: number | null;
  governmentEmployer: boolean;
  educationLoanInterest: number | null;
  savingsInterest: number | null;
}

export type TaxRegimeNumberKey = {
  [K in keyof TaxRegimeForm]: TaxRegimeForm[K] extends number | null ? K : never;
}[keyof TaxRegimeForm];

const MAX = 10_00_00_000;
export const TAX_REGIME_LIMITS = {
  salary: { min: 0, max: MAX },
  otherIncome: { min: 0, max: MAX },
  oldDeductions: { min: 0, max: MAX },
  newDeductions: { min: 0, max: MAX },
  basicPlusDa: { min: 0, max: MAX },
  hraReceived: { min: 0, max: MAX },
  rentPaid: { min: 0, max: MAX },
  section80C: { min: 0, max: MAX },
  healthSelf: { min: 0, max: MAX },
  healthParents: { min: 0, max: MAX },
  homeLoanInterest: { min: 0, max: MAX },
  npsExtra: { min: 0, max: MAX },
  employerNps: { min: 0, max: MAX },
  educationLoanInterest: { min: 0, max: MAX },
  savingsInterest: { min: 0, max: MAX },
} as const satisfies Record<TaxRegimeNumberKey, { min: number; max: number }>;

/** The fields each claim opens. Basic pay is shared by rent (HRA) and NPS (employer's limit). */
export const GROUP_FIELDS: Record<DeductionGroup, TaxRegimeNumberKey[]> = {
  rent: ['basicPlusDa', 'hraReceived', 'rentPaid'],
  invest: ['section80C'],
  health: ['healthSelf', 'healthParents'],
  homeLoan: ['homeLoanInterest'],
  nps: ['npsExtra', 'employerNps'],
  education: ['educationLoanInterest'],
  savings: ['savingsInterest'],
};

export const TAX_REGIME_START_FORM: TaxRegimeForm = {
  mode: 'items',
  salary: null,
  otherIncome: null,
  oldDeductions: null,
  newDeductions: null,
  rent: false,
  invest: false,
  health: false,
  homeLoan: false,
  nps: false,
  education: false,
  savings: false,
  basicPlusDa: null,
  hraReceived: null,
  rentPaid: null,
  largeCity: true,
  section80C: null,
  healthSelf: null,
  healthSelfSenior: false,
  healthParents: null,
  healthParentsSenior: false,
  homeLoanInterest: null,
  npsExtra: null,
  employerNps: null,
  governmentEmployer: false,
  educationLoanInterest: null,
  savingsInterest: null,
};

const num = (param: string, key: TaxRegimeNumberKey) => ({
  param,
  type: 'number' as const,
  ...TAX_REGIME_LIMITS[key],
});
const bool = (param: string) => ({ param, type: 'boolean' as const });

export const taxRegimeShareSchema: ShareSchema<TaxRegimeForm> = {
  mode: { param: 'm', type: 'enum', values: ['items', 'total'] },
  salary: num('sal', 'salary'),
  otherIncome: num('oth', 'otherIncome'),
  oldDeductions: num('od', 'oldDeductions'),
  newDeductions: num('nd', 'newDeductions'),
  rent: bool('gr'),
  invest: bool('gi'),
  health: bool('gh'),
  homeLoan: bool('gl'),
  nps: bool('gn'),
  education: bool('ge'),
  savings: bool('gs'),
  basicPlusDa: num('bas', 'basicPlusDa'),
  hraReceived: num('hra', 'hraReceived'),
  rentPaid: num('rnt', 'rentPaid'),
  largeCity: bool('lc'),
  section80C: num('c80', 'section80C'),
  healthSelf: num('hs', 'healthSelf'),
  healthSelfSenior: bool('hss'),
  healthParents: num('hp', 'healthParents'),
  healthParentsSenior: bool('hps'),
  homeLoanInterest: num('hli', 'homeLoanInterest'),
  npsExtra: num('nx', 'npsExtra'),
  employerNps: num('en', 'employerNps'),
  governmentEmployer: bool('gov'),
  educationLoanInterest: num('eli', 'educationLoanInterest'),
  savingsInterest: num('si', 'savingsInterest'),
};

/** Basic pay is needed for HRA, and for the employer's NPS limit when there is one. */
export const needsBasicPay = (form: TaxRegimeForm) =>
  form.mode === 'items' && (form.rent || (form.nps && (form.employerNps ?? 0) > 0));

export function invalidTaxRegimeFields(form: TaxRegimeForm): TaxRegimeNumberKey[] {
  const required = new Set<TaxRegimeNumberKey>();
  if (form.mode === 'items' && form.rent) {
    required.add('hraReceived');
    required.add('rentPaid');
  }
  if (needsBasicPay(form)) required.add('basicPlusDa');

  const bad = (Object.keys(TAX_REGIME_LIMITS) as TaxRegimeNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return required.has(key);
    const { min, max } = TAX_REGIME_LIMITS[key];
    return !Number.isFinite(v) || v < min || v > max;
  });
  // Some income is needed to compare anything.
  if ((form.salary ?? 0) + (form.otherIncome ?? 0) <= 0 && !bad.includes('salary')) {
    bad.push('salary');
  }
  return bad;
}

/** The claims that count: a group that is switched off counts as zero. */
export function toDeductionInput(form: TaxRegimeForm): DeductionInput {
  const v = (group: DeductionGroup, key: TaxRegimeNumberKey) =>
    form[group] ? (form[key] ?? 0) : 0;
  return {
    salary: form.salary ?? 0,
    otherIncome: form.otherIncome ?? 0,
    basicPlusDa: form.basicPlusDa ?? 0,
    hraReceived: v('rent', 'hraReceived'),
    rentPaid: v('rent', 'rentPaid'),
    largeCity: form.largeCity,
    section80C: v('invest', 'section80C'),
    npsExtra: v('nps', 'npsExtra'),
    healthSelf: v('health', 'healthSelf'),
    healthSelfSenior: form.healthSelfSenior,
    healthParents: v('health', 'healthParents'),
    healthParentsSenior: form.healthParentsSenior,
    homeLoanInterest: v('homeLoan', 'homeLoanInterest'),
    educationLoanInterest: v('education', 'educationLoanInterest'),
    savingsInterest: v('savings', 'savingsInterest'),
    employerNps: v('nps', 'employerNps'),
    governmentEmployer: form.governmentEmployer,
  };
}

export interface TaxRegimeFormResult {
  input: TaxRegimeInput;
  /** Item by item only: each claim after its limit, and the room left. */
  items: DeductionResult | null;
}

export function toTaxRegimeInput(form: TaxRegimeForm): TaxRegimeFormResult | null {
  if (invalidTaxRegimeFields(form).length > 0) return null;
  if (form.mode === 'items') {
    const items = itemisedDeductions(toDeductionInput(form), incomeTax);
    return { input: items.regimeInput, items };
  }
  return {
    input: {
      salary: form.salary ?? 0,
      otherIncome: form.otherIncome ?? 0,
      oldDeductions: form.oldDeductions ?? 0,
      newDeductions: form.newDeductions ?? 0,
    },
    items: null,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not anyone's real figures: a ₹15 lakh salary with rent in a
 * large city, full 80C and a ₹25,000 health policy.
 */
export const TAX_REGIME_EXAMPLE_VALUES = {
  salary: 1_500_000,
  basicPlusDa: 600_000,
  hraReceived: 240_000,
  rentPaid: 300_000,
  section80C: 150_000,
  healthSelf: 25_000,
} as const satisfies Partial<Record<TaxRegimeNumberKey, number>>;

export const TAX_REGIME_EXAMPLE_FORM: TaxRegimeForm = {
  ...TAX_REGIME_START_FORM,
  ...TAX_REGIME_EXAMPLE_VALUES,
  rent: true,
  invest: true,
  health: true,
};

export const TAX_REGIME_EXAMPLE_KEYS = Object.keys(
  TAX_REGIME_EXAMPLE_VALUES,
) as TaxRegimeNumberKey[];
