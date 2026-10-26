import { describe, expect, it } from 'vitest';
import { tariffFor } from '@/data';
import { solarPayback } from './solar';
import { solarExampleForm, toSolarInput } from './solarForm';
import {
  CAR_ASK_START,
  EV_EXTRA_START,
  HOME_ASK_START,
  SOLAR_ASK_START,
  carAsk,
  homeAsk,
  solarAsk,
} from './heroAsk';

describe('home page sentence card: the starting answers match the tools and the blog posts', () => {
  it('car, Delhi prices: CNG pays back in 27 months, ₹2.82 lakh ahead, answer changes at 790 km', () => {
    // Saving 1,800 × (102.12 ÷ 18 − 86.98 ÷ 26) = ₹4,190.31 a month. The ₹90,000 grows at 0.75% a
    // month: 26 months of saving (1,08,948) fall short of 1,09,297, 27 months (1,13,138) pass 1,10,117.
    // After 120 months: 5,02,837 − 90,000 × 1.0075^120 (2,20,623) = 2,82,215.
    const a = carAsk(CAR_ASK_START)!;
    const saving = 1800 * (102.12 / 18 - 86.98 / 26);
    expect(saving).toBeCloseTo(4_190.31, 2);
    expect(a.verdict).toMatchObject({ kind: 'payback', payer: 'alternative', months: 27 });
    expect(a.dearerNet).toBeCloseTo(saving * 120 - 90_000 * Math.pow(1.0075, 120), 4);
    expect(a.dearerNet / 1e5).toBeCloseTo(2.82, 2);
    expect(Math.round(a.flipKm!.threshold)).toBe(790);
    expect(a.flipKm!.cheaperBelow).toBe('base');
    expect(a.query).toBe('?alt=cng&km=1800&pcp=700000&ccp=790000');
  });

  it('car: an EV uses the car tool’s example prices', () => {
    expect(EV_EXTRA_START).toBe(500_000);
    const a = carAsk({ km: 1800, alt: 'ev', extra: EV_EXTRA_START })!;
    expect(a.extraPrice).toBe(500_000);
    expect(a.query).toBe('?alt=ev&km=1800&pcp=700000&ecp=1200000');
  });

  it('car: low distance means petrol stays cheaper', () => {
    expect(carAsk({ ...CAR_ASK_START, km: 600 })!.verdict.kind).toBe('never');
  });

  it("solar, Delhi: 300 units, 3 kW for ₹1.8 lakh pays back in month 134, as the tool's example", () => {
    // Subsidy ₹84,000, net cost ₹96,000; the subsidised bill falls from ₹718.35 to nil.
    expect(SOLAR_ASK_START).toEqual({ units: 300, kw: 3, cost: 180_000 });
    const a = solarAsk(SOLAR_ASK_START)!;
    expect(a.subsidy).toBe(84_000);
    expect(a.payback!.months).toBe(134);
    const tool = solarPayback(toSolarInput(solarExampleForm('DL'), tariffFor('DL'), 'DL')!);
    expect(a.payback!.months).toBe(tool.payback!.months);
    expect(a.netAtHorizon).toBeCloseTo(tool.netAtHorizon, 6);
  });

  it('home: renting and investing is ₹24.50 lakh ahead after 15 years', () => {
    const a = homeAsk(HOME_ASK_START)!;
    expect(-a.difference / 1e5).toBeCloseTo(24.5, 2);
    expect(a.horizonYears).toBe(15);
  });
});
