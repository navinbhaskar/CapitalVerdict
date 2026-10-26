/**
 * Typed access to the data files, without shipping zod to the browser.
 * The same files are validated against ./schema.ts at build time and in tests.
 */
import defaultsJson from './defaults.json';
import fuelPricesJson from './fuelPrices.json';
import upTariffJson from './tariffs/UP.json';
import solarJson from './solar/UP.json';
import dlTariffJson from './tariffs/DL.json';
import dlSolarJson from './solar/DL.json';
import propertyJson from './property.json';
import changelogJson from './changelog.json';
import incomeTaxJson from './incomeTax.json';
import smallSavingsJson from './smallSavings.json';
import type {
  DataRecord,
  Changelog,
  Defaults,
  FuelPrices,
  IncomeTaxData,
  SmallSavingsData,
  PropertyData,
  SolarData,
  TariffData,
} from './schema';
import type { Tariff } from '@/engine/tariff';

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

/** Cities whose petrol and CNG prices are both verified: the only ones a visitor can choose. */
export const verifiedCityIds: readonly string[] = cityIds.filter(
  (id) => verifiedFuelPrices(id) !== null,
);

export const upTariff = upTariffJson as unknown as TariffData;
/** UP's solar figures: one subsidy amount, so `subsidy` is always present. */
export const solarData = solarJson as unknown as SolarData & { subsidy: DataRecord };
/** Delhi's tariff and solar figures. The tools start using them in the next milestone. */
export const dlTariff = dlTariffJson as unknown as TariffData;
export const dlSolarData = dlSolarJson as unknown as SolarData;

/** The state's tariff as an engine Tariff once verified; null while it is TODO_VERIFY. */
export function verifiedTariff(data: TariffData = upTariff): Tariff | null {
  if (data.status !== 'verified' || data.method === null || data.slabs.length === 0) return null;
  return data as unknown as Tariff;
}

/** A solar data value once verified, else null. */
export function verifiedSolarValue(
  key: 'generationPerKWPerDay' | 'degradationPerYear' | 'exportRatePerKWh' | 'subsidy',
): number | null {
  const record = solarData[key];
  return record && record.status === 'verified' ? record.value : null;
}

export const propertyData = propertyJson as unknown as PropertyData;

/** Stamp duty and registration as a decimal of the price, once verified; null before. */
export function verifiedStampDuty(): number | null {
  const r = propertyData.stampDutyAndRegistration;
  return r.status === 'verified' ? r.value : null;
}

export const changelog = changelogJson as unknown as Changelog;

export const incomeTax = incomeTaxJson as unknown as IncomeTaxData;
export const smallSavings = smallSavingsJson as unknown as SmallSavingsData;
