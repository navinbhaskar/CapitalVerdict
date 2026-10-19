import { describe, expect, it } from 'vitest';
import {
  bill,
  energyCharge,
  incrementalCost,
  marginalRatePerKWh,
  savingFromReduction,
  simpleTariff,
  validateTariff,
  type Tariff,
} from './tariff';

// SYNTHETIC tariff for testing the mechanics only. NOT any state's real tariff.
// 0–100 kWh @ ₹3, 101–300 @ ₹5, above 300 @ ₹7; ₹50 per kW fixed; 5% duty on energy.
const synthetic: Tariff = {
  state: 'TEST',
  category: 'domestic',
  method: 'telescopic',
  slabs: [
    { upTo: 100, rate: 3 },
    { upTo: 300, rate: 5 },
    { upTo: null, rate: 7 },
  ],
  fixedCharges: [{ basis: 'perKW', amount: 50 }],
  levies: [{ name: 'duty', rate: 0.05, on: 'energy' }],
  source: 'synthetic test fixture',
  effectiveDate: '2000-01-01',
  status: 'TODO_VERIFY',
};
const load = { sanctionedLoadKW: 2 };

describe('energyCharge (telescopic)', () => {
  it('250 kWh: 100×3 + 150×5 = ₹1,050', () => {
    expect(energyCharge(250, synthetic)).toBe(1050);
  });

  it('on a slab bound: 300 kWh = ₹1,300', () => {
    expect(energyCharge(300, synthetic)).toBe(1300);
  });

  it('into the top slab: 350 kWh = ₹1,650', () => {
    expect(energyCharge(350, synthetic)).toBe(1650);
  });

  it('zero units', () => {
    expect(energyCharge(0, synthetic)).toBe(0);
  });
});

describe('energyCharge (whole units at slab rate)', () => {
  const whole: Tariff = { ...synthetic, method: 'wholeUnitsAtSlabRate' };

  it('250 kWh all at ₹5 = ₹1,250', () => {
    expect(energyCharge(250, whole)).toBe(1250);
  });

  it('one unit past a bound reprices everything: 301 kWh × ₹7 = ₹2,107', () => {
    expect(energyCharge(300, whole)).toBe(1500);
    expect(energyCharge(301, whole)).toBe(2107);
  });
});

describe('bill', () => {
  it('250 kWh on 2 kW: energy 1,050 + fixed 100 + duty 52.50 = ₹1,202.50', () => {
    expect(bill(250, synthetic, load)).toEqual({
      energy: 1050,
      fixed: 100,
      levies: 52.5,
      total: 1202.5,
    });
  });

  it('fixed charge still applies at zero units', () => {
    expect(bill(0, synthetic, load).total).toBe(100);
  });

  it('levy on energy and fixed: 5% of 1,150 = ₹57.50', () => {
    const t: Tariff = {
      ...synthetic,
      levies: [{ name: 'duty', rate: 0.05, on: 'energyAndFixed' }],
    };
    expect(bill(250, t, load).levies).toBeCloseTo(57.5, 10);
  });

  it('per-connection fixed charge ignores load', () => {
    const t: Tariff = { ...synthetic, fixedCharges: [{ basis: 'perConnection', amount: 80 }] };
    expect(bill(0, t, { sanctionedLoadKW: 5 }).fixed).toBe(80);
  });
});

describe('incremental and saved units come off the top slab', () => {
  it('adding 100 kWh to 250: 50×5 + 50×7 = 600, +5% duty = ₹630', () => {
    expect(incrementalCost(250, 100, synthetic, load)).toBeCloseTo(630, 10);
    expect(marginalRatePerKWh(250, 100, synthetic, load)).toBeCloseTo(6.3, 10);
  });

  it('removing 100 kWh from 350 saves the same ₹630', () => {
    expect(savingFromReduction(350, 100, synthetic, load)).toBeCloseTo(630, 10);
  });

  it('saving is capped at the energy part when generation exceeds consumption', () => {
    // 50 kWh → 0: saves 50×3 = 150 + 7.50 duty. Fixed charge remains.
    expect(savingFromReduction(50, 500, synthetic, load)).toBeCloseTo(157.5, 10);
  });

  it('rejects non-positive extra units for a per-kWh rate', () => {
    expect(() => marginalRatePerKWh(250, 0, synthetic)).toThrow(RangeError);
  });
});

describe('validateTariff', () => {
  it('rejects bad slabs', () => {
    expect(() => validateTariff({ ...synthetic, slabs: [] })).toThrow();
    expect(() => validateTariff({ ...synthetic, slabs: [{ upTo: 100, rate: 3 }] })).toThrow(
      'open-ended',
    );
  });
});

describe('simpleTariff', () => {
  it('charges every unit at one rate plus a flat fixed charge', () => {
    const t = simpleTariff(7, 120);
    expect(bill(400, t).total).toBe(400 * 7 + 120);
    expect(bill(0, t).total).toBe(120);
    expect(savingFromReduction(400, 100, t)).toBe(700);
  });

  it('omits a zero fixed charge', () => {
    expect(simpleTariff(6.5, 0).fixedCharges).toEqual([]);
  });
});
