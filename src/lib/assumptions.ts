/**
 * Global assumptions: set once, read by every tool, kept only in this browser.
 * Rates are decimals. Storage access is always wrapped; a broken or blocked store means defaults.
 */
import { z } from 'zod';
import { defaults } from '@/data/schema';

const rate = (max: number) => z.number().min(0).max(max);

export const assumptionsSchema = z.object({
  state: z.enum(['UP']),
  taxRegime: z.enum(['new', 'old']),
  /** Including cess. Entered by the user; null until they do. */
  marginalTaxRate: rate(0.5).nullable(),
  inflation: rate(0.2),
  equityReturn: rate(0.3),
  fdRate: rate(0.2).nullable(),
  homeLoanRate: rate(0.25).nullable(),
  carLoanRate: rate(0.3),
});

export type GlobalAssumptions = z.infer<typeof assumptionsSchema>;
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
  taxRegime: 'new',
  marginalTaxRate: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
  equityReturn: defaults.scenarioVariables.equityReturnNominal.values.base,
  fdRate: defaults.globalAssumptions.fdRate.value,
  homeLoanRate: defaults.globalAssumptions.homeLoanRate.value,
  carLoanRate: defaults.globalAssumptions.carLoanRate.value ?? 0.09,
};

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
  const shape = assumptionsSchema.shape;
  for (const key of Object.keys(shape) as AssumptionKey[]) {
    if (!(key in data)) continue;
    const result = shape[key].safeParse((data as Record<string, unknown>)[key]);
    if (result.success) merged[key] = result.data;
  }
  return merged as GlobalAssumptions;
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
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(assumptionsSchema.parse(value)));
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
