/**
 * The car fuel tool's form: flat, nullable fields that map 1:1 to URL params and to CarFuelInput.
 * Starts from the illustrative spec example (prices are not current market data) and the default
 * base-scenario price rise.
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { CarFuelInput } from './carFuel';
import { carFuelExample } from './carFuel.example';

export interface CarFuelForm {
  monthlyKm: number | null;
  extraPrice: number | null;
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

const baseRise = defaults.scenarioVariables.energyPriceRise.values.base;

export const CAR_FUEL_EXAMPLE_FORM: CarFuelForm = {
  monthlyKm: carFuelExample.monthlyKm,
  extraPrice: carFuelExample.extraPrice,
  petrolPrice: carFuelExample.base.energyPrice,
  cngPrice: carFuelExample.alternative.energyPrice,
  petrolMileage: carFuelExample.base.mileage,
  cngMileage: carFuelExample.alternative.mileage,
  interestRate: carFuelExample.interestRate,
  petrolPriceRise: baseRise,
  cngPriceRise: baseRise,
  petrolUpkeep: 0,
  cngUpkeep: 0,
  horizonYears: carFuelExample.horizonMonths / 12,
};

/** Bounds shared by validation and URL decoding. */
export const CAR_FUEL_LIMITS = {
  monthlyKm: { min: 0, max: 20_000 },
  extraPrice: { min: 0, max: 5_000_000 },
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
  extraPrice: num('x', 'extraPrice'),
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
    extraPrice: f.extraPrice,
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
