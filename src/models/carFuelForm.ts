/**
 * The car fuel tool's form: flat, nullable fields that map 1:1 to URL params and to CarFuelInput.
 * Petrol is always the base; the alternative is CNG or an EV (`alt`), each with its own fields.
 * Starts from the spec / workbook example: flat fuel prices (0% rise), no extra upkeep.
 * Car prices and every EV value start empty: they are the user's own quotes and habits, and the
 * electricity data is not verified yet.
 */
import type { ShareSchema } from '@/lib/shareLink';
import type { CarFuelInput, FuelOption } from './carFuel';
import { carFuelExample } from './carFuel.example';

export type AltKind = 'cng' | 'ev';
/** What petrol is compared with: one alternative, or both side by side. */
export type FormAlt = AltKind | 'all';

export interface CarFuelForm {
  alt: FormAlt;
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
  /** On-road price of the EV, ₹. */
  evCarPrice: number | null;
  /** km per kWh, real-world. */
  evEfficiency: number | null;
  /** Share of charging done at home, decimal. */
  homeChargingShare: number | null;
  /** ₹ per kWh at home (the user's price per unit until the state tariff is verified). */
  homeRate: number | null;
  /** ₹ per kWh at public chargers. Not needed when all charging is at home. */
  publicRate: number | null;
  evPriceRise: number | null;
  evUpkeep: number | null;
  horizonYears: number | null;
  /** Optional extras; empty means not counted. Insurance is ₹ a year, flat. */
  petrolInsurance: number | null;
  cngInsurance: number | null;
  evInsurance: number | null;
  /** Resale at the end of the horizon, as a decimal of the on-road price. */
  petrolResale: number | null;
  cngResale: number | null;
  evResale: number | null;
  /** One big cost in a given year (CNG cylinder or kit, EV battery), ₹ and year 1–20. */
  cngOneOffCost: number | null;
  cngOneOffYear: number | null;
  evOneOffCost: number | null;
  evOneOffYear: number | null;
}

export type NumericField = Exclude<keyof CarFuelForm, 'alt'>;

export const CAR_FUEL_EXAMPLE_FORM: CarFuelForm = {
  alt: 'cng',
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
  evCarPrice: null,
  evEfficiency: null,
  homeChargingShare: null,
  homeRate: null,
  publicRate: null,
  evPriceRise: 0,
  evUpkeep: 0,
  horizonYears: carFuelExample.horizonMonths / 12,
  petrolInsurance: null,
  cngInsurance: null,
  evInsurance: null,
  petrolResale: null,
  cngResale: null,
  evResale: null,
  cngOneOffCost: null,
  cngOneOffYear: null,
  evOneOffCost: null,
  evOneOffYear: null,
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
  evCarPrice: { min: 1, max: 2_00_00_000 },
  evEfficiency: { min: 1, max: 20 },
  homeChargingShare: { min: 0, max: 1 },
  homeRate: { min: 0.5, max: 50 },
  publicRate: { min: 0.5, max: 100 },
  evPriceRise: { min: 0, max: 0.2 },
  evUpkeep: { min: 0, max: 500_000 },
  horizonYears: { min: 1, max: 20 },
  petrolInsurance: { min: 0, max: 500_000 },
  cngInsurance: { min: 0, max: 500_000 },
  evInsurance: { min: 0, max: 500_000 },
  petrolResale: { min: 0, max: 1 },
  cngResale: { min: 0, max: 1 },
  evResale: { min: 0, max: 1 },
  cngOneOffCost: { min: 0, max: 50_00_000 },
  cngOneOffYear: { min: 1, max: 20 },
  evOneOffCost: { min: 0, max: 50_00_000 },
  evOneOffYear: { min: 1, max: 20 },
} as const satisfies Record<NumericField, { min: number; max: number }>;

const CNG_ONLY: NumericField[] = [
  'cngCarPrice',
  'cngPrice',
  'cngMileage',
  'cngPriceRise',
  'cngUpkeep',
  'cngInsurance',
  'cngResale',
  'cngOneOffCost',
  'cngOneOffYear',
];
const EV_ONLY: NumericField[] = [
  'evCarPrice',
  'evEfficiency',
  'homeChargingShare',
  'homeRate',
  'publicRate',
  'evPriceRise',
  'evUpkeep',
  'evInsurance',
  'evResale',
  'evOneOffCost',
  'evOneOffYear',
];
/** May be left empty: empty means "not counted". */
const OPTIONAL: NumericField[] = [
  'petrolInsurance',
  'cngInsurance',
  'evInsurance',
  'petrolResale',
  'cngResale',
  'evResale',
  'cngOneOffCost',
  'cngOneOffYear',
  'evOneOffCost',
  'evOneOffYear',
];
const INTEGER: NumericField[] = ['horizonYears', 'cngOneOffYear', 'evOneOffYear'];

const num = (param: string, key: NumericField, integer = false) => ({
  param,
  type: 'number' as const,
  ...CAR_FUEL_LIMITS[key],
  integer,
});

export const carFuelShareSchema: ShareSchema<CarFuelForm> = {
  alt: { param: 'alt', type: 'enum', values: ['cng', 'ev', 'all'] },
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
  evCarPrice: num('ecp', 'evCarPrice'),
  evEfficiency: num('ee', 'evEfficiency'),
  homeChargingShare: num('hs', 'homeChargingShare'),
  homeRate: num('hr', 'homeRate'),
  publicRate: num('pubr', 'publicRate'),
  evPriceRise: num('er', 'evPriceRise'),
  evUpkeep: num('eu', 'evUpkeep'),
  horizonYears: num('y', 'horizonYears', true),
  petrolInsurance: num('pi', 'petrolInsurance'),
  cngInsurance: num('ci', 'cngInsurance'),
  evInsurance: num('ei', 'evInsurance'),
  petrolResale: num('prs', 'petrolResale'),
  cngResale: num('crs', 'cngResale'),
  evResale: num('ers', 'evResale'),
  cngOneOffCost: num('coc', 'cngOneOffCost'),
  cngOneOffYear: num('coy', 'cngOneOffYear', true),
  evOneOffCost: num('eoc', 'evOneOffCost'),
  evOneOffYear: num('eoy', 'evOneOffYear', true),
};

/** The on-road price field of the chosen alternative. */
export const altCarPriceField = (alt: AltKind): NumericField =>
  alt === 'cng' ? 'cngCarPrice' : 'evCarPrice';

/** On-road price fields needed for the chosen comparison, petrol first. */
export const carPriceFields = (alt: FormAlt): NumericField[] =>
  alt === 'all'
    ? ['petrolCarPrice', 'cngCarPrice', 'evCarPrice']
    : ['petrolCarPrice', altCarPriceField(alt)];

/** Fields that are empty or out of bounds, for the chosen comparison only. */
export function invalidFields(form: CarFuelForm): NumericField[] {
  const skip = new Set(form.alt === 'cng' ? EV_ONLY : form.alt === 'ev' ? CNG_ONLY : []);
  // Public charging price only matters when some charging is away from home.
  if (form.alt !== 'cng' && form.homeChargingShare === 1) skip.add('publicRate');
  return (Object.keys(CAR_FUEL_LIMITS) as NumericField[]).filter((key) => {
    if (skip.has(key)) return false;
    const value = form[key];
    // A one-off cost needs the year it falls in.
    if (key === 'cngOneOffYear' && (form.cngOneOffCost ?? 0) > 0 && value === null) return true;
    if (key === 'evOneOffYear' && (form.evOneOffCost ?? 0) > 0 && value === null) return true;
    if (value === null) return !OPTIONAL.includes(key);
    const { min, max } = CAR_FUEL_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(value);
  });
}

/**
 * EV charging price per kWh, blended: home share × home price + the rest × public price.
 * null until the inputs it needs are valid.
 */
export function evEnergyPrice(form: CarFuelForm): number | null {
  const share = form.homeChargingShare;
  if (share === null || form.homeRate === null || share < 0 || share > 1) return null;
  if (share === 1) return form.homeRate;
  if (form.publicRate === null) return null;
  return share * form.homeRate + (1 - share) * form.publicRate;
}

/** The single alternative a form compares with; "all" defaults to CNG unless one is named. */
const kindOf = (form: CarFuelForm, kind?: AltKind): AltKind =>
  kind ?? (form.alt === 'all' ? 'cng' : form.alt);

/** A one-off cost in year y is charged in that year's first month. */
const oneOff = (cost: number | null, year: number | null) =>
  cost && year ? { month: (year - 1) * 12 + 1, amount: cost } : undefined;

function option(form: CarFuelForm, kind: 'petrol' | AltKind): FuelOption {
  switch (kind) {
    case 'petrol':
      return {
        mileage: form.petrolMileage!,
        energyPrice: form.petrolPrice!,
        annualPriceRise: form.petrolPriceRise!,
        annualUpkeep: form.petrolUpkeep! + (form.petrolInsurance ?? 0),
      };
    case 'cng':
      return {
        mileage: form.cngMileage!,
        energyPrice: form.cngPrice!,
        annualPriceRise: form.cngPriceRise!,
        annualUpkeep: form.cngUpkeep! + (form.cngInsurance ?? 0),
        oneOff: oneOff(form.cngOneOffCost, form.cngOneOffYear),
      };
    case 'ev':
      return {
        mileage: form.evEfficiency!,
        energyPrice: evEnergyPrice(form)!,
        annualPriceRise: form.evPriceRise!,
        annualUpkeep: form.evUpkeep! + (form.evInsurance ?? 0),
        oneOff: oneOff(form.evOneOffCost, form.evOneOffYear),
      };
  }
}

/**
 * CarFuelInput (petrol against one alternative) for a complete, valid form; null otherwise.
 * With "all", pass `kind` to pick the pair; it defaults to CNG.
 */
export function toCarFuelInput(form: CarFuelForm, kind?: AltKind): CarFuelInput | null {
  if (invalidFields(form).length > 0) return null;
  const alt = kindOf(form, kind);
  const altPrice = form[altCarPriceField(alt)]!;
  const altResale = alt === 'cng' ? form.cngResale : form.evResale;
  const withResale = form.petrolResale !== null || altResale !== null;
  return {
    monthlyKm: form.monthlyKm!,
    horizonMonths: form.horizonYears! * 12,
    extraPrice: altPrice - form.petrolCarPrice!,
    purchasePrices: { base: form.petrolCarPrice!, alternative: altPrice },
    interestRate: form.interestRate!,
    base: option(form, 'petrol'),
    alternative: option(form, alt),
    ...(withResale
      ? {
          resale: {
            base: form.petrolCarPrice! * (form.petrolResale ?? 0),
            alternative: altPrice * (altResale ?? 0),
          },
        }
      : {}),
  };
}

/** Alternative on-road price minus petrol on-road price, or null until both are valid. */
export function extraPriceOf(form: CarFuelForm, kind?: AltKind): number | null {
  const bad = invalidFields(form);
  const altField = altCarPriceField(kindOf(form, kind));
  if (bad.includes('petrolCarPrice') || bad.includes(altField)) return null;
  return form[altField]! - form.petrolCarPrice!;
}

/** True when the only thing missing is one or more car prices (the usual first-visit state). */
export function onlyPricesMissing(form: CarFuelForm): boolean {
  const bad = invalidFields(form);
  const prices = carPriceFields(form.alt);
  return bad.length > 0 && bad.every((k) => prices.includes(k) && form[k] === null);
}
