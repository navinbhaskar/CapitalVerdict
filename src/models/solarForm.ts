/**
 * The solar tool's form. Every value that would need market or regulatory data starts empty
 * until the data files are verified; the user's own system and bill are always theirs to enter.
 * While the state's slab tariff is TODO_VERIFY, the user enters an average rate per unit and a
 * fixed monthly charge instead (see simpleTariff). The state follows the visitor's city: Delhi's
 * verified figures (tariff, subsidy by system size, output) fill in; UP's are still to verify.
 */
import { generationIncentiveFor, solarSubsidyFor, verifiedSolarValue, type StateId } from '@/data';
import { simpleTariff, type Tariff } from '@/engine/tariff';
import type { ShareSchema } from '@/lib/shareLink';
import type { SolarInput } from './solar';

export interface SolarForm {
  systemKW: number | null;
  grossCost: number | null;
  subsidy: number | null;
  generationPerKWPerDay: number | null;
  degradationPerYear: number | null;
  monthlyConsumptionKWh: number | null;
  /** Used only while the slab tariff is unverified. */
  averageRate: number | null;
  fixedCharge: number | null;
  sanctionedLoadKW: number | null;
  exportRatePerKWh: number | null;
  tariffRisePerYear: number | null;
  inverterYear: number | null;
  inverterCost: number | null;
  horizonYears: number | null;
  /** PPAC on the visitor's bill, decimal; empty means none. */
  ppacRate: number | null;
  /** Years the state's generation incentive is paid; empty means it is not counted. */
  gbiYears: number | null;
  /** Opted in to the state's bill subsidy (where there is one). */
  subsidyOptIn: boolean;
}

export type SolarNumberKey = Exclude<keyof SolarForm, 'subsidyOptIn'>;

/** The form before the visitor types anything, with the state's verified figures. */
export const solarStartForm = (state: StateId): SolarForm => ({
  systemKW: null,
  grossCost: null,
  subsidy: verifiedSolarValue('subsidy', state),
  generationPerKWPerDay: verifiedSolarValue('generationPerKWPerDay', state),
  degradationPerYear: verifiedSolarValue('degradationPerYear', state),
  monthlyConsumptionKWh: null,
  averageRate: null,
  fixedCharge: null,
  sanctionedLoadKW: null,
  exportRatePerKWh: verifiedSolarValue('exportRatePerKWh', state),
  // Conservative default: a flat tariff (the pessimistic row of the scenario table).
  tariffRisePerYear: 0,
  inverterYear: null,
  inverterCost: null,
  horizonYears: 25,
  ppacRate: null,
  gbiYears: null,
  subsidyOptIn: true,
});
export const SOLAR_START_FORM = solarStartForm('UP');

export const SOLAR_LIMITS = {
  systemKW: { min: 0.5, max: 50 },
  grossCost: { min: 1, max: 50_00_000 },
  subsidy: { min: 0, max: 50_00_000 },
  generationPerKWPerDay: { min: 0.5, max: 8 },
  degradationPerYear: { min: 0, max: 0.05 },
  monthlyConsumptionKWh: { min: 1, max: 10_000 },
  averageRate: { min: 0.5, max: 30 },
  fixedCharge: { min: 0, max: 5_000 },
  sanctionedLoadKW: { min: 1, max: 100 },
  exportRatePerKWh: { min: 0, max: 30 },
  tariffRisePerYear: { min: 0, max: 0.15 },
  inverterYear: { min: 1, max: 30 },
  inverterCost: { min: 0, max: 10_00_000 },
  horizonYears: { min: 5, max: 30 },
  ppacRate: { min: 0, max: 1 },
  gbiYears: { min: 1, max: 30 },
} as const satisfies Record<SolarNumberKey, { min: number; max: number }>;

/** Fields that may be left empty (empty means none / zero). */
const OPTIONAL: SolarNumberKey[] = [
  'subsidy',
  'fixedCharge',
  'sanctionedLoadKW',
  'exportRatePerKWh',
  'inverterYear',
  'inverterCost',
  'ppacRate',
  'gbiYears',
];

const num = (param: string, key: SolarNumberKey, integer = false) => ({
  param,
  type: 'number' as const,
  ...SOLAR_LIMITS[key],
  integer,
});

export const solarShareSchema: ShareSchema<SolarForm> = {
  systemKW: num('kw', 'systemKW'),
  grossCost: num('c', 'grossCost'),
  subsidy: num('s', 'subsidy'),
  generationPerKWPerDay: num('g', 'generationPerKWPerDay'),
  degradationPerYear: num('d', 'degradationPerYear'),
  monthlyConsumptionKWh: num('u', 'monthlyConsumptionKWh'),
  averageRate: num('rate', 'averageRate'),
  fixedCharge: num('fc', 'fixedCharge'),
  sanctionedLoadKW: num('load', 'sanctionedLoadKW'),
  exportRatePerKWh: num('ex', 'exportRatePerKWh'),
  tariffRisePerYear: num('tr', 'tariffRisePerYear'),
  inverterYear: num('iy', 'inverterYear', true),
  inverterCost: num('ic', 'inverterCost'),
  horizonYears: num('y', 'horizonYears', true),
  ppacRate: num('ppac', 'ppacRate'),
  gbiYears: num('gbi', 'gbiYears', true),
  subsidyOptIn: { param: 'sub', type: 'boolean' },
};

/** Fields that are missing or out of range, given whether a verified slab tariff exists. */
export function invalidSolarFields(form: SolarForm, hasSlabTariff: boolean): SolarNumberKey[] {
  const bad = (Object.keys(SOLAR_LIMITS) as SolarNumberKey[]).filter((key) => {
    if (hasSlabTariff && (key === 'averageRate' || key === 'fixedCharge')) return false;
    if (!hasSlabTariff && key === 'sanctionedLoadKW') return false;
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key) || (hasSlabTariff && key === 'sanctionedLoadKW');
    const { min, max } = SOLAR_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return (
      (key === 'horizonYears' || key === 'inverterYear' || key === 'gbiYears') &&
      !Number.isInteger(v)
    );
  });
  // Inverter replacement needs both a year and a cost, or neither.
  if ((form.inverterYear === null) !== (form.inverterCost === null)) {
    bad.push(form.inverterYear === null ? 'inverterYear' : 'inverterCost');
  }
  if (form.subsidy !== null && form.grossCost !== null && form.subsidy > form.grossCost) {
    bad.push('subsidy');
  }
  return [...new Set(bad)];
}

/** SolarInput for a complete form; null while anything required is missing. */
export function toSolarInput(
  form: SolarForm,
  slabTariff: Tariff | null,
  state: StateId = 'UP',
): SolarInput | null {
  if (invalidSolarFields(form, slabTariff !== null).length > 0) return null;
  const tariff = slabTariff ?? simpleTariff(form.averageRate!, form.fixedCharge ?? 0);
  return {
    systemKW: form.systemKW!,
    grossCost: form.grossCost!,
    subsidy: form.subsidy ?? 0,
    generationPerKWPerDay: form.generationPerKWPerDay!,
    degradationPerYear: form.degradationPerYear!,
    monthlyConsumptionKWh: form.monthlyConsumptionKWh!,
    tariff,
    sanctionedLoadKW: form.sanctionedLoadKW ?? form.systemKW!,
    tariffRisePerYear: form.tariffRisePerYear!,
    exportRatePerKWh: form.exportRatePerKWh ?? 0,
    inverter:
      form.inverterYear !== null && form.inverterCost !== null
        ? { year: form.inverterYear, cost: form.inverterCost }
        : null,
    horizonYears: form.horizonYears!,
    billOptions: { ppacRate: form.ppacRate ?? 0, subsidy: form.subsidyOptIn },
    generationIncentive: incentive(form, state),
  };
}

/** The state's generation incentive for this system, counted only for the years entered. */
function incentive(form: SolarForm, state: StateId): SolarInput['generationIncentive'] {
  const perKWh = form.systemKW === null ? null : generationIncentiveFor(state, form.systemKW);
  return perKWh !== null && form.gbiYears !== null ? { perKWh, years: form.gbiYears } : null;
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data; the same case as the solar blog post.
 * Values that are verified in the data files win over these, and where the subsidy is set by
 * system size (Delhi) it is worked out for the example's size.
 */
const SOLAR_EXAMPLE_VALUES: Partial<Record<SolarNumberKey, number>> = {
  systemKW: 3,
  grossCost: 180_000,
  subsidy: 0,
  monthlyConsumptionKWh: 300,
  averageRate: 7,
  sanctionedLoadKW: 3,
  generationPerKWPerDay: 4,
  degradationPerYear: 0.005,
};

/** The fields that still show an example (not a verified figure) in this state. */
export function solarExampleKeys(state: StateId): SolarNumberKey[] {
  const start = solarStartForm(state);
  const sized = solarSubsidyFor(state, SOLAR_EXAMPLE_VALUES.systemKW!) !== null;
  return (Object.keys(SOLAR_EXAMPLE_VALUES) as SolarNumberKey[]).filter(
    (key) => start[key] === null && !(key === 'subsidy' && sized),
  );
}

export function solarExampleForm(state: StateId): SolarForm {
  const kW = SOLAR_EXAMPLE_VALUES.systemKW!;
  const sizedSubsidy = solarSubsidyFor(state, kW);
  return {
    ...solarStartForm(state),
    ...Object.fromEntries(solarExampleKeys(state).map((key) => [key, SOLAR_EXAMPLE_VALUES[key]])),
    ...(sizedSubsidy !== null ? { subsidy: sizedSubsidy } : {}),
  };
}

export const SOLAR_EXAMPLE_KEYS = solarExampleKeys('UP');
export const SOLAR_EXAMPLE_FORM: SolarForm = solarExampleForm('UP');
