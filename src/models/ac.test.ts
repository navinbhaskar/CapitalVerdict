import { describe, expect, it } from 'vitest';
import { tariffFor } from '@/data';
import { acFlips, acPayback, type AcInput } from './ac';

/** ₹10,000 extra for 300 fewer units a year at ₹8 a unit: ₹2,400 a year, ₹200 a month. */
const simple: AcInput = {
  basicPrice: 30_000,
  efficientPrice: 40_000,
  basicUnits: 1_100,
  efficientUnits: 800,
  usage: 1,
  pricePerUnit: 8,
  tariffRise: 0,
  interestRate: 0,
  years: 10,
};

describe('acPayback: hand-checked', () => {
  it('₹200 a month pays back ₹10,000 in exactly 50 months without interest', () => {
    const r = acPayback(simple);
    expect(r.extraPrice).toBe(10_000);
    expect(r.unitsSavedYearly).toBe(300);
    expect(r.firstYearSaving).toBeCloseTo(2400, 6);
    expect(r.breakevenNoInterest).toEqual({ months: 50, fractionalMonths: 50 });
    // 10 years: 120 × ₹200 − ₹10,000.
    expect(r.netGain).toBeCloseTo(14_000, 6);
  });

  it('at 6% interest it takes 72 months: 1.005^72 × 10,000 = 14,320 ≤ 14,400', () => {
    const r = acPayback({ ...simple, interestRate: 0.06 });
    // Month 71: savings 14,200 against 10,000 × 1.005^71 = 14,249, not yet.
    expect(r.extraWithInterest[71]).toBeCloseTo(14_249.2, 1);
    expect(r.extraWithInterest[72]).toBeCloseTo(14_320.4, 1);
    expect(r.breakevenWithInterest!.months).toBe(72);
  });

  it('at 12% interest the saving never catches up within 10 years', () => {
    const r = acPayback({ ...simple, interestRate: 0.12 });
    expect(r.breakevenWithInterest).toBeNull();
    // 24,000 saved against 10,000 × 1.01^120 = 33,003.87.
    expect(r.netGain).toBeCloseTo(24_000 - 33_003.87, 1);
  });

  it('running it half as much as the label halves the saving', () => {
    const r = acPayback({ ...simple, usage: 0.5 });
    expect(r.firstYearSaving).toBeCloseTo(1200, 6);
    expect(r.breakevenNoInterest!.months).toBe(100);
  });

  it('a 10% yearly tariff rise lifts year two’s saving to ₹2,640', () => {
    const r = acPayback({ ...simple, tariffRise: 0.1 });
    expect(r.cumulativeSaving[24]! - r.cumulativeSaving[12]!).toBeCloseTo(2640, 6);
  });

  it('no extra price: nothing to pay back', () => {
    const r = acPayback({ ...simple, efficientPrice: 30_000 });
    expect(r.breakevenNoInterest).toBeNull();
    expect(r.netGain).toBeCloseTo(24_000, 6);
  });
});

describe('acFlips', () => {
  it('usage where it stops paying: 10,000 ÷ (300 × 8 × 10) = 41.7% of the label', () => {
    const [flip] = acFlips(simple, ['usage']);
    expect(flip!.threshold).toBeCloseTo(10_000 / 24_000, 6);
    expect(flip!.signBelow).toBe(-1);
  });

  it('efficient AC price above which it does not pay: ₹30,000 + ₹24,000', () => {
    const [flip] = acFlips(simple, ['efficientPrice']);
    expect(flip!.threshold).toBeCloseTo(54_000, 2);
    expect(flip!.signBelow).toBe(1);
  });
});

describe('acPayback: input checks', () => {
  it('rejects negatives and part years', () => {
    expect(() => acPayback({ ...simple, usage: -1 })).toThrow(RangeError);
    expect(() => acPayback({ ...simple, years: 2.5 })).toThrow(RangeError);
  });
});

describe('on a real Delhi bill', () => {
  const dl = tariffFor('DL')!;
  const delhi: AcInput = {
    basicPrice: 35_000,
    efficientPrice: 45_000,
    basicUnits: 1_100,
    efficientUnits: 750,
    usage: 1,
    pricePerUnit: 0,
    tariffRise: 0,
    interestRate: 0.09,
    years: 10,
    bill: { tariff: dl, otherUnitsPerMonth: 250, options: { sanctionedLoadKW: 3 } },
  };

  it('opted in: ₹862.45 − ₹752.21 = ₹110.24 a month, about half a flat ₹7 a unit', () => {
    // 341.67 units: 1,237.50 + 150 + 111 + 97.125 + 66.825 = 1,662.45, ₹800 off (cap).
    // 312.50 units: 1,106.25 + 150 + 100.50 + 87.9375 + 59.7375 = 1,504.425, half off.
    const r = acPayback(delhi);
    expect(r.monthlySaving[0]).toBeCloseTo(862.45 - 752.2125, 6);
    expect(r.monthlySaving[0]).toBeCloseTo(110.2375, 6);
  });

  it('not opted in: the gross bills, ₹158.03 a month', () => {
    const r = acPayback({
      ...delhi,
      bill: { ...delhi.bill!, options: { sanctionedLoadKW: 3, subsidy: false } },
    });
    expect(r.monthlySaving[0]).toBeCloseTo(1_662.45 - 1_504.425, 6);
  });

  it('the price per unit does not flip anything on a real bill', () => {
    expect(acFlips(delhi).map((f) => f.variable)).not.toContain('pricePerUnit');
  });
});
