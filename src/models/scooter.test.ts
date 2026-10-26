import { describe, expect, it } from 'vitest';
import { tariffFor } from '@/data';
import { compareScooters, type ScooterInput } from './scooter';

const DL = tariffFor('DL')!;

/** 750 km a month; petrol at 45 km/L and ₹102.12; e-scooter at 30 km a unit: 25 units a month. */
const BASE: ScooterInput = {
  monthlyKm: 750,
  years: 7,
  petrol: { price: 95_000, mileage: 45, fuelPrice: 102.12, upkeep: 0 },
  ev: { price: 130_000, kmPerUnit: 30, upkeep: 0 },
  electricity: { kind: 'flat', pricePerUnit: 8 },
  refunds: { state: 30_000, scrapping: 0 },
  petrolPriceRise: 0,
  tariffRise: 0,
  interestRate: 0.09,
};
const onBill = (otherUnitsPerMonth: number): ScooterInput => ({
  ...BASE,
  electricity: {
    kind: 'bill',
    tariff: DL,
    otherUnitsPerMonth,
    options: { sanctionedLoadKW: 3, subsidy: true },
  },
});

describe('running costs', () => {
  it('petrol: 750 ÷ 45 × ₹102.12 = ₹1,702 a month', () => {
    expect(compareScooters(BASE).petrolPerMonth).toBeCloseTo(1_702, 6);
  });

  it('a flat ₹8 a unit: 25 units cost ₹200 a month', () => {
    const r = compareScooters(BASE);
    expect(r.unitsPerMonth).toBeCloseTo(25, 10);
    expect(r.chargingPerMonth).toBeCloseTo(200, 8);
    expect(r.costPerUnit).toBeCloseTo(8, 10);
  });

  it('Delhi, 250 other units, subsidy on: the bill goes from ₹582.90 to ₹650.63, ₹2.71 a unit', () => {
    // 3 kW load: fixed ₹50 × 3 = ₹150. At 250 units, energy 200 × 3 + 50 × 4.5 = ₹825;
    // 8% and 7% surcharges on energy + fixed: ₹78 and ₹68.25; 5% tax on 825 + 8% of 825: ₹44.55.
    // Gross ₹1,165.80, half off (under the ₹800 cap): ₹582.90.
    // At 275 units, energy ₹937.50: surcharges ₹87 and ₹76.125, tax ₹50.625, gross ₹1,301.25,
    // half off: ₹650.625. The scooter's 25 units add ₹67.725, ₹2.709 a unit.
    const r = compareScooters(onBill(250));
    expect(r.billWithout!).toBeCloseTo(582.9, 6);
    expect(r.billWith!).toBeCloseTo(650.625, 6);
    expect(r.chargingPerMonth).toBeCloseTo(67.725, 6);
    expect(r.costPerUnit).toBeCloseTo(2.709, 6);
  });

  it('Delhi, 190 other units: crossing 200 loses the full subsidy, ₹19.52 a unit', () => {
    // At 190 units the whole bill is subsidised: ₹0. At 215 units, energy 600 + 15 × 4.5 =
    // ₹667.50; surcharges ₹65.40 and ₹57.225; tax 5% of 667.50 + 53.40 = ₹36.045;
    // gross ₹976.17, half off: ₹488.085, all of it caused by the scooter's 25 units.
    const r = compareScooters(onBill(190));
    expect(r.billWithout!).toBeCloseTo(0, 8);
    expect(r.chargingPerMonth).toBeCloseTo(488.085, 6);
    expect(r.costPerUnit).toBeCloseTo(19.5234, 4);
  });
});

describe('the comparison', () => {
  it("Delhi's ₹30,000 comes off: ₹1,30,000 − ₹30,000 − ₹95,000 = ₹5,000 extra", () => {
    const r = compareScooters(onBill(250));
    expect(r.evNetPrice).toBe(100_000);
    expect(r.extraPrice).toBe(5_000);
  });

  it('pays back in month 4 without interest: ₹1,634.28 saved a month', () => {
    // 1,702 − 67.725 = 1,634.275 a month; 3 months 4,902.8 < 5,000 ≤ 4 months 6,537.1.
    const r = compareScooters(onBill(250));
    expect(r.comparison.firstMonthSaving).toBeCloseTo(1_634.275, 6);
    expect(r.comparison.breakevenNoInterest!.months).toBe(4);
  });

  it('a scrapping bonus that makes the e-scooter cheaper to buy means a negative extra price', () => {
    const r = compareScooters({ ...onBill(250), refunds: { state: 30_000, scrapping: 10_000 } });
    expect(r.extraPrice).toBe(-5_000);
  });

  it('a battery replacement lands in the first month of its year', () => {
    const r = compareScooters({ ...BASE, ev: { ...BASE.ev, battery: { cost: 40_000, year: 5 } } });
    expect(r.input.alternative.oneOff).toEqual({ month: 49, amount: 40_000 });
    const later = compareScooters({
      ...BASE,
      ev: { ...BASE.ev, battery: { cost: 40_000, year: 9 } },
    });
    expect(later.input.alternative.oneOff).toBeUndefined();
  });
});
