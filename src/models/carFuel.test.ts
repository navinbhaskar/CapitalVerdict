import { describe, expect, it } from 'vitest';
import { formatINR, formatLakhCrore } from '@/lib/format';
import {
  carFuelFlips,
  carFuelVerdict,
  compareCarFuel,
  compareCarSet,
  type CarFuelInput,
} from './carFuel';
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

describe('car fuel: on-road prices and total cost of ownership', () => {
  // Test prices only (not market data): petrol ₹7,00,000, CNG ₹7,90,000 → the fixture's ₹90,000 gap.
  // Hand check at 10 years: growth 1.0075^120 = 2.451357078
  //   petrol: 7,00,000 × 2.451357 + 10,186 × 120  = ₹29,38,269.95
  //   CNG:    7,90,000 × 2.451357 + 6,628.85 × 120 = ₹27,32,033.63
  //   difference ₹2,06,236.32 = the with-interest net position.
  const withPrices: CarFuelInput = {
    ...fixture,
    purchasePrices: { base: 700_000, alternative: 790_000 },
  };
  const r = compareCarFuel(withPrices);

  it('totals each car', () => {
    expect(r.totalCost!.base[120]).toBeCloseTo(2_938_269.95, 1);
    expect(r.totalCost!.alternative[120]).toBeCloseTo(2_732_033.63, 1);
    expect(r.totalCost!.base[0]).toBe(700_000);
  });

  it('difference of totals equals the net position every month', () => {
    for (const m of [0, 1, 33, 60, 120]) {
      const net = r.cumulativeSaving[m]! - r.extraPriceWithInterest[m]!;
      expect(r.totalCost!.base[m]! - r.totalCost!.alternative[m]!).toBeCloseTo(net, 6);
    }
  });

  it('is null without purchase prices', () => {
    expect(compareCarFuel(fixture).totalCost).toBeNull();
  });

  it('rejects prices that disagree with extraPrice', () => {
    expect(() =>
      compareCarFuel({ ...fixture, purchasePrices: { base: 700_000, alternative: 800_000 } }),
    ).toThrow(RangeError);
  });
});

describe('car fuel verdict, whichever car costs more to buy', () => {
  it('CNG dearer and cheaper to run: CNG pays back (spec fixture, 33 months)', () => {
    const v = carFuelVerdict(fixture);
    expect(v.verdict).toEqual({ kind: 'payback', payer: 'alternative', months: 33, km: 59_400 });
    expect(v.swapped).toBe(false);
  });

  it('CNG dearer but never earns it back: petrol wins', () => {
    const v = carFuelVerdict({ ...fixture, monthlyKm: 300 });
    expect(v.verdict).toEqual({ kind: 'never', winner: 'base' });
  });

  it('CNG cheaper to buy and to run: CNG wins from day one', () => {
    const v = carFuelVerdict({ ...fixture, extraPrice: -20_000 });
    expect(v.verdict).toEqual({ kind: 'dominant', winner: 'alternative' });
    expect(v.swapped).toBe(true);
  });

  it('petrol dearer but cheaper to run: petrol pays back', () => {
    // Petrol at 40 km/L costs ₹2.55/km against CNG ₹3.68/km: ₹2,045.15 a month less.
    // ₹20,000 gap at 9%: month 10 → 20,451 < 20,000 × 1.0075^10 = 21,552; month 11 → 22,497 ≥ 21,713.
    const input = { ...fixture, extraPrice: -20_000, base: { ...fixture.base, mileage: 40 } };
    const v = carFuelVerdict(input);
    expect(v.verdict).toMatchObject({ kind: 'payback', payer: 'base', months: 11 });
  });

  it('same price: the cheaper-to-run car wins outright', () => {
    expect(carFuelVerdict({ ...fixture, extraPrice: 0 }).verdict).toEqual({
      kind: 'dominant',
      winner: 'alternative',
    });
  });

  it('same price and same running cost: tie', () => {
    const same = { ...fixture, extraPrice: 0, alternative: fixture.base };
    expect(carFuelVerdict(same).verdict).toEqual({ kind: 'tie' });
  });
});

describe('car fuel: one-off costs and resale', () => {
  it('a one-off cost lands in its month and delays break-even (33 → 37 months)', () => {
    // ₹12,000 for the CNG car in month 13 (say, a cylinder). Hand check, saving ₹3,557.15/month:
    //   month 36: 3,557.15 × 36 − 12,000 = 116,057 < 90,000 × 1.0075^36 = 117,778
    //   month 37: 3,557.15 × 37 − 12,000 = 119,615 ≥ 90,000 × 1.0075^37 = 118,661   ⇒ 37 months
    const plain = compareCarFuel(fixture);
    const r = compareCarFuel({
      ...fixture,
      alternative: { ...fixture.alternative, oneOff: { month: 13, amount: 12_000 } },
    });
    expect(r.cumulativeSaving[12]).toBeCloseTo(plain.cumulativeSaving[12]!, 9);
    expect(r.cumulativeSaving[13]).toBeCloseTo(plain.cumulativeSaving[13]! - 12_000, 9);
    expect(r.breakevenWithInterest?.months).toBe(37);
  });

  it('resale changes the position at the horizon only, not the break-even month', () => {
    const plain = compareCarFuel(fixture);
    const r = compareCarFuel({ ...fixture, resale: { base: 200_000, alternative: 230_000 } });
    expect(r.resaleGap).toBe(30_000);
    expect(r.breakevenWithInterest?.months).toBe(33);
    expect(r.netAt5Years!.withInterest).toBeCloseTo(plain.netAt5Years!.withInterest, 9);
    expect(r.netAtHorizon.withInterest).toBeCloseTo(plain.netAtHorizon.withInterest + 30_000, 9);
  });

  it('resale can carry a car that never pays back on fuel alone', () => {
    // 300 km a month: saving ₹592.86/month, 120 months → 71,143; extra with interest 220,622.
    // Net −149,479 without resale; a ₹2 lakh higher resale for the CNG car makes it +50,521.
    const input = { ...fixture, monthlyKm: 300, resale: { base: 100_000, alternative: 300_000 } };
    const r = compareCarFuel(input);
    expect(r.netAtHorizon.withInterest).toBeGreaterThan(50_500);
    expect(r.netAtHorizon.withInterest).toBeLessThan(50_540);
    expect(carFuelVerdict(input).verdict).toEqual({ kind: 'resale', winner: 'alternative' });
  });

  it('rejects a bad one-off or negative resale', () => {
    const bad = { ...fixture.alternative, oneOff: { month: 0, amount: 1 } };
    expect(() => compareCarFuel({ ...fixture, alternative: bad })).toThrow(RangeError);
    expect(() => compareCarFuel({ ...fixture, resale: { base: -1, alternative: 0 } })).toThrow(
      RangeError,
    );
  });
});

describe('car set: petrol vs CNG vs EV', () => {
  // SYNTHETIC: 1,000 km a month for 12 months, no interest.
  // Petrol ₹10 lakh, 10 km/L at ₹100 → ₹10,000/month → total 10,00,000 + 1,20,000 = ₹11,20,000
  // CNG    ₹11 lakh, 20 km/kg at ₹80 → ₹4,000/month  → total 11,00,000 + 48,000   = ₹11,48,000
  // EV     ₹15 lakh, 5 km/kWh at ₹10 → ₹2,000/month  → total 15,00,000 + 24,000   = ₹15,24,000
  const petrol = { mileage: 10, energyPrice: 100, annualPriceRise: 0, annualUpkeep: 0 };
  const pair = (
    alternative: CarFuelInput['base'],
    price: number,
    rate = 0,
    resale?: CarFuelInput['resale'],
  ): CarFuelInput => ({
    monthlyKm: 1000,
    horizonMonths: 12,
    base: petrol,
    alternative,
    extraPrice: price - 1_000_000,
    purchasePrices: { base: 1_000_000, alternative: price },
    interestRate: rate,
    resale,
  });
  const cng = { mileage: 20, energyPrice: 80, annualPriceRise: 0, annualUpkeep: 0 };
  const ev = { mileage: 5, energyPrice: 10, annualPriceRise: 0, annualUpkeep: 0 };

  it('total cost of each car and the ranking', () => {
    const r = compareCarSet('petrol', { cng: pair(cng, 1_100_000), ev: pair(ev, 1_500_000) });
    expect(r.entries.map((e) => [e.key, e.netCost])).toEqual([
      ['petrol', 1_120_000],
      ['cng', 1_148_000],
      ['ev', 1_524_000],
    ]);
    expect(r.entries.map((e) => e.firstMonthRunning)).toEqual([10_000, 4_000, 2_000]);
    expect(r.ranking).toEqual(['petrol', 'cng', 'ev']);
    expect(r.pairs.cng!.verdict.kind).toBe('never');
  });

  it('resale moves the EV to first: 15,24,000 − 6,00,000 = ₹9,24,000', () => {
    const r = compareCarSet('petrol', {
      cng: pair(cng, 1_100_000, 0, { base: 0, alternative: 0 }),
      ev: pair(ev, 1_500_000, 0, { base: 0, alternative: 600_000 }),
    });
    expect(r.entries[2]!.netCost).toBe(924_000);
    expect(r.ranking).toEqual(['ev', 'petrol', 'cng']);
  });

  it('interest on each on-road price: 10 lakh × (1.01^12 − 1) = ₹1,26,825.03 at 12%', () => {
    const r = compareCarSet('petrol', {
      cng: pair(cng, 1_100_000, 0.12),
      ev: pair(ev, 1_500_000, 0.12),
    });
    expect(r.entries[0]!.interest).toBeCloseTo(126_825.03, 2);
    expect(r.entries[0]!.netCost).toBeCloseTo(1_000_000 + 126_825.03 + 120_000, 2);
  });

  it('refuses inputs that do not share the base car', () => {
    expect(() =>
      compareCarSet('petrol', {
        cng: pair(cng, 1_100_000),
        ev: { ...pair(ev, 1_500_000), monthlyKm: 5 },
      }),
    ).toThrow(RangeError);
  });
});
