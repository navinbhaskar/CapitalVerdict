import { describe, expect, it } from 'vitest';
import { dataRecord, defaults } from './schema';

describe('defaults.json', () => {
  it('matches the spec scenario table', () => {
    const v = defaults.scenarioVariables;
    expect(v.inflation.values).toEqual({ pessimistic: 0.07, base: 0.06, optimistic: 0.05 });
    expect(v.equityReturnNominal.values).toEqual({
      pessimistic: 0.07,
      base: 0.1,
      optimistic: 0.12,
    });
    expect(v.propertyAppreciation.values).toEqual({
      pessimistic: 0.03,
      base: 0.05,
      optimistic: 0.07,
    });
    expect(v.rentGrowth.values).toEqual({ pessimistic: 0.07, base: 0.05, optimistic: 0.04 });
    expect(v.energyPriceRise.values).toEqual({ pessimistic: 0, base: 0.03, optimistic: 0.05 });
  });
});

describe('dataRecord', () => {
  const base = { unit: '₹/L', source: 'x', effectiveDate: '2026-01-01' };

  it('allows a null value only while TODO_VERIFY', () => {
    expect(dataRecord.safeParse({ ...base, value: null, status: 'TODO_VERIFY' }).success).toBe(
      true,
    );
    expect(dataRecord.safeParse({ ...base, value: null, status: 'verified' }).success).toBe(false);
  });

  it('requires a valid ISO date', () => {
    expect(
      dataRecord.safeParse({ ...base, effectiveDate: '19/10/2026', value: 1, status: 'verified' })
        .success,
    ).toBe(false);
  });
});
