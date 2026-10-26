/**
 * The home page's "ask in one sentence" card: a few blanks per decision, everything else from the
 * same example forms the tools open with, so the card and the tools always agree.
 * Fuel prices are the example city's verified prices; the rest are the tools' labelled examples.
 */
import { solarSubsidyFor, stateOfCity, tariffFor, verifiedFuelPrices } from '@/data';
import { carFuelFlips, carFuelVerdict, type CarFuelVerdict } from './carFuel';
import { CAR_FUEL_START_FORM, altCarPriceField, toCarFuelInput, type AltKind } from './carFuelForm';
import { EXAMPLE_PRICE_CITY } from './carFuel.example';
import { rentVsBuy } from './rentBuy';
import { RENT_BUY_EXAMPLE_FORM, toRentBuyInput } from './rentBuyForm';
import { solarPayback } from './solar';
import { solarExampleForm, toSolarInput } from './solarForm';

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

/**
 * The solar card runs on the example city's state (Delhi): its tariff with the bill subsidy for
 * homes that opt in, the subsidy by system size, and its output per kW, as the solar tool does.
 * It asks for units, not rupees: with a subsidy, a bill in rupees does not say how many units.
 */
export const SOLAR_STATE = stateOfCity(HERO_PRICE_CITY);
const SOLAR_EXAMPLE = solarExampleForm(SOLAR_STATE);

export interface SolarAsk {
  /** Units used a month. */
  units: number;
  kw: number;
  /** System price before any subsidy, ₹. */
  cost: number;
}
export const SOLAR_ASK_START: SolarAsk = {
  units: SOLAR_EXAMPLE.monthlyConsumptionKWh!,
  kw: SOLAR_EXAMPLE.systemKW!,
  cost: SOLAR_EXAMPLE.grossCost!,
};
export const SOLAR_ASK_LIMITS = {
  units: { min: 10, max: 10_000 },
  kw: { min: 0.5, max: 50 },
  cost: { min: 1_000, max: 50_00_000 },
};

export function solarAsk(a: SolarAsk) {
  const subsidy = Math.min(solarSubsidyFor(SOLAR_STATE, a.kw) ?? 0, a.cost);
  const form = {
    ...SOLAR_EXAMPLE,
    systemKW: a.kw,
    grossCost: a.cost,
    subsidy,
    monthlyConsumptionKWh: a.units,
    sanctionedLoadKW: Math.max(SOLAR_EXAMPLE.sanctionedLoadKW ?? 1, Math.ceil(a.kw)),
  };
  const input = toSolarInput(form, tariffFor(SOLAR_STATE), SOLAR_STATE);
  if (!input) return null;
  const result = solarPayback(input, { withIrr: false });
  return {
    payback: result.payback,
    netAtHorizon: result.netAtHorizon,
    horizonYears: input.horizonYears,
    generationPerKWPerDay: input.generationPerKWPerDay,
    subsidy,
    query: `?kw=${a.kw}&c=${a.cost}&u=${a.units}`,
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
