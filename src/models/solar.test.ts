import { describe, expect, it } from 'vitest';
import { generationIncentiveFor, solarSubsidyFor, tariffFor } from '@/data';
import { simpleTariff, type Tariff } from '@/engine/tariff';
import { solarFlips, solarPayback, solarScenarios, type SolarInput } from './solar';

/**
 * SYNTHETIC inputs for testing the mechanics only (not market data).
 * 3 kW × 4 kWh/kW/day × 365/12 = 365 kWh a month exactly. Flat ₹7/kWh, no fixed charge.
 * Consumption 400 → import 35 kWh. Saving = 400×7 − 35×7 = ₹2,555 a month.
 * Net cost 1,80,000 − 78,000 = ₹1,02,000 → 1,02,000 ÷ 2,555 = 39.92 → pays back in month 40.
 * 25 years: 2,555 × 300 − 1,02,000 = ₹6,64,500.
 * IRR: −1,02,000 then 300 × 2,555 → 2.50340% a month → 34.5424% a year.
 */
const base: SolarInput = {
  systemKW: 3,
  grossCost: 180_000,
  subsidy: 78_000,
  generationPerKWPerDay: 4,
  degradationPerYear: 0,
  monthlyConsumptionKWh: 400,
  tariff: simpleTariff(7, 0),
  sanctionedLoadKW: 3,
  tariffRisePerYear: 0,
  exportRatePerKWh: 0,
  inverter: null,
  horizonYears: 25,
};

describe('solar: flat-rate fixture', () => {
  const r = solarPayback(base);

  it('generation and monthly saving', () => {
    expect(r.generation[0]).toBeCloseTo(365, 9);
    expect(r.saving[0]).toBeCloseTo(2555, 6);
    expect(r.firstYearSaving).toBeCloseTo(2555 * 12, 4);
    expect(r.netCost).toBe(102_000);
  });

  it('pays back in month 40', () => {
    expect(r.payback?.months).toBe(40);
    expect(r.cumulativeNet[39]).toBeLessThan(0);
    expect(r.cumulativeNet[40]).toBeGreaterThanOrEqual(0);
  });

  it('net after 25 years = ₹6,64,500', () => {
    expect(r.netAtHorizon).toBeCloseTo(664_500, 3);
  });

  it('IRR ≈ 34.54% a year', () => {
    expect(r.irr).toBeCloseTo(0.3454239, 5);
  });
});

describe('solar: export credit and the fixed-charge floor', () => {
  it('exported units earn the export rate; the bill never drops below fixed charges', () => {
    // Consumption 300, generation 365 → 65 kWh exported × ₹3 = ₹195 credit.
    // With ₹100 fixed: without = 2,200; with = max(100 − 195, 100) = 100 → saving ₹2,100.
    const r = solarPayback({
      ...base,
      monthlyConsumptionKWh: 300,
      exportRatePerKWh: 3,
      tariff: simpleTariff(7, 100),
    });
    expect(r.exportedKWh[0]).toBeCloseTo(65, 9);
    expect(r.billWithout[0]).toBe(2200);
    expect(r.billWith[0]).toBe(100);
    expect(r.saving[0]).toBe(2100);
  });
});

describe('solar: savings come off the top slab', () => {
  // Same synthetic slab tariff as the tariff tests: 0–100 @ ₹3, 101–300 @ ₹5, above @ ₹7, 5% duty.
  const slabs: Tariff = {
    ...simpleTariff(0, 0),
    slabs: [
      { upTo: 100, rate: 3 },
      { upTo: 300, rate: 5 },
      { upTo: null, rate: 7 },
    ],
    levies: [{ name: 'duty', rate: 0.05, on: 'energy' }],
  };

  it('100 kWh of solar on 350 kWh use saves 50×5 + 50×7 + 5% = ₹630', () => {
    const r = solarPayback({
      ...base,
      systemKW: 1,
      generationPerKWPerDay: 100 / (365 / 12),
      monthlyConsumptionKWh: 350,
      tariff: slabs,
    });
    expect(r.generation[0]).toBeCloseTo(100, 9);
    expect(r.saving[0]).toBeCloseTo(630, 6);
  });
});

describe('solar: tariff rise, degradation and inverter', () => {
  it('tariff rise steps the saving up in month 13', () => {
    const r = solarPayback({ ...base, tariffRisePerYear: 0.1 });
    expect(r.saving[12]! / r.saving[11]!).toBeCloseTo(1.1, 9);
  });

  it('degradation lowers generation from year 2', () => {
    const r = solarPayback({ ...base, degradationPerYear: 0.01 });
    expect(r.generation[12]).toBeCloseTo(365 * 0.99, 9);
    expect(r.generation[24]).toBeCloseTo(365 * 0.99 * 0.99, 9);
  });

  it('inverter replacement is spent in its year', () => {
    const r = solarPayback({ ...base, inverter: { year: 10, cost: 30_000 } });
    expect(r.cumulativeNet[120]! - r.cumulativeNet[119]!).toBeCloseTo(2555 - 30_000, 6);
    expect(r.netAtHorizon).toBeCloseTo(664_500 - 30_000, 3);
  });

  it('no payback within the horizon gives null', () => {
    const r = solarPayback({ ...base, grossCost: 2_000_000, subsidy: 0 });
    expect(r.payback).toBeNull();
    expect(r.netAtHorizon).toBeLessThan(0);
  });

  it('rejects impossible input', () => {
    expect(() => solarPayback({ ...base, subsidy: 200_000 })).toThrow(RangeError);
    expect(() => solarPayback({ ...base, horizonYears: 0 })).toThrow(RangeError);
  });
});

describe('solar: scenarios and flips', () => {
  it('runs the tariff-rise scenarios', () => {
    const runs = solarScenarios(base, { pessimistic: 0, base: 0.03, optimistic: 0.05 });
    expect(runs.pessimistic.output.netAtHorizon).toBeCloseTo(664_500, 3);
    expect(runs.optimistic.output.netAtHorizon).toBeGreaterThan(runs.base.output.netAtHorizon);
  });

  it('finds the net cost at which solar stops paying off in 25 years: ₹7,66,500', () => {
    // Net = 2,555 × 300 − net cost = 0 → net cost ₹7,66,500.
    const flip = solarFlips(base).find((f) => f.variable === 'netCost');
    expect(flip?.threshold).toBeCloseTo(766_500, 0);
    expect(flip?.signBelow).toBe(1);
  });
});

describe('solar: IRR can be skipped for sweeps', () => {
  it('same net figures, no IRR', () => {
    const full = solarPayback(base);
    const fast = solarPayback(base, { withIrr: false });
    expect(fast.irr).toBeNull();
    expect(fast.netAtHorizon).toBe(full.netAtHorizon);
    expect(fast.payback).toEqual(full.payback);
  });
});

describe('Delhi: the bill subsidy and the generation incentive', () => {
  const dl = tariffFor('DL')!;
  const delhi: SolarInput = {
    systemKW: 3,
    grossCost: 180_000,
    subsidy: solarSubsidyFor('DL', 3)!,
    generationPerKWPerDay: 1080 / 365,
    degradationPerYear: 0,
    monthlyConsumptionKWh: 300,
    tariff: dl,
    sanctionedLoadKW: 3,
    tariffRisePerYear: 0,
    exportRatePerKWh: 0,
    inverter: null,
    horizonYears: 25,
  };

  it('subsidy: 2 × ₹30,000 + ₹18,000 (PM Surya Ghar) + 3 × ₹2,000 (Delhi) = ₹84,000', () => {
    expect(delhi.subsidy).toBe(84_000);
    expect(solarSubsidyFor('DL', 1)).toBe(32_000);
    expect(solarSubsidyFor('DL', 10)).toBe(88_000);
  });

  it('opted in: solar saves only the ₹718.35 still paid at 300 units; pays back in month 134', () => {
    const r = solarPayback(delhi);
    expect(r.generation[0]).toBeCloseTo(270, 9);
    // Without: 1,050 + 150 + 96 + 84 + 56.70 = 1,436.70, half subsidised (under ₹800): 718.35.
    expect(r.billWithout[0]).toBeCloseTo(718.35, 6);
    // With: 30 units imported, fully subsidised.
    expect(r.billWith[0]).toBeCloseTo(0, 9);
    expect(r.saving[0]).toBeCloseTo(718.35, 6);
    expect(r.payback!.months).toBe(134);
    expect(r.netAtHorizon).toBeCloseTo(718.35 * 300 - 96_000, 4);
  });

  it('not opted in: the full bill is saved, ₹1,155.84 a month, payback in month 84', () => {
    const r = solarPayback({ ...delhi, billOptions: { subsidy: false } });
    // 1,436.70 − (90 + 150 + 19.20 + 16.80 + 4.86 = 280.86).
    expect(r.saving[0]).toBeCloseTo(1_155.84, 6);
    expect(r.payback!.months).toBe(84);
  });

  it('a ₹3 a unit incentive for 5 years: ₹810 more a month, payback in month 66', () => {
    expect(generationIncentiveFor('DL', 3)).toBe(3);
    expect(generationIncentiveFor('DL', 5)).toBe(2);
    const r = solarPayback({ ...delhi, generationIncentive: { perKWh: 3, years: 5 } });
    expect(r.incentive[0]).toBeCloseTo(810, 9);
    expect(r.incentive[60]).toBe(0);
    // 60 × 1,528.35 = 91,701; then 718.35 a month: 6 more months to pass 96,000.
    expect(r.payback!.months).toBe(66);
  });
});
