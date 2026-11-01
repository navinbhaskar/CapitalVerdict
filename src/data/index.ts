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
import evTwoWheelerJson from './evTwoWheeler.json';
import carsJson from './cars.json';
import type {
  DataRecord,
  EvTwoWheelerData,
  CarsData,
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

export type StateId = 'DL' | 'UP' | 'MH' | 'KA' | 'TS' | 'TN' | 'WB' | 'GJ';
export const STATE_IDS: readonly StateId[] = ['DL', 'UP', 'MH', 'KA', 'TS', 'TN', 'WB', 'GJ'];

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

/** The state's verified tariff, or null: tools then ask for a price per unit instead. */
export const tariffFor = (state: StateId): Tariff | null =>
  state === 'DL' ? verifiedTariff(dlTariff) : state === 'UP' ? verifiedTariff(upTariff) : null;

const notYet = (what: string) => ({
  value: null,
  unit: '—',
  source: `TODO_VERIFY: no verified ${what} for this state yet.`,
  effectiveDate: '2026-10-28',
  status: 'TODO_VERIFY' as const,
});
/** A state without solar data: everything is the visitor's to enter, except panel degradation. */
const noSolarData = (state: StateId): SolarData => ({
  state: state as SolarData['state'],
  subsidy: notYet('rooftop solar subsidy'),
  generationPerKWPerDay: notYet('generation per kW'),
  degradationPerYear: dlSolarData.degradationPerYear,
  exportRatePerKWh: notYet('export rate'),
});

export const solarDataFor = (state: StateId): SolarData =>
  state === 'DL' ? dlSolarData : state === 'UP' ? solarData : noSolarData(state);

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

export const evTwoWheeler = evTwoWheelerJson as unknown as EvTwoWheelerData;

/**
 * The central incentive on an electric two-wheeler, ₹: per kWh up to the cap per vehicle, and no
 * more than its share of the ex-factory price (when known). Nil above the price limit or outside
 * the scheme's dates. It comes off the price at purchase.
 */
export function centralEv2wIncentive(
  batteryKWh: number,
  onDate: string,
  exFactoryPrice: number | null = null,
): number {
  const c = evTwoWheeler.central;
  if (c.status !== 'verified' || onDate < c.validFrom || onDate > c.validUntil) return 0;
  if (exFactoryPrice !== null && exFactoryPrice > c.maxExFactoryPrice) return 0;
  const byShare = exFactoryPrice === null ? Infinity : exFactoryPrice * c.shareOfExFactoryCap;
  return Math.max(0, Math.min(batteryKWh * c.perKWh, c.capPerVehicle, byShare));
}

/**
 * A state's own incentive on an electric two-wheeler registered on `onDate`, ₹: the rate and cap
 * of that registration year, nil above the price limit or outside the years. Paid after
 * registration. 0 for a state without one.
 */
export function stateEv2wIncentive(
  state: StateId,
  batteryKWh: number,
  exShowroomPrice: number,
  onDate: string,
): number {
  const p = evTwoWheeler.states.find((s) => s.state === state)?.purchase;
  if (!p || p.status !== 'verified' || exShowroomPrice > p.maxExShowroomPrice) return 0;
  const year = p.years.find((y) => onDate >= y.from && onDate <= y.until);
  return year ? Math.max(0, Math.min(batteryKWh * year.perKWh, year.cap)) : 0;
}

export const cars = carsJson as unknown as CarsData;

/**
 * The share of the listed price an insurer takes off a car of `ageMonths` when fixing its insured
 * value (the India Motor Tariff schedule). Null beyond five years, where it is agreed instead, or
 * while unverified. Not a market resale price.
 */
export function idvDepreciationShare(ageMonths: number): number | null {
  const d = cars.idvDepreciation;
  if (d.status !== 'verified' || ageMonths < 0) return null;
  return d.bands.find((b) => ageMonths <= b.upToMonths)?.share ?? null;
}

/** The yearly third-party base premium for a private car of `cc`, ₹ before GST; null if unverified. */
export function thirdPartyPremium(cc: number): number | null {
  const p = cars.thirdPartyPremium;
  if (p.status !== 'verified') return null;
  return p.privateCar.find((b) => b.upToCC === null || cc <= b.upToCC)!.premium;
}

/** One-time road tax on a car of `costPrice` registered in `state`, ₹; null without verified rates. */
export function carRoadTax(state: StateId, costPrice: number): number | null {
  const t = cars.roadTax.find((r) => r.state === state);
  if (!t || t.status !== 'verified') return null;
  return costPrice * t.bands.find((b) => b.upToPrice === null || costPrice <= b.upToPrice)!.rate;
}
