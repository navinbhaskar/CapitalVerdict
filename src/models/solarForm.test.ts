import { describe, expect, it } from 'vitest';
import { simpleTariff } from '@/engine/tariff';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import {
  SOLAR_EXAMPLE_FORM,
  SOLAR_EXAMPLE_KEYS,
  SOLAR_START_FORM,
  invalidSolarFields,
  solarShareSchema,
  toSolarInput,
  type SolarForm,
} from './solarForm';

// SYNTHETIC values for testing only (not market data).
const filled: SolarForm = {
  ...SOLAR_START_FORM,
  systemKW: 3,
  grossCost: 180_000,
  subsidy: 78_000,
  generationPerKWPerDay: 4,
  degradationPerYear: 0,
  monthlyConsumptionKWh: 400,
  averageRate: 7,
};

describe('solar form', () => {
  it('starts without invented data: unverified values are empty', () => {
    expect(SOLAR_START_FORM.subsidy).toBeNull();
    expect(SOLAR_START_FORM.generationPerKWPerDay).toBeNull();
    // Sourced from a module warranty: 97.5% after year 1, −0.6% a year, 83.1% at year 25.
    expect(SOLAR_START_FORM.degradationPerYear).toBeCloseTo(1 - Math.pow(0.831, 1 / 24), 4);
    expect(SOLAR_START_FORM.exportRatePerKWh).toBeNull();
    expect(SOLAR_START_FORM.tariffRisePerYear).toBe(0);
    expect(toSolarInput(SOLAR_START_FORM, null)).toBeNull();
  });

  it('lists what is missing before a result is possible', () => {
    expect(invalidSolarFields(SOLAR_START_FORM, false).sort()).toEqual([
      'averageRate',
      'generationPerKWPerDay',
      'grossCost',
      'monthlyConsumptionKWh',
      'systemKW',
    ]);
  });

  it('maps a complete form with the average-rate tariff', () => {
    const input = toSolarInput(filled, null)!;
    expect(input.tariff).toEqual(simpleTariff(7, 0));
    expect(input.subsidy).toBe(78_000);
    expect(input.exportRatePerKWh).toBe(0);
    expect(input.inverter).toBeNull();
    expect(input.sanctionedLoadKW).toBe(3);
  });

  it('needs inverter year and cost together', () => {
    expect(invalidSolarFields({ ...filled, inverterYear: 10 }, false)).toEqual(['inverterCost']);
    expect(
      toSolarInput({ ...filled, inverterYear: 10, inverterCost: 30_000 }, null)?.inverter,
    ).toEqual({
      year: 10,
      cost: 30_000,
    });
  });

  it('rejects a subsidy above the cost', () => {
    expect(invalidSolarFields({ ...filled, subsidy: 200_000 }, false)).toContain('subsidy');
  });

  it('with a verified slab tariff, needs sanctioned load instead of an average rate', () => {
    const slab = simpleTariff(5, 0);
    const noRate = { ...filled, averageRate: null };
    expect(invalidSolarFields(noRate, true)).toEqual(['sanctionedLoadKW']);
    expect(toSolarInput({ ...noRate, sanctionedLoadKW: 5 }, slab)?.tariff).toBe(slab);
  });

  it('round-trips through a share link', () => {
    expect(decodeShare(encodeShare(filled, solarShareSchema), solarShareSchema)).toEqual(
      Object.fromEntries(Object.entries(filled).filter(([, v]) => v !== null)),
    );
  });
});

describe('solar form: example start', () => {
  it('opens complete with a flat rate, and never overrides verified data', () => {
    expect(invalidSolarFields(SOLAR_EXAMPLE_FORM, false)).toEqual([]);
    for (const key of SOLAR_EXAMPLE_KEYS) expect(SOLAR_START_FORM[key]).toBeNull();
    expect(SOLAR_EXAMPLE_FORM.systemKW).toBe(3);
  });
});
