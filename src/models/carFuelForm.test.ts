import { describe, expect, it } from 'vitest';
import { defaults } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { carFuelScenarios } from './carFuel';
import { carFuelExample } from './carFuel.example';
import {
  CAR_FUEL_EXAMPLE_FORM,
  carFuelShareSchema,
  invalidFields,
  toCarFuelInput,
} from './carFuelForm';

describe('car fuel form', () => {
  it('example form starts valid', () => {
    expect(invalidFields(CAR_FUEL_EXAMPLE_FORM)).toEqual([]);
  });

  it('maps exactly to the spec / workbook example (flat prices)', () => {
    expect(toCarFuelInput(CAR_FUEL_EXAMPLE_FORM)).toEqual(carFuelExample);
  });

  it('reports empty and out-of-range fields and refuses to map', () => {
    const form = { ...CAR_FUEL_EXAMPLE_FORM, cngMileage: null, horizonYears: 2.5, monthlyKm: -5 };
    expect(invalidFields(form).sort()).toEqual(['cngMileage', 'horizonYears', 'monthlyKm']);
    expect(toCarFuelInput(form)).toBeNull();
  });

  it('round-trips through a share link', () => {
    const encoded = encodeShare(CAR_FUEL_EXAMPLE_FORM, carFuelShareSchema);
    expect(decodeShare(encoded, carFuelShareSchema)).toEqual(CAR_FUEL_EXAMPLE_FORM);
  });
});

describe('car fuel price-rise scenarios (0% / 3% / 5% on both fuels)', () => {
  // Hand-checked with a separate month-by-month loop:
  //   0% → 33 months (the spec fixture); 3% → 32 months, net 10y ₹2,68,723; 5% → 31 months, ₹3,16,276.
  const runs = carFuelScenarios(carFuelExample, defaults.scenarioVariables.energyPriceRise.values);

  it('uses the default scenario table rates', () => {
    expect(runs.pessimistic.input.base.annualPriceRise).toBe(0);
    expect(runs.base.input.alternative.annualPriceRise).toBe(0.03);
    expect(runs.optimistic.input.alternative.annualPriceRise).toBe(0.05);
  });

  it('0% reproduces the spec fixture', () => {
    expect(runs.pessimistic.output.breakevenWithInterest?.months).toBe(33);
    expect(runs.pessimistic.output.netAt10Years!.withInterest).toBeCloseTo(206_236.32, 1);
  });

  it('3% and 5%', () => {
    expect(runs.base.output.breakevenWithInterest?.months).toBe(32);
    expect(runs.base.output.netAt10Years!.withInterest).toBeCloseTo(268_723.25, 0);
    expect(runs.optimistic.output.breakevenWithInterest?.months).toBe(31);
    expect(runs.optimistic.output.netAt10Years!.withInterest).toBeCloseTo(316_275.85, 0);
  });
});
