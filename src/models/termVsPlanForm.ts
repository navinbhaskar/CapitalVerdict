/**
 * The term-plus-investing form: the plan's steps from the plan return calculator, its life cover,
 * and the alternative (a term plan's cover years and premium, and a return on the rest).
 * The ready-made shapes and their covers are ILLUSTRATIVE EXAMPLES, not any real plan's figures.
 * The term premium is never filled in: it is a price, so it starts empty for the visitor's quote.
 */
import { smallSavings } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { PlanInput } from './planReturn';
import {
  INTEGER_KEYS as PLAN_INTEGER_KEYS,
  PLAN_LIMITS,
  applyShape,
  hasPayout,
  invalidPlanFields,
  planExampleForm,
  planShareSchema,
  shapeKeys,
  toPlanInput,
  type PlanForm,
  type PlanNumberKey,
  type PlanShape,
} from './planReturnForm';

export interface TermForm extends PlanForm {
  /** The plan's life cover, ₹: the cover the term plan is quoted for. */
  cover: number | null;
  coverYears: number | null;
  /** The visitor's term quote, ₹ a year; empty until they have one. */
  termPremium: number | null;
  /** Return a year on the rest, after tax. */
  investReturn: number | null;
}

/** The plan return calculator's comparison rates, which this tool does not use. */
const UNUSED: PlanNumberKey[] = ['fundReturn', 'fdRate', 'fdTaxRate'];
export type TermNumberKey =
  | Exclude<PlanNumberKey, 'fundReturn' | 'fdRate' | 'fdTaxRate'>
  | 'cover'
  | 'coverYears'
  | 'termPremium'
  | 'investReturn';

/** A copy of `record` without the comparison rates. */
function withoutUnused<T extends object>(
  record: T,
): Omit<T, 'fundReturn' | 'fdRate' | 'fdTaxRate'> {
  return Object.fromEntries(
    Object.entries(record).filter(([k]) => !(UNUSED as string[]).includes(k)),
  ) as Omit<T, 'fundReturn' | 'fdRate' | 'fdTaxRate'>;
}

export const TERM_LIMITS = {
  ...withoutUnused(PLAN_LIMITS),
  cover: { min: 1_000, max: 1e10 },
  coverYears: { min: 1, max: 80 },
  termPremium: { min: 1, max: 1e8 },
  investReturn: { min: 0, max: 0.3 },
} as const satisfies Record<TermNumberKey, { min: number; max: number }>;

export const TERM_INTEGER_KEYS = new Set<TermNumberKey>([
  ...([...PLAN_INTEGER_KEYS] as TermNumberKey[]),
  'coverYears',
]);

const num = (param: string, key: TermNumberKey) => ({
  param,
  type: 'number' as const,
  ...TERM_LIMITS[key],
  integer: TERM_INTEGER_KEYS.has(key),
});

export const termShareSchema: ShareSchema<TermForm> = {
  ...withoutUnused(planShareSchema),
  cover: num('c', 'cover'),
  coverYears: num('cy', 'coverYears'),
  termPremium: num('tp', 'termPremium'),
  investReturn: num('ir', 'investReturn'),
};

/** Fields that are missing or out of range. The term premium may be empty. */
export function invalidTermFields(form: TermForm): TermNumberKey[] {
  const plan = invalidPlanFields({ ...form, fundReturn: 0, fdRate: null, fdTaxRate: null }).filter(
    (k) => !UNUSED.includes(k),
  ) as TermNumberKey[];
  const own = (['cover', 'coverYears', 'termPremium', 'investReturn'] as const).filter((key) => {
    const v = form[key];
    if (v === null) return key !== 'termPremium';
    const { min, max } = TERM_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return TERM_INTEGER_KEYS.has(key) && !Number.isInteger(v);
  });
  return [...plan, ...own];
}

export interface TermFormInput {
  plan: PlanInput;
  cover: number;
  coverYears: number;
  termPremium: number | null;
  investReturn: number;
}

export function toTermInput(form: TermForm): TermFormInput | null {
  if (invalidTermFields(form).length > 0 || !hasPayout(form)) return null;
  const plan = toPlanInput({ ...form, fundReturn: 0, fdRate: null, fdTaxRate: null });
  if (!plan) return null;
  return {
    plan,
    cover: form.cover!,
    coverYears: form.coverYears!,
    termPremium: form.termPremium,
    investReturn: form.investReturn!,
  };
}

/** Example cover and cover years for each shape: the plan's whole length. Illustrative only. */
export const SHAPE_COVER: Record<PlanShape, Pick<TermForm, 'cover' | 'coverYears'>> = {
  income: { cover: 500_000, coverYears: 35 },
  endowment: { cover: 1_000_000, coverYears: 20 },
  single: { cover: 1_250_000, coverYears: 25 },
  moneyBack: { cover: 400_000, coverYears: 20 },
};

/** The form with a shape's example steps and cover, keeping the visitor's other values. */
export function applyTermShape(form: TermForm, shape: PlanShape): TermForm {
  return { ...form, ...applyShape(form, shape), ...SHAPE_COVER[shape] };
}

/** PPF's rate as the example return: it is verified, and PPF interest is tax-free. */
export const TERM_EXAMPLE_RETURN = smallSavings.ppf.rate;

export const termExampleForm = (shape: PlanShape = 'endowment'): TermForm => ({
  ...planExampleForm(shape),
  ...SHAPE_COVER[shape],
  termPremium: null,
  investReturn: TERM_EXAMPLE_RETURN,
});

/** The fields shown as "Example" until the visitor changes them. */
export const termShapeKeys = (shape: PlanShape): TermNumberKey[] => [
  ...(shapeKeys(shape) as TermNumberKey[]),
  'cover',
  'coverYears',
  'investReturn',
];
