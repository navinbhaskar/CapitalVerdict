/**
 * The AC payback form. Prices and label units are the visitor's own (from the shop and the star
 * labels), and so is the price per unit until the state tariff is verified. Usage starts at the
 * label's own assumption, the tariff rise at the base row of the scenario table, and the interest
 * on the extra price at the car-loan default, as in the car fuel tool.
 *
 * Where the state's tariff is verified (Delhi), the saving comes from two real bills instead of a
 * price per unit: the visitor gives the rest of the home's monthly units and the sanctioned load,
 * and whether they have opted in to the state subsidy.
 */
import { defaults } from '@/data';
import type { Tariff } from '@/engine/tariff';
import type { ShareSchema } from '@/lib/shareLink';
import type { AcInput } from './ac';

export interface AcForm {
  basicPrice: number | null;
  efficientPrice: number | null;
  basicUnits: number | null;
  efficientUnits: number | null;
  usage: number | null;
  pricePerUnit: number | null;
  tariffRise: number | null;
  interestRate: number | null;
  years: number | null;
  /** On a real bill: the home's other units a month, without this AC. */
  otherUnits: number | null;
  sanctionedLoadKW: number | null;
  /** PPAC on the bill, decimal; empty means none. */
  ppacRate: number | null;
  subsidyOptIn: boolean;
}

export type AcNumberKey = Exclude<keyof AcForm, 'subsidyOptIn'>;

export const AC_START_FORM: AcForm = {
  basicPrice: null,
  efficientPrice: null,
  basicUnits: null,
  efficientUnits: null,
  usage: 1,
  pricePerUnit: null,
  tariffRise: defaults.scenarioVariables.energyPriceRise.values.base,
  interestRate: defaults.globalAssumptions.carLoanRate.value,
  years: 10,
  otherUnits: null,
  sanctionedLoadKW: null,
  ppacRate: null,
  subsidyOptIn: true,
};

export const AC_LIMITS = {
  basicPrice: { min: 1, max: 10_00_000 },
  efficientPrice: { min: 1, max: 10_00_000 },
  basicUnits: { min: 1, max: 20_000 },
  efficientUnits: { min: 1, max: 20_000 },
  usage: { min: 0.05, max: 4 },
  pricePerUnit: { min: 0.5, max: 30 },
  tariffRise: { min: 0, max: 0.2 },
  interestRate: { min: 0, max: 0.3 },
  years: { min: 1, max: 20 },
  otherUnits: { min: 0, max: 10_000 },
  sanctionedLoadKW: { min: 1, max: 100 },
  ppacRate: { min: 0, max: 1 },
} as const satisfies Record<AcNumberKey, { min: number; max: number }>;

const INTEGER: AcNumberKey[] = ['years'];

const num = (param: string, key: AcNumberKey) => ({
  param,
  type: 'number' as const,
  ...AC_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const acShareSchema: ShareSchema<AcForm> = {
  basicPrice: num('bp', 'basicPrice'),
  efficientPrice: num('ep', 'efficientPrice'),
  basicUnits: num('bu', 'basicUnits'),
  efficientUnits: num('eu', 'efficientUnits'),
  usage: num('use', 'usage'),
  pricePerUnit: num('rate', 'pricePerUnit'),
  tariffRise: num('rise', 'tariffRise'),
  interestRate: num('ir', 'interestRate'),
  years: num('y', 'years'),
  otherUnits: num('ou', 'otherUnits'),
  sanctionedLoadKW: num('load', 'sanctionedLoadKW'),
  ppacRate: num('ppac', 'ppacRate'),
  subsidyOptIn: { param: 'sub', type: 'boolean' },
};

/** The fields a form needs: a price per unit, or (on a real tariff) the home's other units and load. */
function needed(onTariff: boolean): Set<AcNumberKey> {
  const keys = new Set(Object.keys(AC_LIMITS) as AcNumberKey[]);
  keys.delete('ppacRate');
  if (onTariff) keys.delete('pricePerUnit');
  else {
    keys.delete('otherUnits');
    keys.delete('sanctionedLoadKW');
  }
  return keys;
}

export function invalidAcFields(form: AcForm, onTariff = false): AcNumberKey[] {
  const required = needed(onTariff);
  return (Object.keys(AC_LIMITS) as AcNumberKey[]).filter((key) => {
    const v = form[key];
    if (v === null) return required.has(key);
    if (!required.has(key) && key !== 'ppacRate') return false;
    const { min, max } = AC_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
}

export function toAcInput(form: AcForm, tariff: Tariff | null = null): AcInput | null {
  if (invalidAcFields(form, tariff !== null).length > 0) return null;
  return {
    basicPrice: form.basicPrice!,
    efficientPrice: form.efficientPrice!,
    basicUnits: form.basicUnits!,
    efficientUnits: form.efficientUnits!,
    usage: form.usage!,
    tariffRise: form.tariffRise!,
    interestRate: form.interestRate!,
    years: form.years!,
    pricePerUnit: tariff ? 0 : form.pricePerUnit!,
    ...(tariff
      ? {
          bill: {
            tariff,
            otherUnitsPerMonth: form.otherUnits!,
            options: {
              sanctionedLoadKW: form.sanctionedLoadKW!,
              ppacRate: form.ppacRate ?? 0,
              subsidy: form.subsidyOptIn,
            },
          },
        }
      : {}),
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not prices or label figures for any real model.
 */
export const AC_EXAMPLE_VALUES = {
  basicPrice: 35_000,
  efficientPrice: 45_000,
  basicUnits: 1_100,
  efficientUnits: 750,
  pricePerUnit: 7,
  otherUnits: 250,
  sanctionedLoadKW: 3,
} as const satisfies Partial<Record<AcNumberKey, number>>;

export const AC_EXAMPLE_FORM: AcForm = { ...AC_START_FORM, ...AC_EXAMPLE_VALUES };

export const AC_EXAMPLE_KEYS = Object.keys(AC_EXAMPLE_VALUES) as AcNumberKey[];
