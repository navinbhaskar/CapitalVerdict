import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { carFuelScenarios, compareCarFuel, defaultPriceRiseShifts } from './carFuel';
import { defaults } from '@/data';
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

  it('maps to the spec example when price rise is set to 0%', () => {
    const input = toCarFuelInput({ ...CAR_FUEL_EXAMPLE_FORM, petrolPriceRise: 0, cngPriceRise: 0 });
    expect(input).toEqual(carFuelExample);
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

describe('car fuel scenarios (default form: base 3% rise, shifted to 0% and 5%)', () => {
  // Hand-checked with a separate month-by-month loop:
  //   0% → 33 months (the spec fixture); 3% → 32 months, net 10y ₹2,68,723; 5% → 31 months, ₹3,16,276.
  const shifts = defaultPriceRiseShifts(defaults.scenarioVariables.energyPriceRise.values);
  const runs = carFuelScenarios(toCarFuelInput(CAR_FUEL_EXAMPLE_FORM)!, shifts);

  it('shifts come from the default table', () => {
    expect(shifts.pessimistic).toBeCloseTo(-0.03, 12);
    expect(shifts.optimistic).toBeCloseTo(0.02, 12);
  });

  it('never shifts a price rise below 0%', () => {
    const r = carFuelScenarios(carFuelExample, shifts);
    expect(r.pessimistic.input.base.annualPriceRise).toBe(0);
  });

  it('pessimistic (0%) reproduces the spec fixture', () => {
    expect(runs.pessimistic.output.netAt10Years!.withInterest).toBeCloseTo(
      compareCarFuel(carFuelExample).netAt10Years!.withInterest,
      6,
    );
    expect(runs.pessimistic.output.breakevenWithInterest?.months).toBe(33);
  });

  it('base (3%) and optimistic (5%)', () => {
    expect(runs.base.output.breakevenWithInterest?.months).toBe(32);
    expect(runs.base.output.netAt10Years!.withInterest).toBeCloseTo(268_723.25, 0);
    expect(runs.optimistic.output.breakevenWithInterest?.months).toBe(31);
    expect(runs.optimistic.output.netAt10Years!.withInterest).toBeCloseTo(316_275.85, 0);
  });
});
