import changelogJson from './changelog.json';
import { describe, expect, it } from 'vitest';
import { changelogSchema, dataRecord, tariffSchema, validateAllData } from './schema';
import {
  defaults,
  dlSolarData,
  dlTariff,
  fuelPrices,
  solarData,
  propertyData,
  upTariff,
  verifiedFuelPrices,
  verifiedSolarValue,
  verifiedStampDuty,
  verifiedTariff,
} from './index';

describe('data files', () => {
  it('all validate against their schemas', () => {
    expect(() => validateAllData()).not.toThrow();
  });
});

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

describe('fuelPrices.json', () => {
  it('has no invented prices: every value is either verified or null + TODO_VERIFY', () => {
    for (const city of fuelPrices.cities) {
      for (const record of [city.petrol, city.cng]) {
        if (record.status === 'TODO_VERIFY') expect(record.value).toBeNull();
        else expect(record.value).toBeGreaterThan(0);
      }
    }
  });

  it('returns verified Lucknow prices', () => {
    expect(verifiedFuelPrices('lucknow')).toEqual({ petrol: 101.86, cng: 107 });
  });

  it('returns null for unverified or unknown cities', () => {
    expect(verifiedFuelPrices('kanpur')).toBeNull();
    expect(verifiedFuelPrices('nowhere')).toBeNull();
    expect(verifiedFuelPrices(null)).toBeNull();
  });
});

describe('tariffs/UP.json and solar.json', () => {
  it('have no invented values while TODO_VERIFY', () => {
    expect(upTariff.status).toBe('TODO_VERIFY');
    expect(upTariff.slabs).toEqual([]);
    expect(verifiedTariff()).toBeNull();
    for (const key of [
      'subsidy',
      'generationPerKWPerDay',
      'degradationPerYear',
      'exportRatePerKWh',
    ] as const) {
      expect(solarData[key]!.value).toBeNull();
      expect(verifiedSolarValue(key)).toBeNull();
    }
  });

  it('a verified tariff must have a method and slabs', () => {
    const base = { ...upTariff, status: 'verified' as const };
    expect(tariffSchema.safeParse(base).success).toBe(false);
    expect(
      tariffSchema.safeParse({ ...base, method: 'telescopic', slabs: [{ upTo: null, rate: 5 }] })
        .success,
    ).toBe(true);
  });
});

describe('property.json', () => {
  it('has no invented stamp duty while TODO_VERIFY', () => {
    expect(propertyData.stampDutyAndRegistration.value).toBeNull();
    expect(verifiedStampDuty()).toBeNull();
  });
});

describe('changelog.json', () => {
  it('is valid, newest first', () => {
    expect(() => changelogSchema.parse(changelogJson)).not.toThrow();
    expect(() =>
      changelogSchema.parse({
        entries: [
          { date: '2026-01-01', change: 'a' },
          { date: '2026-02-01', change: 'b' },
        ],
      }),
    ).toThrow();
  });
});

describe('Delhi data', () => {
  it('returns verified Delhi prices', () => {
    expect(verifiedFuelPrices('delhi')).toEqual({ petrol: 102.12, cng: 86.98 });
  });

  it('tariff: DERC slabs billed by block, load-band fixed charges, levies and subsidy', () => {
    expect(dlTariff.status).toBe('verified');
    expect(dlTariff.method).toBe('telescopic');
    expect(dlTariff.slabs.map((s) => [s.upTo, s.rate])).toEqual([
      [200, 3],
      [400, 4.5],
      [800, 6.5],
      [1200, 7],
      [null, 8],
    ]);
    const bands = dlTariff.fixedCharges.map((c) => c.loadUpToKW ?? Infinity);
    expect(bands).toEqual([...bands].sort((a, b) => a - b));
    expect(dlTariff.fixedCharges.map((c) => c.amount)).toEqual([20, 50, 100, 200, 250]);
    expect(dlTariff.levies.map((l) => [l.rate, l.on])).toEqual([
      [0.08, 'energyAndFixed'],
      [0.07, 'energyAndFixed'],
      [0.05, 'energyAndEnergyLevies'],
    ]);
    expect(dlTariff.ppac?.status).toBe('TODO_VERIFY');
    expect(dlTariff.subsidy).toMatchObject({
      fullUpToUnits: 200,
      partialUpToUnits: 400,
      partialShare: 0.5,
      partialCapPerMonth: 800,
      optIn: true,
    });
    expect(verifiedTariff(dlTariff)).not.toBeNull();
  });

  it('solar: PM Surya Ghar gives ₹30,000 for 1 kW, ₹60,000 for 2 kW, ₹78,000 from 3 kW', () => {
    const bands = dlSolarData.centralSubsidy!.bands;
    const central = (kW: number) => {
      let total = 0;
      let from = 0;
      for (const b of bands) {
        const to = Math.min(kW, b.upToKW ?? Infinity);
        if (to > from) total += (to - from) * b.perKW;
        from = b.upToKW ?? Infinity;
      }
      return total;
    };
    expect([1, 2, 3, 10].map(central)).toEqual([30_000, 60_000, 78_000, 78_000]);
    expect(dlSolarData.stateCapitalSubsidy).toMatchObject({ perKW: 2000, max: 10_000 });
    expect(dlSolarData.generationPerKWPerDay.value! * 365).toBeCloseTo(1080, 1);
    expect(dlSolarData.exportRatePerKWh.status).toBe('TODO_VERIFY');
  });
});
