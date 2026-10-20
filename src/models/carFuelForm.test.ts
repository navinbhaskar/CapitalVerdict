import { describe, expect, it } from 'vitest';
import { defaults } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { carFuelScenarios } from './carFuel';
import { carFuelExample } from './carFuel.example';
import {
  CAR_FUEL_EXAMPLE_FORM,
  carFuelShareSchema,
  evEnergyPrice,
  extraPriceOf,
  invalidFields,
  onlyPricesMissing,
  toCarFuelInput,
  type CarFuelForm,
} from './carFuelForm';

describe('car fuel form', () => {
  // Test prices only (not market data), chosen to reproduce the spec's ₹90,000 gap.
  const priced = { ...CAR_FUEL_EXAMPLE_FORM, petrolCarPrice: 700_000, cngCarPrice: 790_000 };

  it('starts with both car prices empty, so no result yet', () => {
    expect(CAR_FUEL_EXAMPLE_FORM.petrolCarPrice).toBeNull();
    expect(CAR_FUEL_EXAMPLE_FORM.cngCarPrice).toBeNull();
    expect(invalidFields(CAR_FUEL_EXAMPLE_FORM).sort()).toEqual(['cngCarPrice', 'petrolCarPrice']);
    expect(onlyPricesMissing(CAR_FUEL_EXAMPLE_FORM)).toBe(true);
    expect(toCarFuelInput(CAR_FUEL_EXAMPLE_FORM)).toBeNull();
  });

  it('maps to the spec / workbook example once prices are in', () => {
    expect(toCarFuelInput(priced)).toEqual({
      ...carFuelExample,
      purchasePrices: { base: 700_000, alternative: 790_000 },
    });
    expect(extraPriceOf(priced)).toBe(90_000);
  });

  it('allows the CNG car to be the cheaper one', () => {
    const cheaperCng = { ...priced, cngCarPrice: 680_000 };
    expect(extraPriceOf(cheaperCng)).toBe(-20_000);
    expect(toCarFuelInput(cheaperCng)?.extraPrice).toBe(-20_000);
  });

  it('reports empty and out-of-range fields and refuses to map', () => {
    const form = { ...priced, cngMileage: null, horizonYears: 2.5, monthlyKm: -5 };
    expect(invalidFields(form).sort()).toEqual(['cngMileage', 'horizonYears', 'monthlyKm']);
    expect(onlyPricesMissing(form)).toBe(false);
    expect(toCarFuelInput(form)).toBeNull();
  });

  it('round-trips through a share link', () => {
    const encoded = encodeShare(priced, carFuelShareSchema);
    // Empty fields are not written to the link, so they come back absent.
    expect(decodeShare(encoded, carFuelShareSchema)).toEqual(
      Object.fromEntries(Object.entries(priced).filter(([, v]) => v !== null)),
    );
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

describe('car fuel form: EV as the alternative', () => {
  // Test values only (not market data).
  const ev: CarFuelForm = {
    ...CAR_FUEL_EXAMPLE_FORM,
    alt: 'ev',
    petrolCarPrice: 700_000,
    evCarPrice: 1_100_000,
    evEfficiency: 7,
    homeChargingShare: 0.8,
    homeRate: 8,
    publicRate: 20,
  };

  it('blends home and public charging: 0.8 × ₹8 + 0.2 × ₹20 = ₹10.40/kWh', () => {
    expect(evEnergyPrice(ev)).toBeCloseTo(10.4, 12);
  });

  it('does not need a public price when all charging is at home', () => {
    const home = { ...ev, homeChargingShare: 1, publicRate: null };
    expect(invalidFields(home)).toEqual([]);
    expect(evEnergyPrice(home)).toBe(8);
  });

  it('ignores CNG fields when EV is chosen, and EV fields when CNG is', () => {
    expect(invalidFields(ev)).toEqual([]);
    expect(invalidFields({ ...CAR_FUEL_EXAMPLE_FORM, petrolCarPrice: 1, cngCarPrice: 2 })).toEqual(
      [],
    );
  });

  it('starts with every EV value empty', () => {
    const fresh = { ...CAR_FUEL_EXAMPLE_FORM, alt: 'ev' as const };
    expect(invalidFields(fresh).sort()).toEqual([
      'evCarPrice',
      'evEfficiency',
      'homeChargingShare',
      'homeRate',
      'petrolCarPrice',
      'publicRate',
    ]);
  });

  it('maps to an EV alternative: ₹10.40/kWh ÷ 7 km/kWh, ₹4,00,000 extra price', () => {
    const input = toCarFuelInput(ev)!;
    expect(input.alternative).toEqual({
      mileage: 7,
      energyPrice: expect.closeTo(10.4, 12),
      annualPriceRise: 0,
      annualUpkeep: 0,
    });
    expect(input.extraPrice).toBe(400_000);
    expect(extraPriceOf(ev)).toBe(400_000);
  });

  it('round-trips the choice through a share link', () => {
    expect(decodeShare(encodeShare(ev, carFuelShareSchema), carFuelShareSchema).alt).toBe('ev');
  });
});

describe('car fuel form: all three cars and extras', () => {
  // Test values only (not market data).
  const all: CarFuelForm = {
    ...CAR_FUEL_EXAMPLE_FORM,
    alt: 'all',
    petrolCarPrice: 700_000,
    cngCarPrice: 790_000,
    evCarPrice: 1_200_000,
    evEfficiency: 7,
    homeChargingShare: 1,
    homeRate: 8,
  };

  it('"all" needs every car price and the EV fields', () => {
    const empty = { ...CAR_FUEL_EXAMPLE_FORM, alt: 'all' as const };
    expect(invalidFields(empty).sort()).toEqual(
      [
        'cngCarPrice',
        'evCarPrice',
        'evEfficiency',
        'homeChargingShare',
        'homeRate',
        'petrolCarPrice',
        'publicRate',
      ].sort(),
    );
    expect(invalidFields(all)).toEqual([]);
  });

  it('builds a petrol pair for each alternative', () => {
    expect(toCarFuelInput(all, 'cng')?.extraPrice).toBe(90_000);
    expect(toCarFuelInput(all, 'ev')?.extraPrice).toBe(500_000);
    expect(toCarFuelInput(all, 'ev')?.alternative.energyPrice).toBe(8);
    expect(extraPriceOf(all, 'ev')).toBe(500_000);
  });

  it('adds insurance to upkeep, places a one-off in its year, and turns resale shares into rupees', () => {
    const input = toCarFuelInput(
      {
        ...all,
        petrolInsurance: 20_000,
        evInsurance: 30_000,
        evOneOffCost: 400_000,
        evOneOffYear: 8,
        petrolResale: 0.3,
        evResale: 0.25,
      },
      'ev',
    )!;
    expect(input.base.annualUpkeep).toBe(20_000);
    expect(input.alternative.annualUpkeep).toBe(30_000);
    // Year 8 starts in month (8 − 1) × 12 + 1 = 85.
    expect(input.alternative.oneOff).toEqual({ month: 85, amount: 400_000 });
    expect(input.resale).toEqual({ base: 210_000, alternative: 300_000 });
  });

  it('a one-off cost needs its year; empty extras are not counted', () => {
    expect(invalidFields({ ...all, cngOneOffCost: 15_000 })).toEqual(['cngOneOffYear']);
    const plain = toCarFuelInput(all, 'cng')!;
    expect(plain.resale).toBeUndefined();
    expect(plain.alternative.oneOff).toBeUndefined();
  });

  it('round-trips "all" and the extras through a share link', () => {
    const form = { ...all, evResale: 0.25, cngOneOffCost: 15_000, cngOneOffYear: 3 };
    const back = decodeShare(encodeShare(form, carFuelShareSchema), carFuelShareSchema);
    expect(back.alt).toBe('all');
    expect(back.evResale).toBe(0.25);
    expect(back.cngOneOffYear).toBe(3);
  });
});
