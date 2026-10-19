/**
 * The solar tool's form. Every value that would need market or regulatory data starts empty
 * until the data files are verified; the user's own system and bill are always theirs to enter.
 * While the state's slab tariff is TODO_VERIFY, the user enters an average rate per unit and a
 * fixed monthly charge instead (see simpleTariff).
 */
import { verifiedSolarValue } from '@/data';
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
}

export const SOLAR_START_FORM: SolarForm = {
  systemKW: null,
  grossCost: null,
  subsidy: verifiedSolarValue('subsidy'),
  generationPerKWPerDay: verifiedSolarValue('generationPerKWPerDay'),
  degradationPerYear: verifiedSolarValue('degradationPerYear'),
  monthlyConsumptionKWh: null,
  averageRate: null,
  fixedCharge: null,
  sanctionedLoadKW: null,
  exportRatePerKWh: verifiedSolarValue('exportRatePerKWh'),
  // Conservative default: a flat tariff (the pessimistic row of the scenario table).
  tariffRisePerYear: 0,
  inverterYear: null,
  inverterCost: null,
  horizonYears: 25,
};

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
} as const satisfies Record<keyof SolarForm, { min: number; max: number }>;

/** Fields that may be left empty (empty means none / zero). */
const OPTIONAL: (keyof SolarForm)[] = [
  'subsidy',
  'fixedCharge',
  'sanctionedLoadKW',
  'exportRatePerKWh',
  'inverterYear',
  'inverterCost',
];

const num = (param: string, key: keyof SolarForm, integer = false) => ({
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
};

/** Fields that are missing or out of range, given whether a verified slab tariff exists. */
export function invalidSolarFields(form: SolarForm, hasSlabTariff: boolean): (keyof SolarForm)[] {
  const bad = (Object.keys(SOLAR_LIMITS) as (keyof SolarForm)[]).filter((key) => {
    if (hasSlabTariff && (key === 'averageRate' || key === 'fixedCharge')) return false;
    if (!hasSlabTariff && key === 'sanctionedLoadKW') return false;
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key) || (hasSlabTariff && key === 'sanctionedLoadKW');
    const { min, max } = SOLAR_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return (key === 'horizonYears' || key === 'inverterYear') && !Number.isInteger(v);
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
export function toSolarInput(form: SolarForm, slabTariff: Tariff | null): SolarInput | null {
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
  };
}
