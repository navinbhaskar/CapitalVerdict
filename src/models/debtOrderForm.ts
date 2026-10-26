/**
 * The debt-order form: up to five debts and the spare money. The three example debts and their
 * rates are ILLUSTRATIVE EXAMPLES (labelled "Example" on the page), not market rates.
 */
import type { ShareSchema } from '@/lib/shareLink';
import { DEBT_KINDS, type Debt, type DebtInput, type DebtKind } from './debtOrder';

/** Debt rows on the form. */
export const DEBT_SLOTS = 5;
export type Slot = 1 | 2 | 3 | 4 | 5;
export const SLOTS: readonly Slot[] = [1, 2, 3, 4, 5];

type SlotFields<N extends Slot> = {
  [K in `d${N}Kind`]: DebtKind;
} & {
  [K in `d${N}Balance` | `d${N}Rate` | `d${N}Payment`]: number | null;
};

export type DebtForm = SlotFields<1> &
  SlotFields<2> &
  SlotFields<3> &
  SlotFields<4> &
  SlotFields<5> & {
    /** Spare money a month. */
    extra: number | null;
    /** Spare money once, today; optional. */
    lumpSum: number | null;
  };

export type DebtNumberKey = {
  [K in keyof DebtForm]: DebtForm[K] extends number | null ? K : never;
}[keyof DebtForm];

export const debtKeys = (n: Slot) =>
  ({
    kind: `d${n}Kind`,
    balance: `d${n}Balance`,
    rate: `d${n}Rate`,
    payment: `d${n}Payment`,
  }) as const;

const SLOT_LIMITS = {
  balance: { min: 1, max: 1e9 },
  rate: { min: 0, max: 0.6 },
  payment: { min: 1, max: 1e8 },
};

export const DEBT_LIMITS = {
  ...Object.fromEntries(
    SLOTS.flatMap((n) => [
      [debtKeys(n).balance, SLOT_LIMITS.balance],
      [debtKeys(n).rate, SLOT_LIMITS.rate],
      [debtKeys(n).payment, SLOT_LIMITS.payment],
    ]),
  ),
  extra: { min: 0, max: 1e8 },
  lumpSum: { min: 0, max: 1e9 },
} as Record<DebtNumberKey, { min: number; max: number }>;

/** True when any of the slot's numbers is filled in. */
export const slotUsed = (form: DebtForm, n: Slot) => {
  const k = debtKeys(n);
  return form[k.balance] !== null || form[k.rate] !== null || form[k.payment] !== null;
};

/** Fields that are missing or out of range. Empty debt rows are fine; a started row needs all three. */
export function invalidDebtFields(form: DebtForm): DebtNumberKey[] {
  const required = new Set<DebtNumberKey>(['extra']);
  for (const n of SLOTS) {
    if (!slotUsed(form, n)) continue;
    const k = debtKeys(n);
    required.add(k.balance).add(k.rate).add(k.payment);
  }
  return (Object.keys(DEBT_LIMITS) as DebtNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return required.has(key);
    const { min, max } = DEBT_LIMITS[key];
    return !Number.isFinite(v) || v < min || v > max;
  });
}

export function toDebtInput(form: DebtForm): DebtInput | null {
  if (invalidDebtFields(form).length > 0) return null;
  const debts: Debt[] = SLOTS.filter((n) => slotUsed(form, n)).map((n) => {
    const k = debtKeys(n);
    return {
      kind: form[k.kind],
      balance: form[k.balance]!,
      annualRate: form[k.rate]!,
      payment: form[k.payment]!,
    };
  });
  if (debts.length < 2) return null;
  return { debts, extra: form.extra!, lumpSum: form.lumpSum ?? 0 };
}

const num = (param: string, key: DebtNumberKey) => ({
  param,
  type: 'number' as const,
  ...DEBT_LIMITS[key],
});

export const debtShareSchema: ShareSchema<DebtForm> = {
  ...Object.fromEntries(
    SLOTS.flatMap((n) => {
      const k = debtKeys(n);
      return [
        [k.kind, { param: `k${n}`, type: 'enum', values: DEBT_KINDS }],
        [k.balance, num(`b${n}`, k.balance)],
        [k.rate, num(`r${n}`, k.rate)],
        [k.payment, num(`p${n}`, k.payment)],
      ];
    }),
  ),
  extra: num('x', 'extra'),
  lumpSum: num('l', 'lumpSum'),
};

const EMPTY: DebtForm = {
  ...(Object.fromEntries(
    SLOTS.flatMap((n) => {
      const k = debtKeys(n);
      return [
        [k.kind, 'other'],
        [k.balance, null],
        [k.rate, null],
        [k.payment, null],
      ];
    }),
  ) as Omit<DebtForm, 'extra' | 'lumpSum'>),
  extra: null,
  lumpSum: null,
};

/**
 * Example debts, not market data: a card carried over, a personal loan and a home loan, with
 * ₹10,000 a month to spare. The home loan's EMI is the one for ₹30 lakh at 9% over 15 years.
 */
export const DEBT_EXAMPLE_VALUES: Partial<DebtForm> = {
  d1Kind: 'home',
  d1Balance: 3_000_000,
  d1Rate: 0.09,
  d1Payment: 30_428,
  d2Kind: 'personal',
  d2Balance: 60_000,
  d2Rate: 0.14,
  d2Payment: 5_000,
  d3Kind: 'card',
  d3Balance: 150_000,
  d3Rate: 0.36,
  d3Payment: 6_000,
  extra: 10_000,
};

export const debtExampleForm = (): DebtForm => ({ ...EMPTY, ...DEBT_EXAMPLE_VALUES });
export const debtEmptyForm = (): DebtForm => ({ ...EMPTY });

/** The number fields the example fills in: shown as "Example" until the visitor changes them. */
export const DEBT_EXAMPLE_KEYS = (Object.keys(DEBT_EXAMPLE_VALUES) as (keyof DebtForm)[]).filter(
  (k) => !k.endsWith('Kind'),
) as DebtNumberKey[];
