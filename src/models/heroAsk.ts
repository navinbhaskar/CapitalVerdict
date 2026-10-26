/**
 * The home page's "ask in one sentence" card: a few blanks per decision, everything else from the
 * same example forms the tools open with, so the card and the tools always agree.
 * Car prices use the verified city (Lucknow); the rest are the tools' labelled examples.
 */
import { verifiedFuelPrices, verifiedTariff } from '@/data';
import { carFuelFlips, carFuelVerdict, type CarFuelVerdict } from './carFuel';
import { CAR_FUEL_START_FORM, altCarPriceField, toCarFuelInput, type AltKind } from './carFuelForm';
import { EXAMPLE_PRICE_CITY } from './carFuel.example';
import { rentVsBuy } from './rentBuy';
import { RENT_BUY_EXAMPLE_FORM, toRentBuyInput } from './rentBuyForm';
import { solarPayback } from './solar';
import { SOLAR_EXAMPLE_FORM, toSolarInput } from './solarForm';

export const HERO_PRICE_CITY = EXAMPLE_PRICE_CITY;
/** Petrol car price behind the "costs ₹X more" blank (an example, as in the car tool). */
const PETROL_CAR_PRICE = CAR_FUEL_START_FORM.petrolCarPrice!;

export interface CarAsk {
  km: number;
  alt: AltKind;
  /** How much more the CNG car or EV costs than the petrol car, ₹. */
  extra: number;
}
export const CAR_ASK_START: CarAsk = { km: 1800, alt: 'cng', extra: 90_000 };
/** Starting gap when the visitor switches to an EV: the car tool's example prices. */
export const EV_EXTRA_START = CAR_FUEL_START_FORM.evCarPrice! - PETROL_CAR_PRICE;
export const CAR_ASK_LIMITS = {
  km: { min: 100, max: 10_000 },
  extra: { min: 0, max: 50_00_000 },
};

export interface CarAnswer {
  verdict: CarFuelVerdict;
  /** Net position of the dearer car after the horizon, with interest (positive: it wins). */
  dearerNet: number;
  extraPrice: number;
  interestRate: number;
  horizonYears: number;
  /** Below this distance a month the answer changes, if it does within a sensible range. */
  flipKm: { threshold: number; cheaperBelow: 'base' | 'alternative' } | null;
  /** The full calculator's query for these numbers. */
  query: string;
}

export function carAsk(a: CarAsk): CarAnswer | null {
  const prices = verifiedFuelPrices(HERO_PRICE_CITY);
  const input = toCarFuelInput(
    {
      ...CAR_FUEL_START_FORM,
      alt: a.alt,
      monthlyKm: a.km,
      ...(prices ? { petrolPrice: prices.petrol, cngPrice: prices.cng } : {}),
      petrolCarPrice: PETROL_CAR_PRICE,
      [altCarPriceField(a.alt)]: PETROL_CAR_PRICE + a.extra,
    },
    a.alt,
  );
  if (!input) return null;
  const { verdict, basis } = carFuelVerdict(input);
  const flip = carFuelFlips(input, ['monthlyKm'])[0];
  const altPrice = PETROL_CAR_PRICE + a.extra;
  return {
    verdict,
    dearerNet: basis.netAtHorizon.withInterest,
    extraPrice: input.extraPrice,
    interestRate: input.interestRate,
    horizonYears: input.horizonMonths / 12,
    flipKm: flip
      ? { threshold: flip.threshold, cheaperBelow: flip.signBelow === -1 ? 'base' : 'alternative' }
      : null,
    query: `?alt=${a.alt}&km=${a.km}&pcp=${PETROL_CAR_PRICE}&${a.alt === 'cng' ? 'ccp' : 'ecp'}=${altPrice}`,
  };
}

/** Price per unit behind the "my bill is ₹X" blank: the solar tool's example average rate. */
export const SOLAR_RATE = SOLAR_EXAMPLE_FORM.averageRate!;

export interface SolarAsk {
  /** Electricity bill a month, ₹. */
  bill: number;
  kw: number;
  /** System cost after any subsidy, ₹. */
  cost: number;
}
export const SOLAR_ASK_START: SolarAsk = {
  bill: SOLAR_EXAMPLE_FORM.monthlyConsumptionKWh! * SOLAR_RATE,
  kw: SOLAR_EXAMPLE_FORM.systemKW!,
  cost: SOLAR_EXAMPLE_FORM.grossCost! - (SOLAR_EXAMPLE_FORM.subsidy ?? 0),
};
export const SOLAR_ASK_LIMITS = {
  bill: { min: 100, max: 70_000 },
  kw: { min: 0.5, max: 50 },
  cost: { min: 1_000, max: 50_00_000 },
};

export function solarAsk(a: SolarAsk) {
  const units = a.bill / SOLAR_RATE;
  const form = {
    ...SOLAR_EXAMPLE_FORM,
    systemKW: a.kw,
    grossCost: a.cost,
    subsidy: 0,
    monthlyConsumptionKWh: units,
  };
  const input = toSolarInput(form, verifiedTariff());
  if (!input) return null;
  const result = solarPayback(input, { withIrr: false });
  return {
    payback: result.payback,
    netAtHorizon: result.netAtHorizon,
    horizonYears: input.horizonYears,
    generationPerKWPerDay: input.generationPerKWPerDay,
    query: `?kw=${a.kw}&c=${a.cost}&s=0&u=${Math.round(units)}&rate=${SOLAR_RATE}`,
  };
}

export interface HomeAsk {
  price: number;
  rent: number;
  /** Return on invested money a year, decimal. */
  ret: number;
}
export const HOME_ASK_START: HomeAsk = {
  price: RENT_BUY_EXAMPLE_FORM.homePrice!,
  rent: RENT_BUY_EXAMPLE_FORM.monthlyRent!,
  ret: RENT_BUY_EXAMPLE_FORM.investmentReturn!,
};
export const HOME_ASK_LIMITS = {
  price: { min: 1_00_000, max: 50_00_00_000 },
  rent: { min: 500, max: 50_00_000 },
  ret: { min: 0, max: 0.3 },
};

export function homeAsk(a: HomeAsk) {
  const input = toRentBuyInput({
    ...RENT_BUY_EXAMPLE_FORM,
    homePrice: a.price,
    monthlyRent: a.rent,
    investmentReturn: a.ret,
  });
  if (!input) return null;
  const r = rentVsBuy(input);
  return {
    difference: r.atHorizon.difference,
    differenceToday: r.atHorizon.differenceToday,
    horizonYears: input.horizonYears,
    query: `?hp=${a.price}&rent=${a.rent}&ret=${a.ret}`,
  };
}
