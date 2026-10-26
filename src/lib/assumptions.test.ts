import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSUMPTIONS,
  STORAGE_KEY,
  clearAssumptions,
  loadAssumptions,
  parseStored,
  saveAssumptions,
} from './assumptions';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const throwing = {
  getItem(): string | null {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

describe('defaults', () => {
  it('come from defaults.json base values', () => {
    expect(DEFAULT_ASSUMPTIONS.inflation).toBe(0.06);
    expect(DEFAULT_ASSUMPTIONS.equityReturn).toBe(0.1);
    expect(DEFAULT_ASSUMPTIONS.carLoanRate).toBe(0.09);
  });

  it('leave unverified values unset instead of guessing', () => {
    expect(DEFAULT_ASSUMPTIONS.fdRate).toBeNull();
    expect(DEFAULT_ASSUMPTIONS.homeLoanRate).toBeNull();
    expect(DEFAULT_ASSUMPTIONS.marginalTaxRate).toBeNull();
  });
});

describe('parseStored', () => {
  it('returns defaults for missing, empty or corrupt data', () => {
    expect(parseStored(null)).toEqual(DEFAULT_ASSUMPTIONS);
    expect(parseStored('')).toEqual(DEFAULT_ASSUMPTIONS);
    expect(parseStored('{not json')).toEqual(DEFAULT_ASSUMPTIONS);
    expect(parseStored('42')).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it('keeps valid fields and drops invalid ones individually', () => {
    const stored = JSON.stringify({ inflation: 0.05, equityReturn: 9, fdRate: 0.07, extra: 1 });
    const result = parseStored(stored);
    expect(result.inflation).toBe(0.05);
    expect(result.fdRate).toBe(0.07);
    expect(result.equityReturn).toBe(DEFAULT_ASSUMPTIONS.equityReturn);
    expect(result).not.toHaveProperty('extra');
  });

  it('rejects unknown enum values', () => {
    expect(parseStored(JSON.stringify({ taxRegime: 'flat' })).taxRegime).toBe('new');
  });
});

describe('save / load / clear', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const value = { ...DEFAULT_ASSUMPTIONS, inflation: 0.055, marginalTaxRate: 0.312 };
    expect(saveAssumptions(storage, value)).toBe(true);
    expect(loadAssumptions(storage)).toEqual(value);
    clearAssumptions(storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadAssumptions(storage)).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it('refuses to save invalid values', () => {
    const storage = new MemoryStorage();
    expect(saveAssumptions(storage, { ...DEFAULT_ASSUMPTIONS, inflation: -1 })).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('survives storage that throws or is missing', () => {
    expect(loadAssumptions(throwing)).toEqual(DEFAULT_ASSUMPTIONS);
    expect(saveAssumptions(throwing, DEFAULT_ASSUMPTIONS)).toBe(false);
    expect(() => clearAssumptions(throwing)).not.toThrow();
    expect(loadAssumptions(null)).toEqual(DEFAULT_ASSUMPTIONS);
    expect(saveAssumptions(null, DEFAULT_ASSUMPTIONS)).toBe(false);
  });
});

describe('city', () => {
  it('keeps a city with verified prices', () => {
    expect(parseStored(JSON.stringify({ city: 'lucknow' })).city).toBe('lucknow');
  });

  it('drops a stored city whose prices are not verified', () => {
    expect(parseStored(JSON.stringify({ city: 'kanpur' })).city).toBeNull();
  });
});
