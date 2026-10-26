import { describe, expect, it } from 'vitest';
import { tariffFor, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { compareScooters } from './scooter';
import {
  invalidScooterFields,
  scooterExampleForm,
  scooterIncentives,
  scooterShareSchema,
  toScooterInput,
} from './scooterForm';

const DL = tariffFor('DL')!;
const TODAY = '2026-10-26';
const form = scooterExampleForm(verifiedFuelPrices('delhi')!.petrol);

describe('scooter form', () => {
  it('the example in Delhi: ₹30,000 back from Delhi, ₹5,000 already off the price', () => {
    // 3 kWh × ₹10,000 = 30,000 (the year-one cap); 3 kWh × ₹2,500 = 7,500, capped at 5,000.
    expect(scooterIncentives(form, 'DL', TODAY)).toMatchObject({
      central: 5_000,
      statePossible: 30_000,
      state: 30_000,
      scrapping: 0,
    });
    const input = toScooterInput(form, DL, 'DL', TODAY)!;
    expect(input.refunds).toEqual({ state: 30_000, scrapping: 0 });
    expect(input.petrol.fuelPrice).toBe(102.12);
  });

  it('the example pays back within a few months and is well ahead after 7 years', () => {
    const r = compareScooters(toScooterInput(form, DL, 'DL', TODAY)!);
    // ₹1,30,000 − ₹30,000 − ₹95,000 = ₹5,000 extra; about ₹1,700 of petrol against ₹68 of power.
    expect(r.extraPrice).toBe(5_000);
    expect(r.comparison.breakevenWithInterest!.months).toBeLessThanOrEqual(4);
    expect(r.comparison.netAtHorizon.withInterest).toBeGreaterThan(100_000);
  });

  it('unticking the incentive or adding the scrapping bonus changes the refunds', () => {
    expect(scooterIncentives({ ...form, claimState: false }, 'DL', TODAY).state).toBe(0);
    expect(scooterIncentives({ ...form, scrapping: true }, 'DL', TODAY).scrapping).toBe(10_000);
    expect(scooterIncentives(form, 'UP', TODAY).state).toBe(0);
  });

  it('without a tariff it needs a price per unit; a battery cost needs its year', () => {
    expect(invalidScooterFields(form, false)).toEqual(['pricePerUnit']);
    expect(invalidScooterFields({ ...form, batteryCost: 40_000 }, true)).toEqual(['batteryYear']);
    expect(invalidScooterFields({ ...form, years: 7.5 }, true)).toEqual(['years']);
    expect(toScooterInput(form, null, 'UP', TODAY)).toBeNull();
  });

  it('round-trips through a share link', () => {
    const f = { ...form, batteryCost: 40_000, batteryYear: 6, scrapping: true };
    const filled = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null));
    expect(decodeShare(`?${encodeShare(f, scooterShareSchema)}`, scooterShareSchema)).toMatchObject(
      filled,
    );
  });
});
