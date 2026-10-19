/**
 * Typed access to the data files, without shipping zod to the browser.
 * The same files are validated against ./schema.ts at build time and in tests.
 */
import defaultsJson from './defaults.json';
import fuelPricesJson from './fuelPrices.json';
import type { Defaults, FuelPrices } from './schema';

export const defaults = defaultsJson as unknown as Defaults;
export const fuelPrices = fuelPricesJson as unknown as FuelPrices;
export const cityIds: readonly string[] = fuelPrices.cities.map((c) => c.id);

/** A city's verified petrol and CNG prices, or null while either is unverified. */
export function verifiedFuelPrices(cityId: string | null): { petrol: number; cng: number } | null {
  const city = fuelPrices.cities.find((c) => c.id === cityId);
  if (!city || city.petrol.status !== 'verified' || city.cng.status !== 'verified') return null;
  if (city.petrol.value === null || city.cng.value === null) return null;
  return { petrol: city.petrol.value, cng: city.cng.value };
}
