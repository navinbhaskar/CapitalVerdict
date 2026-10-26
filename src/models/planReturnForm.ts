/**
 * The plan return calculator's form: three steps (what you pay, a regular income, lump sums) and
 * a few rates to compare with. Four ready-made shapes fill the steps in one go; they are
 * ILLUSTRATIVE EXAMPLES (labelled "Example" on the page), not any real plan's figures.
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { IncomeFrequency, LumpSum, PayFrequency, PlanInput } from './planReturn';

export type PlanShape = 'income' | 'endowment' | 'single' | 'moneyBack';
export const PLAN_SHAPES: readonly PlanShape[] = ['income', 'endowment', 'single', 'moneyBack'];
export const PAY_FREQUENCIES: readonly PayFrequency[] = ['monthly', 'yearly', 'once'];
export const INCOME_FREQUENCIES: readonly IncomeFrequency[] = ['monthly', 'yearly'];
/** Lump sum slots on the form. */
export const LUMP_SLOTS = 4;

export interface PlanForm {
  shape: PlanShape;
  premium: number | null;
  payFrequency: PayFrequency;
  payYears: number | null;
  /** Empty for a plan without a regular income. */
  income: number | null;
  incomeFrequency: IncomeFrequency;
  incomeStartYear: number | null;
  incomeYears: number | null;
  lump1: number | null;
  lump1Year: number | null;
  lump2: number | null;
  lump2Year: number | null;
  lump3: number | null;
  lump3Year: number | null;
  lump4: number | null;
  lump4Year: number | null;
  /** Tax on what the plan pays you; 0 when it is tax-free. */
  taxRate: number | null;
  inflation: number | null;
  /** An equity fund to compare with, before tax. */
  fundReturn: number | null;
  /** Optional: an FD to compare with, and the tax on its interest. */
  fdRate: number | null;
  fdTaxRate: number | null;
}

export type PlanNumberKey = {
  [K in keyof PlanForm]: PlanForm[K] extends number | null ? K : never;
}[keyof PlanForm];

export const PLAN_LIMITS = {
  premium: { min: 100, max: 1e9 },
  payYears: { min: 1, max: 50 },
  income: { min: 1, max: 1e8 },
  incomeStartYear: { min: 1, max: 80 },
  incomeYears: { min: 1, max: 80 },
  lump1: { min: 1, max: 1e10 },
  lump1Year: { min: 1, max: 100 },
  lump2: { min: 1, max: 1e10 },
  lump2Year: { min: 1, max: 100 },
  lump3: { min: 1, max: 1e10 },
  lump3Year: { min: 1, max: 100 },
  lump4: { min: 1, max: 1e10 },
  lump4Year: { min: 1, max: 100 },
  taxRate: { min: 0, max: 0.45 },
  inflation: { min: 0, max: 0.2 },
  fundReturn: { min: 0, max: 0.3 },
  fdRate: { min: 0, max: 0.2 },
  fdTaxRate: { min: 0, max: 0.45 },
} as const satisfies Record<PlanNumberKey, { min: number; max: number }>;

export const INTEGER_KEYS = new Set<PlanNumberKey>([
  'payYears',
  'incomeStartYear',
  'incomeYears',
  'lump1Year',
  'lump2Year',
  'lump3Year',
  'lump4Year',
]);

export const lumpKeys = (slot: number) =>
  [`lump${slot}`, `lump${slot}Year`] as [PlanNumberKey, PlanNumberKey];

const num = (param: string, key: PlanNumberKey) => ({
  param,
  type: 'number' as const,
  ...PLAN_LIMITS[key],
  integer: INTEGER_KEYS.has(key),
});

export const planShareSchema: ShareSchema<PlanForm> = {
  shape: { param: 's', type: 'enum', values: PLAN_SHAPES },
  premium: num('p', 'premium'),
  payFrequency: { param: 'pf', type: 'enum', values: PAY_FREQUENCIES },
  payYears: num('py', 'payYears'),
  income: num('i', 'income'),
  incomeFrequency: { param: 'if', type: 'enum', values: INCOME_FREQUENCIES },
  incomeStartYear: num('is', 'incomeStartYear'),
  incomeYears: num('iy', 'incomeYears'),
  lump1: num('l1', 'lump1'),
  lump1Year: num('l1y', 'lump1Year'),
  lump2: num('l2', 'lump2'),
  lump2Year: num('l2y', 'lump2Year'),
  lump3: num('l3', 'lump3'),
  lump3Year: num('l3y', 'lump3Year'),
  lump4: num('l4', 'lump4'),
  lump4Year: num('l4y', 'lump4Year'),
  taxRate: num('tax', 'taxRate'),
  inflation: num('inf', 'inflation'),
  fundReturn: num('r', 'fundReturn'),
  fdRate: num('fd', 'fdRate'),
  fdTaxRate: num('fdt', 'fdTaxRate'),
};

/** The fields the form needs as it stands: income fields only with an income, a year with each lump sum. */
export function requiredFields(form: PlanForm): PlanNumberKey[] {
  const keys: PlanNumberKey[] = ['premium', 'taxRate', 'inflation', 'fundReturn'];
  if (form.payFrequency !== 'once') keys.push('payYears');
  if (form.income !== null) keys.push('incomeStartYear', 'incomeYears');
  for (let s = 1; s <= LUMP_SLOTS; s++) {
    const [amount, year] = lumpKeys(s);
    if (form[amount] !== null || form[year] !== null) keys.push(amount, year);
  }
  if (form.fdRate !== null || form.fdTaxRate !== null) keys.push('fdRate', 'fdTaxRate');
  return keys;
}

/** Fields that are missing or out of range. Optional fields left empty are fine. */
export function invalidPlanFields(form: PlanForm): PlanNumberKey[] {
  const required = new Set(requiredFields(form));
  return (Object.keys(PLAN_LIMITS) as PlanNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return required.has(key);
    const { min, max } = PLAN_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER_KEYS.has(key) && !Number.isInteger(v);
  });
}

/** True when the plan pays something back: an income or at least one lump sum. */
export function hasPayout(form: PlanForm): boolean {
  if (form.income !== null) return true;
  return Array.from({ length: LUMP_SLOTS }, (_, i) => form[lumpKeys(i + 1)[0]]).some(
    (v) => v !== null,
  );
}

export function toPlanInput(form: PlanForm): PlanInput | null {
  if (invalidPlanFields(form).length > 0 || !hasPayout(form)) return null;
  const lumpSums: LumpSum[] = [];
  for (let s = 1; s <= LUMP_SLOTS; s++) {
    const [amount, year] = lumpKeys(s);
    if (form[amount] !== null) lumpSums.push({ amount: form[amount]!, year: form[year]! });
  }
  return {
    premium: form.premium!,
    payFrequency: form.payFrequency,
    payYears: form.payFrequency === 'once' ? 0 : form.payYears!,
    income: form.income ?? 0,
    incomeFrequency: form.incomeFrequency,
    incomeStartYear: form.incomeStartYear ?? 1,
    incomeYears: form.income === null ? 0 : form.incomeYears!,
    lumpSums,
    taxRate: form.taxRate!,
    inflation: form.inflation!,
  };
}

const EMPTY_STEPS: Omit<
  PlanForm,
  'shape' | 'taxRate' | 'inflation' | 'fundReturn' | 'fdRate' | 'fdTaxRate'
> = {
  premium: null,
  payFrequency: 'yearly',
  payYears: null,
  income: null,
  incomeFrequency: 'monthly',
  incomeStartYear: null,
  incomeYears: null,
  lump1: null,
  lump1Year: null,
  lump2: null,
  lump2Year: null,
  lump3: null,
  lump3Year: null,
  lump4: null,
  lump4Year: null,
};

/** What each ready-made shape fills in. Example figures, not any real plan's. */
export const SHAPE_VALUES: Record<PlanShape, Partial<PlanForm>> = {
  // Pay ₹50,000 a year for 15 years; ₹8,000 a month for 20 years after that; ₹5 lakh at the end.
  income: {
    premium: 50_000,
    payYears: 15,
    income: 8_000,
    incomeStartYear: 16,
    incomeYears: 20,
    lump1: 500_000,
    lump1Year: 35,
  },
  // Pay ₹1 lakh a year for 12 years; ₹20 lakh at the end of year 20.
  endowment: { premium: 100_000, payYears: 12, lump1: 2_000_000, lump1Year: 20 },
  // Pay ₹10 lakh once; ₹5,000 a month for 25 years; the ₹10 lakh back at the end.
  single: {
    premium: 1_000_000,
    payFrequency: 'once',
    income: 5_000,
    incomeStartYear: 1,
    incomeYears: 25,
    lump1: 1_000_000,
    lump1Year: 25,
  },
  // Pay ₹40,000 a year for 15 years; ₹1 lakh back in years 5, 10 and 15; ₹6 lakh in year 20.
  moneyBack: {
    premium: 40_000,
    payYears: 15,
    lump1: 100_000,
    lump1Year: 5,
    lump2: 100_000,
    lump2Year: 10,
    lump3: 100_000,
    lump3Year: 15,
    lump4: 600_000,
    lump4Year: 20,
  },
};

/** The form with a shape's example steps, keeping the visitor's rates. */
export function applyShape(form: PlanForm, shape: PlanShape): PlanForm {
  return { ...form, ...EMPTY_STEPS, ...SHAPE_VALUES[shape], shape };
}

export const planExampleForm = (shape: PlanShape = 'income'): PlanForm =>
  applyShape(
    {
      ...EMPTY_STEPS,
      shape,
      taxRate: 0,
      inflation: defaults.scenarioVariables.inflation.values.base,
      fundReturn: defaults.scenarioVariables.equityReturnNominal.values.base,
      // The FD rate is not verified data, so the comparison starts empty.
      fdRate: defaults.globalAssumptions.fdRate.value,
      fdTaxRate: null,
    },
    shape,
  );

/** The fields a shape fills in: shown as "Example" until the visitor changes them. */
export const shapeKeys = (shape: PlanShape) =>
  [
    ...Object.keys(SHAPE_VALUES[shape]).filter(
      (k) => k !== 'payFrequency' && k !== 'incomeFrequency',
    ),
  ] as PlanNumberKey[];
