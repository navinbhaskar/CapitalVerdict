/**
 * The HRA calculator's form. Salary, HRA and rent start as ILLUSTRATIVE EXAMPLES (labelled
 * "Example"); the city list and the slab rates come from the verified income tax data.
 */
import { incomeTax } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { HraInput } from './hra';

/** The 50% cities, then everywhere else. */
export const HRA_CITIES: readonly string[] = [...incomeTax.hra.largeCities, 'other'];
/** The old regime's slab rates above nil, for "tax saved". */
export const SLAB_RATES: readonly number[] = [
  ...new Set(incomeTax.regimes.old.slabs.map((s) => s.rate).filter((r) => r > 0)),
];

export interface HraForm {
  basicPlusDa: number | null;
  hraReceived: number | null;
  rentPaid: number | null;
  months: number | null;
  city: string;
  slabRate: number;
}

export type HraNumberKey = 'basicPlusDa' | 'hraReceived' | 'rentPaid' | 'months';

export const HRA_LIMITS: Record<HraNumberKey, { min: number; max: number }> = {
  basicPlusDa: { min: 1, max: 1e8 },
  hraReceived: { min: 0, max: 1e8 },
  rentPaid: { min: 0, max: 1e8 },
  months: { min: 1, max: 12 },
};

const num = (param: string, key: HraNumberKey) => ({
  param,
  type: 'number' as const,
  ...HRA_LIMITS[key],
  integer: key === 'months',
});

export const hraShareSchema: ShareSchema<HraForm> = {
  basicPlusDa: num('b', 'basicPlusDa'),
  hraReceived: num('h', 'hraReceived'),
  rentPaid: num('r', 'rentPaid'),
  months: num('m', 'months'),
  city: { param: 'c', type: 'enum', values: HRA_CITIES },
  slabRate: { param: 't', type: 'number', min: 0, max: 0.45 },
};

export function invalidHraFields(form: HraForm): HraNumberKey[] {
  return (Object.keys(HRA_LIMITS) as HraNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return true;
    const { min, max } = HRA_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return key === 'months' && !Number.isInteger(v);
  });
}

export function toHraInput(form: HraForm): HraInput | null {
  if (invalidHraFields(form).length > 0) return null;
  return {
    basicPlusDa: form.basicPlusDa!,
    hraReceived: form.hraReceived!,
    rentPaid: form.rentPaid!,
    months: form.months!,
    largeCity: form.city !== 'other',
    // A shared link may carry any rate in range; snap it to the nearest real slab rate.
    slabRate: SLAB_RATES.reduce((a, b) =>
      Math.abs(b - form.slabRate) < Math.abs(a - form.slabRate) ? b : a,
    ),
  };
}

/** Example values, not anyone's salary: ₹50,000 basic and DA, ₹25,000 HRA, ₹28,000 rent. */
export const HRA_EXAMPLE_VALUES = {
  basicPlusDa: 50_000,
  hraReceived: 25_000,
  rentPaid: 28_000,
} as const;
export const HRA_EXAMPLE_KEYS = Object.keys(HRA_EXAMPLE_VALUES) as HraNumberKey[];

export const hraExampleForm = (): HraForm => ({
  ...HRA_EXAMPLE_VALUES,
  months: 12,
  city: 'bengaluru',
  slabRate: Math.max(...SLAB_RATES),
});
