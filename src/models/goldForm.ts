/**
 * The gold calculator's form. The rules (GST, holding periods, SGB interest) come from the
 * verified data. Every figure here is the visitor's own: prices, costs and the gold price rise
 * vary by seller and by year, so each starts as an ILLUSTRATIVE EXAMPLE, labelled "Example".
 */
import type { ShareSchema } from '@/lib/shareLink';
import type { GoldInput } from './gold';

export type GoldForm = { [K in keyof GoldInput]: number | null };
export type GoldKey = keyof GoldInput;

export const GOLD_LIMITS: Record<GoldKey, { min: number; max: number }> = {
  amount: { min: 1, max: 10_00_00_000 },
  years: { min: 1, max: 30 },
  growth: { min: -0.5, max: 0.5 },
  slabRate: { min: 0, max: 0.3 },
  making: { min: 0, max: 0.5 },
  buybackCut: { min: 0, max: 0.5 },
  spread: { min: 0, max: 0.2 },
  expenseRatio: { min: 0, max: 0.05 },
  sgbIssuePrice: { min: 1, max: 10_00_000 },
  goldPriceToday: { min: 1, max: 10_00_000 },
  sgbPremium: { min: -0.5, max: 0.5 },
};

export const GOLD_PERCENT: GoldKey[] = [
  'growth',
  'slabRate',
  'making',
  'buybackCut',
  'spread',
  'expenseRatio',
  'sgbPremium',
];

/** Example values, not anyone's and not a forecast. */
export const GOLD_EXAMPLE: GoldInput = {
  amount: 1_00_000,
  years: 5,
  growth: 0.08,
  slabRate: 0.2,
  making: 0.1,
  buybackCut: 0.05,
  spread: 0.03,
  expenseRatio: 0.005,
  sgbIssuePrice: 5_000,
  goldPriceToday: 10_000,
  sgbPremium: 0,
};
/** Years is a choice, not a figure to look up, so it is never labelled "Example". */
export const GOLD_EXAMPLE_KEYS: GoldKey[] = (Object.keys(GOLD_EXAMPLE) as GoldKey[]).filter(
  (k) => k !== 'years',
);

export const goldExampleForm = (): GoldForm => ({ ...GOLD_EXAMPLE });

export function invalidGoldFields(form: GoldForm): GoldKey[] {
  return (Object.keys(GOLD_LIMITS) as GoldKey[]).filter((key) => {
    const v = form[key];
    if (v === null || !Number.isFinite(v)) return true;
    const { min, max } = GOLD_LIMITS[key];
    if (v < min || v > max) return true;
    return key === 'years' && !Number.isInteger(v);
  });
}

export function toGoldInput(form: GoldForm): GoldInput | null {
  if (invalidGoldFields(form).length > 0) return null;
  return form as GoldInput;
}

const PARAMS: Record<GoldKey, string> = {
  amount: 'a',
  years: 'y',
  growth: 'g',
  slabRate: 't',
  making: 'mk',
  buybackCut: 'bb',
  spread: 'sp',
  expenseRatio: 'er',
  sgbIssuePrice: 'ip',
  goldPriceToday: 'gp',
  sgbPremium: 'pr',
};

export const goldShareSchema = Object.fromEntries(
  (Object.keys(GOLD_LIMITS) as GoldKey[]).map((k) => [
    k,
    { param: PARAMS[k], type: 'number' as const, ...GOLD_LIMITS[k], integer: k === 'years' },
  ]),
) as ShareSchema<GoldForm>;
