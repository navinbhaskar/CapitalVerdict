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
import { dlTariff, verifiedTariff } from '@/data';

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
      ppac: 0,
      levies: 52.5,
      subsidy: 0,
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

describe('Delhi (DERC tariff, GoNCTD subsidy)', () => {
  const dl = verifiedTariff(dlTariff)!;
  const twoKW = { sanctionedLoadKW: 2 };

  it('309 units on 2 kW: ₹1,358.96 before subsidy, half of it (under ₹800) off', () => {
    // Energy 200 × 3 + 109 × 4.5 = 1,090.50; fixed 2 × 20 = 40; surcharge 8% of 1,130.50 = 90.44;
    // pension 7% of 1,130.50 = 79.135; tax 5% of (1,090.50 + 8% of 1,090.50) = 58.887.
    const b = bill(309, dl, twoKW);
    expect(b.energy).toBeCloseTo(1_090.5, 6);
    expect(b.fixed).toBe(40);
    expect(b.levies).toBeCloseTo(90.44 + 79.135 + 58.887, 6);
    expect(b.energy + b.fixed + b.levies).toBeCloseTo(1_358.962, 6);
    expect(b.subsidy).toBeCloseTo(679.481, 6);
    expect(b.total).toBeCloseTo(679.481, 6);
  });

  it('up to 200 units the whole bill is subsidised', () => {
    const b = bill(150, dl, twoKW);
    // 450 + 40 + 39.20 + 34.30 + 5% of (450 + 36) = 587.80, all of it off.
    expect(b.subsidy).toBeCloseTo(587.8, 6);
    expect(b.total).toBeCloseTo(0, 9);
  });

  it('the 400-unit cliff: ₹1,052 at 400 units, ₹1,859.83 at 401', () => {
    // 400: gross 1,852 (energy 1,500), half is 926 so the ₹800 cap applies.
    expect(bill(400, dl, twoKW).total).toBeCloseTo(1_052, 6);
    expect(bill(401, dl, twoKW).total).toBeCloseTo(1_859.826, 6);
    expect(bill(401, dl, twoKW).subsidy).toBe(0);
  });

  it('fixed charge by load band: the whole load at its band rate', () => {
    expect(bill(0, dl, { sanctionedLoadKW: 2, subsidy: false }).fixed).toBe(40);
    expect(bill(0, dl, { sanctionedLoadKW: 2.5, subsidy: false }).fixed).toBe(125);
    expect(bill(0, dl, { sanctionedLoadKW: 3, subsidy: false }).fixed).toBe(150);
    expect(bill(0, dl, { sanctionedLoadKW: 30, subsidy: false }).fixed).toBe(7_500);
  });

  it('450 units on 3 kW, no subsidy: ₹2,369.80', () => {
    // Energy 600 + 900 + 325 = 1,825; fixed 3 × 50 = 150; surcharge 8% of 1,975 = 158;
    // pension 7% of 1,975 = 138.25; tax 5% of (1,825 + 146) = 98.55.
    expect(bill(450, dl, { sanctionedLoadKW: 3 }).total).toBeCloseTo(2_369.8, 6);
  });

  it('PPAC adds to the bill and to the tax base; not opting in drops the subsidy', () => {
    const b = bill(309, dl, { ...twoKW, ppacRate: 0.2 });
    // PPAC 20% of 1,130.50 = 226.10; tax base gains 20% of 1,090.50, so tax is 69.792.
    expect(b.ppac).toBeCloseTo(226.1, 6);
    expect(b.energy + b.fixed + b.ppac + b.levies).toBeCloseTo(1_595.967, 3);
    expect(bill(309, dl, { ...twoKW, subsidy: false }).total).toBeCloseTo(1_358.962, 6);
  });
});
