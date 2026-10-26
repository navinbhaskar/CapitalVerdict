/**
 * Global assumptions: set once, read by every tool, kept only in this browser.
 * Rates are decimals. Storage access is always wrapped; a broken or blocked store means defaults.
 */
import { defaults, verifiedCityIds } from '@/data';

export interface GlobalAssumptions {
  state: 'UP';
  city: string | null;
  taxRegime: 'new' | 'old';
  /** Including cess. Entered by the user; null until they do. */
  marginalTaxRate: number | null;
  inflation: number;
  equityReturn: number;
  fdRate: number | null;
  homeLoanRate: number | null;
  carLoanRate: number;
}
export type AssumptionKey = keyof GlobalAssumptions;

/** Limits for the rate fields, as decimals. Used for validation messages. */
export const RATE_LIMITS = {
  marginalTaxRate: 0.5,
  inflation: 0.2,
  equityReturn: 0.3,
  fdRate: 0.2,
  homeLoanRate: 0.25,
  carLoanRate: 0.3,
} as const satisfies Partial<Record<AssumptionKey, number>>;

export const DEFAULT_ASSUMPTIONS: GlobalAssumptions = {
  state: 'UP',
  city: null,
  taxRegime: 'new',
  marginalTaxRate: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
  equityReturn: defaults.scenarioVariables.equityReturnNominal.values.base,
  fdRate: defaults.globalAssumptions.fdRate.value,
  homeLoanRate: defaults.globalAssumptions.homeLoanRate.value,
  carLoanRate: defaults.globalAssumptions.carLoanRate.value ?? 0.09,
};

const isRate = (max: number, nullable: boolean) => (v: unknown) =>
  (nullable && v === null) || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max);

/** One validator per field. Hand-written so the browser bundle does not need a schema library. */
const validators: { [K in AssumptionKey]: (v: unknown) => boolean } = {
  state: (v) => v === 'UP',
  // A city whose prices are not verified cannot be chosen; a stored one falls back to none.
  city: (v) => v === null || (typeof v === 'string' && verifiedCityIds.includes(v)),
  taxRegime: (v) => v === 'new' || v === 'old',
  marginalTaxRate: isRate(RATE_LIMITS.marginalTaxRate, true),
  inflation: isRate(RATE_LIMITS.inflation, false),
  equityReturn: isRate(RATE_LIMITS.equityReturn, false),
  fdRate: isRate(RATE_LIMITS.fdRate, true),
  homeLoanRate: isRate(RATE_LIMITS.homeLoanRate, true),
  carLoanRate: isRate(RATE_LIMITS.carLoanRate, false),
};

export function isValidAssumptions(value: GlobalAssumptions): boolean {
  return (Object.keys(validators) as AssumptionKey[]).every((k) => validators[k](value[k]));
}

export const STORAGE_KEY = 'dw.assumptions.v1';
export const ASSUMPTIONS_EVENT = 'dw:assumptions';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>;

/** Merge stored values over defaults field by field, keeping only fields that still validate. */
export function parseStored(raw: string | null): GlobalAssumptions {
  if (!raw) return { ...DEFAULT_ASSUMPTIONS };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_ASSUMPTIONS };
  }
  if (typeof data !== 'object' || data === null) return { ...DEFAULT_ASSUMPTIONS };

  const merged: Record<string, unknown> = { ...DEFAULT_ASSUMPTIONS };
  for (const key of Object.keys(validators) as AssumptionKey[]) {
    if (!(key in data)) continue;
    const value = (data as Record<string, unknown>)[key];
    if (validators[key](value)) merged[key] = value;
  }
  return merged as unknown as GlobalAssumptions;
}

export function loadAssumptions(storage: ReadableStorage | null): GlobalAssumptions {
  try {
    return parseStored(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return { ...DEFAULT_ASSUMPTIONS };
  }
}

/** Returns false if the browser refused to store (private mode, quota, blocked storage). */
export function saveAssumptions(
  storage: WritableStorage | null,
  value: GlobalAssumptions,
): boolean {
  if (!storage) return false;
  if (!isValidAssumptions(value)) return false;
  try {
    const clean = Object.fromEntries(
      (Object.keys(validators) as AssumptionKey[]).map((k) => [k, value[k]]),
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function clearAssumptions(storage: WritableStorage | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: defaults apply either way.
  }
}

/** localStorage, or null when it is unavailable or throws. */
export function browserStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}
