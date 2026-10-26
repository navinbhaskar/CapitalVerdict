import { fuelPrices, verifiedFuelPrices } from '@/data';
import type { CarFuelInput } from './carFuel';

/**
 * GOLDEN TEST FIXTURE ONLY: the spec's original worked example, frozen at September 2026 prices
 * (petrol ₹101.86/L @ 18 km/L vs CNG ₹95.75/kg @ 26 km/kg, 1,800 km a month, ₹90,000 extra price
 * at 9% a year, flat prices, no extra upkeep). Its hand-checked figures anchor the model tests.
 * Nothing a visitor sees should use it: pages use `carFuelCurrentExample` below.
 */
export const carFuelExample: CarFuelInput = {
  monthlyKm: 1800,
  horizonMonths: 120,
  base: { mileage: 18, energyPrice: 101.86, annualPriceRise: 0, annualUpkeep: 0 },
  alternative: { mileage: 26, energyPrice: 95.75, annualPriceRise: 0, annualUpkeep: 0 },
  extraPrice: 90_000,
  interestRate: 0.09,
};

/**
 * The city used when the visitor has not chosen one: the home page card, the car tool, its worked
 * example. Change it here and they all follow. Guides about one city name that city instead.
 */
export const EXAMPLE_PRICE_CITY = 'delhi';

/** A city's verified prices and their dates, or null while either is unverified. */
export function examplePrices(cityId: string = EXAMPLE_PRICE_CITY) {
  const prices = verifiedFuelPrices(cityId);
  const city = fuelPrices.cities.find((c) => c.id === cityId);
  if (!prices || !city) return null;
  return {
    ...prices,
    city: cityId,
    petrolDate: city.petrol.effectiveDate,
    cngDate: city.cng.effectiveDate,
  };
}

/**
 * The worked example at a city's verified prices (the example city unless named): the same cars,
 * distance and premium as the fixture, with that city's petrol and CNG prices. Falls back to the
 * fixture's prices only if the city's prices were ever unverified.
 */
export function carFuelCurrentExample(cityId: string = EXAMPLE_PRICE_CITY): CarFuelInput {
  const prices = examplePrices(cityId);
  if (!prices) return carFuelExample;
  return {
    ...carFuelExample,
    base: { ...carFuelExample.base, energyPrice: prices.petrol },
    alternative: { ...carFuelExample.alternative, energyPrice: prices.cng },
  };
}
