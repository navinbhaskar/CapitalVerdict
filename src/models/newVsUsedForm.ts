/**
 * The new or used car form.
 *
 * Some fields follow the others until the visitor types over them ("auto" fields):
 *   - the new car's road tax: Delhi's one-time rate on its price;
 *   - the used car's price and both sale prices: the insurers' value schedule (India Motor
 *     Tariff), a stand-in for market prices, labelled as such;
 *   - insurance: the third-party base premium for the engine size.
 * The schedule stops at five years old, so a sale price beyond that has no stand-in. The used
 * car's then starts as an ILLUSTRATIVE EXAMPLE, as do the new car's price and the return.
 */
import { carRoadTax, defaults, idvDepreciationShare, thirdPartyPremium } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { NewVsUsedInput } from './newVsUsed';

export type EngineSize = 'small' | 'mid' | 'large';
export type Payment = 'cash' | 'loan';

/** An engine size within each third-party premium band. */
export const ENGINE_CC: Record<EngineSize, number> = { small: 1000, mid: 1500, large: 2000 };
export const ENGINE_SIZES: EngineSize[] = ['small', 'mid', 'large'];
export const USED_AGES = [1, 2, 3, 4] as const;

export interface NewVsUsedForm {
  years: number | null;
  engine: EngineSize;
  payment: Payment;
  usedAge: number;
  newPrice: number | null;
  newOneOff: number | null;
  newInsurance: number | null;
  newUpkeep: number | null;
  newSale: number | null;
  newLoanRate: number | null;
  usedPrice: number | null;
  usedOneOff: number | null;
  usedInsurance: number | null;
  usedUpkeep: number | null;
  usedSale: number | null;
  usedLoanRate: number | null;
  loanShare: number | null;
  loanYears: number | null;
  investmentReturn: number | null;
}

export type NewVsUsedNumberKey = {
  [K in keyof NewVsUsedForm]: NewVsUsedForm[K] extends number | null ? K : never;
}[keyof NewVsUsedForm];

const MONEY = { min: 0, max: 10_00_00_000 };
export const NEW_VS_USED_LIMITS: Record<
  Exclude<NewVsUsedNumberKey, 'usedAge'>,
  { min: number; max: number }
> = {
  years: { min: 1, max: 10 },
  newPrice: { min: 1, max: MONEY.max },
  newOneOff: MONEY,
  newInsurance: MONEY,
  newUpkeep: MONEY,
  newSale: MONEY,
  newLoanRate: { min: 0, max: 0.3 },
  usedPrice: { min: 1, max: MONEY.max },
  usedOneOff: MONEY,
  usedInsurance: MONEY,
  usedUpkeep: MONEY,
  usedSale: MONEY,
  usedLoanRate: { min: 0, max: 0.3 },
  loanShare: { min: 0.05, max: 0.95 },
  loanYears: { min: 1, max: 10 },
  investmentReturn: { min: 0, max: 0.3 },
};
type FieldKey = keyof typeof NEW_VS_USED_LIMITS;

/** Empty means nil. */
const OPTIONAL: FieldKey[] = ['newUpkeep', 'usedUpkeep', 'usedOneOff'];
/** Needed only for a loan. */
const LOAN_ONLY: FieldKey[] = ['newLoanRate', 'usedLoanRate', 'loanShare', 'loanYears'];
const INTEGER: FieldKey[] = ['years', 'loanYears'];

/** The fields that follow the others until the visitor types over them. */
export const AUTO_KEYS = [
  'newOneOff',
  'newSale',
  'usedPrice',
  'usedSale',
  'newInsurance',
  'usedInsurance',
] as const;
export type AutoKey = (typeof AUTO_KEYS)[number];

/** Example values, not anyone's car. */
export const NEW_VS_USED_EXAMPLE = {
  newPrice: 10_00_000,
  /** Only while the used car is past the insurers' schedule at the sale. */
  usedSale: 3_00_000,
  investmentReturn: 0.07,
} as const;

/** The car's value as a share of the new price at `ageYears`, from the insurers' schedule. */
const scheduleValue = (newPrice: number, ageYears: number) => {
  const share = idvDepreciationShare(ageYears * 12);
  return share === null ? null : newPrice * (1 - share);
};

/** What each auto field would be, from the other fields; null where there is no stand-in. */
export function autoValues(form: NewVsUsedForm): Record<AutoKey, number | null> {
  const p = form.newPrice;
  const y = form.years;
  const ok = p !== null && p > 0;
  const okYears = y !== null && Number.isInteger(y) && y >= 1;
  const premium = thirdPartyPremium(ENGINE_CC[form.engine]);
  return {
    newOneOff: ok ? carRoadTax('DL', p) : null,
    newSale: ok && okYears ? scheduleValue(p, y) : null,
    usedPrice: ok ? scheduleValue(p, form.usedAge) : null,
    usedSale: ok && okYears ? scheduleValue(p, form.usedAge + y) : null,
    newInsurance: premium,
    usedInsurance: premium,
  };
}

export type AutoSource = 'auto' | 'example' | 'yours';

/**
 * The form with every auto field filled in unless the visitor typed over it, and where each value
 * came from, so the page can label it.
 */
export function resolveNewVsUsed(
  form: NewVsUsedForm,
  pinned: ReadonlySet<keyof NewVsUsedForm>,
): { form: NewVsUsedForm; source: Partial<Record<keyof NewVsUsedForm, AutoSource>> } {
  const auto = autoValues(form);
  const out = { ...form };
  const source: Partial<Record<keyof NewVsUsedForm, AutoSource>> = {};
  for (const key of AUTO_KEYS) {
    if (pinned.has(key)) continue;
    const v = auto[key];
    if (v !== null) {
      out[key] = v;
      source[key] = 'auto';
    } else if (key === 'usedSale') {
      out[key] = NEW_VS_USED_EXAMPLE.usedSale;
      source[key] = 'example';
    } else {
      out[key] = null;
    }
  }
  for (const key of ['newPrice', 'investmentReturn'] as const) {
    if (!pinned.has(key) && out[key] === NEW_VS_USED_EXAMPLE[key]) source[key] = 'example';
  }
  return { form: out, source };
}

export function invalidNewVsUsedFields(form: NewVsUsedForm): FieldKey[] {
  return (Object.keys(NEW_VS_USED_LIMITS) as FieldKey[]).filter((key) => {
    if (form.payment === 'cash' && LOAN_ONLY.includes(key)) return false;
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = NEW_VS_USED_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
}

/** Takes a resolved form (see `resolveNewVsUsed`). */
export function toNewVsUsedInput(form: NewVsUsedForm): NewVsUsedInput | null {
  if (invalidNewVsUsedFields(form).length > 0) return null;
  const loan = form.payment === 'loan';
  return {
    new: {
      price: form.newPrice!,
      oneOff: form.newOneOff!,
      insurance: form.newInsurance!,
      upkeep: form.newUpkeep ?? 0,
      sale: form.newSale!,
      loanRate: loan ? form.newLoanRate! : 0,
    },
    used: {
      price: form.usedPrice!,
      oneOff: form.usedOneOff ?? 0,
      insurance: form.usedInsurance!,
      upkeep: form.usedUpkeep ?? 0,
      sale: form.usedSale!,
      loanRate: loan ? form.usedLoanRate! : 0,
    },
    years: form.years!,
    loanShare: loan ? form.loanShare! : 0,
    loanYears: loan ? form.loanYears! : 1,
    investmentReturn: form.investmentReturn!,
  };
}

export const newVsUsedStartForm = (): NewVsUsedForm => ({
  years: 5,
  engine: 'mid',
  payment: 'cash',
  usedAge: 3,
  newPrice: NEW_VS_USED_EXAMPLE.newPrice,
  newOneOff: null,
  newInsurance: null,
  newUpkeep: null,
  newSale: null,
  newLoanRate:
    defaults.globalAssumptions.carLoanRate.status === 'verified'
      ? defaults.globalAssumptions.carLoanRate.value
      : null,
  usedPrice: null,
  usedOneOff: null,
  usedInsurance: null,
  usedUpkeep: null,
  usedSale: null,
  usedLoanRate: null,
  loanShare: 0.8,
  loanYears: 5,
  investmentReturn: NEW_VS_USED_EXAMPLE.investmentReturn,
});

const num = (param: string, key: FieldKey) => ({
  param,
  type: 'number' as const,
  ...NEW_VS_USED_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const newVsUsedShareSchema: ShareSchema<NewVsUsedForm> = {
  years: num('y', 'years'),
  engine: { param: 'e', type: 'enum', values: ENGINE_SIZES },
  payment: { param: 'pay', type: 'enum', values: ['cash', 'loan'] },
  usedAge: { param: 'age', type: 'number', min: 1, max: 4, integer: true },
  newPrice: num('np', 'newPrice'),
  newOneOff: num('nt', 'newOneOff'),
  newInsurance: num('ni', 'newInsurance'),
  newUpkeep: num('nu', 'newUpkeep'),
  newSale: num('ns', 'newSale'),
  newLoanRate: num('nr', 'newLoanRate'),
  usedPrice: num('up', 'usedPrice'),
  usedOneOff: num('ut', 'usedOneOff'),
  usedInsurance: num('ui', 'usedInsurance'),
  usedUpkeep: num('uu', 'usedUpkeep'),
  usedSale: num('us', 'usedSale'),
  usedLoanRate: num('ur', 'usedLoanRate'),
  loanShare: num('ls', 'loanShare'),
  loanYears: num('ly', 'loanYears'),
  investmentReturn: num('ret', 'investmentReturn'),
};
