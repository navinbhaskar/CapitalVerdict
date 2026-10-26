/**
 * The scooter tool's form. Scooter prices, mileage, the e-scooter's km per unit and battery size,
 * the distance and the home's other units start as ILLUSTRATIVE EXAMPLES (labelled "Example"),
 * not any model's figures. The petrol price comes from the city's verified price. Where the
 * state's tariff is verified (Delhi) charging is priced on the home's real bill; otherwise the
 * visitor's price per unit, which starts empty. Incentives come from the data files.
 */
import { centralEv2wIncentive, defaults, evTwoWheeler, stateEv2wIncentive } from '@/data';
import type { StateId } from '@/data';
import type { Tariff } from '@/engine/tariff';
import type { ShareSchema } from '@/lib/shareLink';
import type { ScooterInput } from './scooter';

export interface ScooterForm {
  monthlyKm: number | null;
  years: number | null;
  petrolPrice: number | null;
  petrolMileage: number | null;
  fuelPrice: number | null;
  petrolUpkeep: number | null;
  evPrice: number | null;
  kmPerUnit: number | null;
  batteryKWh: number | null;
  evUpkeep: number | null;
  batteryCost: number | null;
  batteryYear: number | null;
  /** On a real bill: the home's other units a month, its load and any PPAC. */
  otherUnits: number | null;
  sanctionedLoadKW: number | null;
  ppacRate: number | null;
  subsidyOptIn: boolean;
  /** Without the state's tariff: the visitor's price per unit. */
  pricePerUnit: number | null;
  /** Count the state's purchase incentive (an approved model, bought by a resident). */
  claimState: boolean;
  /** Count the scrapping bonus (an old two-wheeler scrapped). */
  scrapping: boolean;
  petrolPriceRise: number | null;
  tariffRise: number | null;
  interestRate: number | null;
}

export type ScooterNumberKey = {
  [K in keyof ScooterForm]: ScooterForm[K] extends number | null ? K : never;
}[keyof ScooterForm];

export const SCOOTER_LIMITS: Record<ScooterNumberKey, { min: number; max: number }> = {
  monthlyKm: { min: 1, max: 10_000 },
  years: { min: 1, max: 15 },
  petrolPrice: { min: 1_000, max: 1e7 },
  petrolMileage: { min: 5, max: 150 },
  fuelPrice: { min: 1, max: 500 },
  petrolUpkeep: { min: 0, max: 1e6 },
  evPrice: { min: 1_000, max: 1e7 },
  kmPerUnit: { min: 5, max: 200 },
  batteryKWh: { min: 0.5, max: 20 },
  evUpkeep: { min: 0, max: 1e6 },
  batteryCost: { min: 0, max: 1e6 },
  batteryYear: { min: 1, max: 15 },
  otherUnits: { min: 0, max: 10_000 },
  sanctionedLoadKW: { min: 1, max: 100 },
  ppacRate: { min: 0, max: 1 },
  pricePerUnit: { min: 0, max: 100 },
  petrolPriceRise: { min: 0, max: 0.2 },
  tariffRise: { min: 0, max: 0.2 },
  interestRate: { min: 0, max: 0.3 },
};

export const SCOOTER_INTEGER_KEYS = new Set<ScooterNumberKey>(['years', 'batteryYear']);
/** Empty means not counted. */
const OPTIONAL = new Set<ScooterNumberKey>([
  'petrolUpkeep',
  'evUpkeep',
  'batteryCost',
  'batteryYear',
  'ppacRate',
]);

const num = (param: string, key: ScooterNumberKey) => ({
  param,
  type: 'number' as const,
  ...SCOOTER_LIMITS[key],
  integer: SCOOTER_INTEGER_KEYS.has(key),
});

export const scooterShareSchema: ShareSchema<ScooterForm> = {
  monthlyKm: num('km', 'monthlyKm'),
  years: num('y', 'years'),
  petrolPrice: num('pp', 'petrolPrice'),
  petrolMileage: num('pm', 'petrolMileage'),
  fuelPrice: num('fp', 'fuelPrice'),
  petrolUpkeep: num('pu', 'petrolUpkeep'),
  evPrice: num('ep', 'evPrice'),
  kmPerUnit: num('ek', 'kmPerUnit'),
  batteryKWh: num('kwh', 'batteryKWh'),
  evUpkeep: num('eu', 'evUpkeep'),
  batteryCost: num('bc', 'batteryCost'),
  batteryYear: num('by', 'batteryYear'),
  otherUnits: num('ou', 'otherUnits'),
  sanctionedLoadKW: num('load', 'sanctionedLoadKW'),
  ppacRate: num('ppac', 'ppacRate'),
  subsidyOptIn: { param: 'sub', type: 'boolean' },
  pricePerUnit: num('ppu', 'pricePerUnit'),
  claimState: { param: 'inc', type: 'boolean' },
  scrapping: { param: 'scr', type: 'boolean' },
  petrolPriceRise: num('pr', 'petrolPriceRise'),
  tariffRise: num('tr', 'tariffRise'),
  interestRate: num('r', 'interestRate'),
};

/** The fields the form needs as it stands: a real bill or a price per unit, and a battery year with a battery cost. */
function required(form: ScooterForm, onTariff: boolean): Set<ScooterNumberKey> {
  const keys = new Set(
    (Object.keys(SCOOTER_LIMITS) as ScooterNumberKey[]).filter((k) => !OPTIONAL.has(k)),
  );
  if (onTariff) keys.delete('pricePerUnit');
  else {
    keys.delete('otherUnits');
    keys.delete('sanctionedLoadKW');
  }
  if (form.batteryCost !== null) keys.add('batteryYear');
  return keys;
}

/** Fields that are missing or out of range. */
export function invalidScooterFields(form: ScooterForm, onTariff: boolean): ScooterNumberKey[] {
  const need = required(form, onTariff);
  return (Object.keys(SCOOTER_LIMITS) as ScooterNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return need.has(key);
    if (!need.has(key) && !OPTIONAL.has(key)) return false;
    const { min, max } = SCOOTER_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return SCOOTER_INTEGER_KEYS.has(key) && !Number.isInteger(v);
  });
}

/** The incentives this form would get on `onDate` (yyyy-mm-dd). */
export function scooterIncentives(form: ScooterForm, state: StateId, onDate: string) {
  const dl = evTwoWheeler.states.find((s) => s.state === state);
  const kWh = form.batteryKWh ?? 0;
  const statePossible =
    form.evPrice !== null && kWh > 0 ? stateEv2wIncentive(state, kWh, form.evPrice, onDate) : 0;
  return {
    /** Already in the dealer's price, shown for information. */
    central: kWh > 0 ? centralEv2wIncentive(kWh, onDate) : 0,
    /** What the state would pay, whether or not the visitor counts it. */
    statePossible,
    state: form.claimState ? statePossible : 0,
    scrappingPossible: dl?.scrapping?.status === 'verified' ? dl.scrapping.amount : 0,
    scrapping: form.scrapping && dl?.scrapping?.status === 'verified' ? dl.scrapping.amount : 0,
  };
}

export function toScooterInput(
  form: ScooterForm,
  tariff: Tariff | null,
  state: StateId,
  onDate: string,
): ScooterInput | null {
  if (invalidScooterFields(form, tariff !== null).length > 0) return null;
  const inc = scooterIncentives(form, state, onDate);
  return {
    monthlyKm: form.monthlyKm!,
    years: form.years!,
    petrol: {
      price: form.petrolPrice!,
      mileage: form.petrolMileage!,
      fuelPrice: form.fuelPrice!,
      upkeep: form.petrolUpkeep ?? 0,
    },
    ev: {
      price: form.evPrice!,
      kmPerUnit: form.kmPerUnit!,
      upkeep: form.evUpkeep ?? 0,
      ...(form.batteryCost !== null
        ? { battery: { cost: form.batteryCost, year: form.batteryYear! } }
        : {}),
    },
    electricity: tariff
      ? {
          kind: 'bill',
          tariff,
          otherUnitsPerMonth: form.otherUnits!,
          options: {
            sanctionedLoadKW: form.sanctionedLoadKW!,
            ppacRate: form.ppacRate ?? 0,
            subsidy: form.subsidyOptIn,
          },
        }
      : { kind: 'flat', pricePerUnit: form.pricePerUnit! },
    refunds: { state: inc.state, scrapping: inc.scrapping },
    petrolPriceRise: form.petrolPriceRise!,
    tariffRise: form.tariffRise!,
    interestRate: form.interestRate!,
  };
}

/** Example values, not any model's: a ₹95,000 petrol scooter at 45 km/L against a ₹1.3 lakh e-scooter. */
export const SCOOTER_EXAMPLE_VALUES = {
  monthlyKm: 750,
  years: 7,
  petrolPrice: 95_000,
  petrolMileage: 45,
  evPrice: 130_000,
  kmPerUnit: 30,
  batteryKWh: 3,
  otherUnits: 250,
  sanctionedLoadKW: 3,
} as const;

export const SCOOTER_EXAMPLE_KEYS = Object.keys(SCOOTER_EXAMPLE_VALUES) as ScooterNumberKey[];

const rise = defaults.scenarioVariables.energyPriceRise.values.base;

/** The example, at a petrol price (the city's verified one). */
export const scooterExampleForm = (fuelPrice: number | null): ScooterForm => ({
  ...SCOOTER_EXAMPLE_VALUES,
  fuelPrice,
  petrolUpkeep: null,
  evUpkeep: null,
  batteryCost: null,
  batteryYear: null,
  ppacRate: null,
  subsidyOptIn: true,
  pricePerUnit: null,
  claimState: true,
  scrapping: false,
  petrolPriceRise: rise,
  tariffRise: rise,
  interestRate: defaults.globalAssumptions.carLoanRate.value,
});
