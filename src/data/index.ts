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
/** Delhi's tariff and solar figures. */
export const dlTariff = dlTariffJson as unknown as TariffData;
export const dlSolarData = dlSolarJson as unknown as SolarData;

export type StateId = 'DL' | 'UP';

/** The state a city is in; the example city (Delhi) when none is chosen. */
export function stateOfCity(cityId: string | null): StateId {
  return (fuelPrices.cities.find((c) => c.id === (cityId ?? 'delhi'))?.state ?? 'DL') as StateId;
}

/**
 * The state's tariff as an engine Tariff once verified; null while it is TODO_VERIFY. A subsidy
 * is kept only while its own record is verified.
 */
export function verifiedTariff(data: TariffData = upTariff): Tariff | null {
  if (data.status !== 'verified' || data.method === null || data.slabs.length === 0) return null;
  const { subsidy, ...rest } = data;
  return {
    ...(rest as unknown as Tariff),
    ...(subsidy && subsidy.status === 'verified' ? { subsidy } : {}),
  };
}

export const tariffFor = (state: StateId): Tariff | null =>
  verifiedTariff(state === 'DL' ? dlTariff : upTariff);

export const solarDataFor = (state: StateId): SolarData =>
  state === 'DL' ? dlSolarData : solarData;

type SolarValueKey =
  'generationPerKWPerDay' | 'degradationPerYear' | 'exportRatePerKWh' | 'subsidy';

/** A solar data value once verified, else null (UP unless a state is named). */
export function verifiedSolarValue(key: SolarValueKey, state: StateId = 'UP'): number | null {
  const record = solarDataFor(state)[key];
  return record && record.status === 'verified' ? record.value : null;
}

/**
 * The subsidy on a rooftop system of `kW`: the state's one amount (UP), or the central bands plus
 * the state's capital subsidy (Delhi). Null while unverified.
 */
export function solarSubsidyFor(state: StateId, kW: number): number | null {
  const data = solarDataFor(state);
  if (data.subsidy) return data.subsidy.status === 'verified' ? data.subsidy.value : null;
  const central = data.centralSubsidy;
  if (!central || central.status !== 'verified') return null;
  let total = 0;
  let from = 0;
  for (const band of central.bands) {
    const to = Math.min(kW, band.upToKW ?? Infinity);
    if (to > from) total += (to - from) * band.perKW;
    from = band.upToKW ?? Infinity;
  }
  const capital = data.stateCapitalSubsidy;
  if (capital && capital.status === 'verified') total += Math.min(capital.perKW * kW, capital.max);
  return total;
}

/** ₹ per unit generated that the state pays a system of `kW`, or null if there is none. */
export function generationIncentiveFor(state: StateId, kW: number): number | null {
  const gbi = solarDataFor(state).generationIncentive;
  if (!gbi || gbi.status !== 'verified') return null;
  const band = gbi.bands.find((b) => b.upToKW === null || kW <= b.upToKW);
  return band ? band.perKWh : null;
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
