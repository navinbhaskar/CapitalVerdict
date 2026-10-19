import { describe, expect, it } from 'vitest';
import { formatINR, formatLakhCrore } from '@/lib/format';
import { carFuelFlips, compareCarFuel, type CarFuelInput } from './carFuel';
import { carFuelExample } from './carFuel.example';

/**
 * Reference fixture from the project spec (must match):
 * petrol ₹101.86/L @ 18 km/L, CNG ₹95.75/kg @ 26 km/kg, 1,800 km/month,
 * extra price ₹90,000, 9% p.a. → monthly saving ≈ ₹3,557; break-even ≈ 25.3 months (no interest),
 * 33 months / 59,400 km (with interest); net after 10 years ≈ ₹2.06 lakh.
 *
 * The fixture only reproduces with 0% yearly price rise and ₹0 extra upkeep, so those are pinned here.
 *
 * Hand check:
 *   petrol ₹/km = 101.86 / 18 = 5.658889;  CNG ₹/km = 95.75 / 26 = 3.682692
 *   saving/month = (5.658889 − 3.682692) × 1,800 = ₹3,557.15
 *   no interest:   90,000 / 3,557.15 = 25.30 months
 *   with interest: month 32 → 113,829 < 90,000 × 1.0075^32 = 114,316
 *                  month 33 → 117,386 ≥ 90,000 × 1.0075^33 = 115,174   ⇒ 33 months, 59,400 km
 *   10 years:      3,557.15 × 120 − 90,000 × 1.0075^120 = 426,858 − 220,622 = ₹2,06,236
 */
const fixture: CarFuelInput = carFuelExample;

describe('car fuel: spec fixture (petrol vs CNG)', () => {
  const result = compareCarFuel(fixture);

  it('cost per km', () => {
    expect(result.costPerKm.base).toBeCloseTo(5.658889, 6);
    expect(result.costPerKm.alternative).toBeCloseTo(3.682692, 6);
  });

  it('monthly saving ≈ ₹3,557', () => {
    expect(result.firstMonthSaving).toBeCloseTo(3557.15, 1);
    expect(formatINR(result.firstMonthSaving)).toBe('₹3,557');
  });

  it('break-even without interest ≈ 25.3 months', () => {
    expect(result.breakevenNoInterest?.fractionalMonths).toBeCloseTo(25.3, 2);
    expect(result.breakevenNoInterest?.months).toBe(26);
  });

  it('break-even with interest = 33 months / 59,400 km', () => {
    expect(result.breakevenWithInterest?.months).toBe(33);
    expect(result.breakevenWithInterest?.km).toBe(59_400);
    expect(result.breakevenWithInterest?.years).toBeCloseTo(2.75, 10);
  });

  it('net after 10 years ≈ ₹2.06 lakh (with interest)', () => {
    expect(result.netAt10Years!.withInterest).toBeCloseTo(206_236, -1);
    expect(formatLakhCrore(result.netAt10Years!.withInterest)).toBe('₹2.06 lakh');
    expect(result.netAtHorizon).toEqual(result.netAt10Years);
  });

  it('net after 10 years without interest = ₹3,36,858', () => {
    expect(result.netAt10Years!.noInterest).toBeCloseTo(336_858, -1);
  });

  it('net after 5 years with interest = ₹72,518', () => {
    expect(result.netAt5Years!.withInterest).toBeCloseTo(72_517.94, 0);
  });

  it('series are the right length', () => {
    expect(result.monthlyCost.base).toHaveLength(120);
    expect(result.cumulativeSaving).toHaveLength(121);
    expect(result.cumulativeSaving[0]).toBe(0);
    expect(result.extraPriceWithInterest[0]).toBe(90_000);
  });
});

describe('car fuel: what flips the answer (spec fixture)', () => {
  // Net(10y, with interest) = 0 where saving/km × km × 120 = 90,000 × 1.0075^120 = 220,622.14.
  const flips = Object.fromEntries(carFuelFlips(fixture).map((f) => [f.variable, f]));

  it('petrol wins below ≈930 km/month', () => {
    expect(flips.monthlyKm!.threshold).toBeCloseTo(930.331, 2);
    expect(flips.monthlyKm!.signBelow).toBe(-1);
  });

  it('CNG stops paying off above ≈₹120.57/kg', () => {
    expect(flips.alternativeEnergyPrice!.threshold).toBeCloseTo(120.5747, 3);
    expect(flips.alternativeEnergyPrice!.signBelow).toBe(1);
  });

  it('CNG stops paying off below ≈20.65 km/kg', () => {
    expect(flips.alternativeMileage!.threshold).toBeCloseTo(20.6469, 3);
    expect(flips.alternativeMileage!.signBelow).toBe(-1);
  });

  it('CNG stops paying off if petrol drops below ≈₹84.67/L', () => {
    expect(flips.baseEnergyPrice!.threshold).toBeCloseTo(84.6736, 3);
    expect(flips.baseEnergyPrice!.signBelow).toBe(-1);
  });
});

describe('car fuel: escalation and upkeep', () => {
  // Base ₹100/L @ 10 km/L rising 10% a year; alternative ₹50 @ 10 km/L flat; 1,000 km/month.
  // Year 1: 10,000 vs 5,000 → 5,000/month. Year 2: 11,000 vs 5,000 → 6,000/month.
  const input: CarFuelInput = {
    monthlyKm: 1000,
    horizonMonths: 24,
    base: { mileage: 10, energyPrice: 100, annualPriceRise: 0.1, annualUpkeep: 0 },
    alternative: { mileage: 10, energyPrice: 50, annualPriceRise: 0, annualUpkeep: 0 },
    extraPrice: 0,
    interestRate: 0,
  };

  it('prices step up in month 13', () => {
    const r = compareCarFuel(input);
    expect(r.monthlyCost.base[11]).toBeCloseTo(10_000, 8);
    expect(r.monthlyCost.base[12]).toBeCloseTo(11_000, 8);
    expect(r.cumulativeSaving[24]).toBeCloseTo(132_000, 6);
  });

  it('upkeep adds upkeep / 12 to the monthly cost', () => {
    const r = compareCarFuel({
      ...input,
      alternative: { ...input.alternative, annualUpkeep: 6000 },
    });
    expect(r.monthlyCost.alternative[0]).toBeCloseTo(5_500, 8);
    expect(r.firstMonthSaving).toBeCloseTo(4_500, 8);
  });
});

describe('car fuel: edge cases', () => {
  it('no break-even when the alternative costs more to run', () => {
    const r = compareCarFuel({
      ...fixture,
      alternative: { ...fixture.alternative, energyPrice: 200 },
    });
    expect(r.breakevenNoInterest).toBeNull();
    expect(r.breakevenWithInterest).toBeNull();
    expect(r.netAtHorizon.withInterest).toBeLessThan(0);
  });

  it('break-even at month 0 when there is no extra price', () => {
    const r = compareCarFuel({ ...fixture, extraPrice: 0 });
    expect(r.breakevenWithInterest?.months).toBe(0);
  });

  it('5- and 10-year positions are null when the horizon is shorter', () => {
    const r = compareCarFuel({ ...fixture, horizonMonths: 36 });
    expect(r.netAt5Years).toBeNull();
    expect(r.netAt10Years).toBeNull();
  });

  it('zero km means no saving and no break-even', () => {
    const r = compareCarFuel({ ...fixture, monthlyKm: 0 });
    expect(r.firstMonthSaving).toBe(0);
    expect(r.breakevenNoInterest).toBeNull();
  });

  it('rejects invalid input', () => {
    expect(() => compareCarFuel({ ...fixture, horizonMonths: 0 })).toThrow(RangeError);
    expect(() => compareCarFuel({ ...fixture, horizonMonths: 12.5 })).toThrow(RangeError);
    expect(() => compareCarFuel({ ...fixture, monthlyKm: -1 })).toThrow(RangeError);
    expect(() => compareCarFuel({ ...fixture, base: { ...fixture.base, mileage: 0 } })).toThrow(
      RangeError,
    );
  });
});

describe('car fuel: matches the CNG_vs_Petrol_Lucknow.xlsx workbook cell by cell', () => {
  // Values copied from the workbook's Monthly sheet (Excel's own calculation), same inputs.
  const r = compareCarFuel({ ...carFuelExample, horizonMonths: 240 });
  const net = (m: number) => r.cumulativeSaving[m]! - r.extraPriceWithInterest[m]!;
  const rows = [
    { month: 1, H: 3557.15384615385, I: 90675, J: -86442.8461538462, K: -87117.8461538462 },
    { month: 2, H: 7114.30769230769, I: 91355.0625, J: -82885.6923076923, K: -84240.7548076923 },
    {
      month: 3,
      H: 10671.4615384615,
      I: 92040.22546875,
      J: -79328.5384615385,
      K: -81368.7639302885,
    },
    {
      month: 60,
      H: 213429.230769231,
      I: 140911.292424741,
      J: 123429.230769231,
      K: 72517.9383444893,
    },
    {
      month: 120,
      H: 426858.461538463,
      I: 220622.137031233,
      J: 336858.461538463,
      K: 206236.32450723,
    },
    {
      month: 240,
      H: 853716.923076927,
      I: 540823.637202535,
      J: 763716.923076927,
      K: 312893.285874392,
    },
  ];

  it.each(rows)('month $month', ({ month, H, I, J, K }) => {
    expect(r.cumulativeSaving[month]).toBeCloseTo(H, 6);
    expect(r.extraPriceWithInterest[month]).toBeCloseTo(I, 6);
    expect(r.cumulativeSaving[month]! - 90_000).toBeCloseTo(J, 6);
    expect(net(month)).toBeCloseTo(K, 6);
  });

  it('monthly costs and prices (row 5)', () => {
    expect(r.monthlyCost.base[0]).toBeCloseTo(10186, 8);
    expect(r.monthlyCost.alternative[0]).toBeCloseTo(6628.84615384615, 8);
    expect(r.monthlyPrice.base[0]).toBe(101.86);
    expect(r.monthlyPrice.alternative[239]).toBe(95.75);
  });

  it('Result 1 and Result 2 cells', () => {
    expect(r.breakevenNoInterest!.fractionalMonths).toBeCloseTo(25.3011266570075, 9);
    expect(r.breakevenWithInterest!.months).toBe(33);
    expect(r.breakevenWithInterest!.km).toBe(59400);
  });
});
