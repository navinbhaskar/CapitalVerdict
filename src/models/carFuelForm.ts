/**
 * The car fuel tool's form: flat, nullable fields that map 1:1 to URL params and to CarFuelInput.
 * Starts from the spec / workbook example: flat fuel prices (0% rise), no extra upkeep.
 * The two on-road car prices start empty: they are the user's own quotes, never example data.
 */
import type { ShareSchema } from '@/lib/shareLink';
import type { CarFuelInput } from './carFuel';
import { carFuelExample } from './carFuel.example';

export interface CarFuelForm {
  monthlyKm: number | null;
  /** On-road price of the petrol car, ₹. */
  petrolCarPrice: number | null;
  /** On-road price of the CNG car, ₹. */
  cngCarPrice: number | null;
  petrolPrice: number | null;
  cngPrice: number | null;
  petrolMileage: number | null;
  cngMileage: number | null;
  /** Decimal per year. */
  interestRate: number | null;
  petrolPriceRise: number | null;
  cngPriceRise: number | null;
  petrolUpkeep: number | null;
  cngUpkeep: number | null;
  horizonYears: number | null;
}

export const CAR_FUEL_EXAMPLE_FORM: CarFuelForm = {
  monthlyKm: carFuelExample.monthlyKm,
  petrolCarPrice: null,
  cngCarPrice: null,
  petrolPrice: carFuelExample.base.energyPrice,
  cngPrice: carFuelExample.alternative.energyPrice,
  petrolMileage: carFuelExample.base.mileage,
  cngMileage: carFuelExample.alternative.mileage,
  interestRate: carFuelExample.interestRate,
  petrolPriceRise: carFuelExample.base.annualPriceRise,
  cngPriceRise: carFuelExample.alternative.annualPriceRise,
  petrolUpkeep: 0,
  cngUpkeep: 0,
  horizonYears: carFuelExample.horizonMonths / 12,
};

/** Bounds shared by validation and URL decoding. */
export const CAR_FUEL_LIMITS = {
  monthlyKm: { min: 0, max: 20_000 },
  petrolCarPrice: { min: 1, max: 1_00_00_000 },
  cngCarPrice: { min: 1, max: 1_00_00_000 },
  petrolPrice: { min: 1, max: 1_000 },
  cngPrice: { min: 1, max: 1_000 },
  petrolMileage: { min: 1, max: 100 },
  cngMileage: { min: 1, max: 100 },
  interestRate: { min: 0, max: 0.3 },
  petrolPriceRise: { min: 0, max: 0.2 },
  cngPriceRise: { min: 0, max: 0.2 },
  petrolUpkeep: { min: 0, max: 500_000 },
  cngUpkeep: { min: 0, max: 500_000 },
  horizonYears: { min: 1, max: 20 },
} as const satisfies Record<keyof CarFuelForm, { min: number; max: number }>;

const num = (param: string, key: keyof CarFuelForm, integer = false) => ({
  param,
  type: 'number' as const,
  ...CAR_FUEL_LIMITS[key],
  integer,
});

export const carFuelShareSchema: ShareSchema<CarFuelForm> = {
  monthlyKm: num('km', 'monthlyKm'),
  petrolCarPrice: num('pcp', 'petrolCarPrice'),
  cngCarPrice: num('ccp', 'cngCarPrice'),
  petrolPrice: num('pp', 'petrolPrice'),
  cngPrice: num('cp', 'cngPrice'),
  petrolMileage: num('pm', 'petrolMileage'),
  cngMileage: num('cm', 'cngMileage'),
  interestRate: num('r', 'interestRate'),
  petrolPriceRise: num('pr', 'petrolPriceRise'),
  cngPriceRise: num('cr', 'cngPriceRise'),
  petrolUpkeep: num('pu', 'petrolUpkeep'),
  cngUpkeep: num('cu', 'cngUpkeep'),
  horizonYears: num('y', 'horizonYears', true),
};

/** Fields that are empty or out of bounds. */
export function invalidFields(form: CarFuelForm): (keyof CarFuelForm)[] {
  return (Object.keys(CAR_FUEL_LIMITS) as (keyof CarFuelForm)[]).filter((key) => {
    const value = form[key];
    const { min, max } = CAR_FUEL_LIMITS[key];
    if (value === null || !Number.isFinite(value) || value < min || value > max) return true;
    return key === 'horizonYears' && !Number.isInteger(value);
  });
}

/** CarFuelInput for a complete, valid form; null otherwise. */
export function toCarFuelInput(form: CarFuelForm): CarFuelInput | null {
  if (invalidFields(form).length > 0) return null;
  const f = form as { [K in keyof CarFuelForm]: number };
  return {
    monthlyKm: f.monthlyKm,
    horizonMonths: f.horizonYears * 12,
    extraPrice: f.cngCarPrice - f.petrolCarPrice,
    purchasePrices: { base: f.petrolCarPrice, alternative: f.cngCarPrice },
    interestRate: f.interestRate,
    base: {
      mileage: f.petrolMileage,
      energyPrice: f.petrolPrice,
      annualPriceRise: f.petrolPriceRise,
      annualUpkeep: f.petrolUpkeep,
    },
    alternative: {
      mileage: f.cngMileage,
      energyPrice: f.cngPrice,
      annualPriceRise: f.cngPriceRise,
      annualUpkeep: f.cngUpkeep,
    },
  };
}

/** CNG on-road price minus petrol on-road price, or null until both are entered and valid. */
export function extraPriceOf(form: CarFuelForm): number | null {
  const bad = invalidFields(form);
  if (bad.includes('petrolCarPrice') || bad.includes('cngCarPrice')) return null;
  return form.cngCarPrice! - form.petrolCarPrice!;
}

/** True when the only thing missing is one or both car prices (the usual first-visit state). */
export function onlyPricesMissing(form: CarFuelForm): boolean {
  const bad = invalidFields(form);
  return (
    bad.length > 0 &&
    bad.every((k) => (k === 'petrolCarPrice' || k === 'cngCarPrice') && form[k] === null)
  );
}
