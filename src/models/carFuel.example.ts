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
 * The one city whose verified prices every example uses: the home page card, the car tool before a
 * city is chosen, its worked example and the guides. Change it here and they all follow.
 */
export const EXAMPLE_PRICE_CITY = 'lucknow';

/** The example city's verified prices and their dates, or null while either is unverified. */
export function examplePrices() {
  const prices = verifiedFuelPrices(EXAMPLE_PRICE_CITY);
  const city = fuelPrices.cities.find((c) => c.id === EXAMPLE_PRICE_CITY);
  if (!prices || !city) return null;
  return {
    ...prices,
    city: EXAMPLE_PRICE_CITY,
    petrolDate: city.petrol.effectiveDate,
    cngDate: city.cng.effectiveDate,
  };
}

/**
 * The worked example at today's verified prices: the same cars, distance and premium as the
 * fixture, with the example city's petrol and CNG prices. Falls back to the fixture's prices only
 * if the city's prices were ever unverified.
 */
export function carFuelCurrentExample(): CarFuelInput {
  const prices = examplePrices();
  if (!prices) return carFuelExample;
  return {
    ...carFuelExample,
    base: { ...carFuelExample.base, energyPrice: prices.petrol },
    alternative: { ...carFuelExample.alternative, energyPrice: prices.cng },
  };
}
