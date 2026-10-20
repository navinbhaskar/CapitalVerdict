import { describe, expect, it } from 'vitest';
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
  it('car: CNG pays back in 46 months, ₹1.13 lakh ahead, answer changes at 1,191 km', () => {
    const a = carAsk(CAR_ASK_START)!;
    expect(a.verdict).toMatchObject({ kind: 'payback', payer: 'alternative', months: 46 });
    expect(a.dearerNet / 1e5).toBeCloseTo(1.13, 2);
    expect(Math.round(a.flipKm!.threshold)).toBe(1191);
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

  it('solar: ₹2,100 a month, 3 kW for ₹1.8 lakh pays back in month 86, ₹4.5 lakh ahead', () => {
    expect(SOLAR_ASK_START).toEqual({ bill: 2100, kw: 3, cost: 180_000 });
    const a = solarAsk(SOLAR_ASK_START)!;
    expect(a.payback!.months).toBe(86);
    expect(a.netAtHorizon).toBeCloseTo(450_000, 0);
  });

  it('home: renting and investing is ₹24.50 lakh ahead after 15 years', () => {
    const a = homeAsk(HOME_ASK_START)!;
    expect(-a.difference / 1e5).toBeCloseTo(24.5, 2);
    expect(a.horizonYears).toBe(15);
  });
});
