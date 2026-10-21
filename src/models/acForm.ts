/**
 * The AC payback form. Prices and label units are the visitor's own (from the shop and the star
 * labels), and so is the price per unit until the state tariff is verified. Usage starts at the
 * label's own assumption, the tariff rise at the base row of the scenario table, and the interest
 * on the extra price at the car-loan default, as in the car fuel tool.
 */
import { defaults } from '@/data';
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
}

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
} as const satisfies Record<keyof AcForm, { min: number; max: number }>;

const INTEGER: (keyof AcForm)[] = ['years'];

const num = (param: string, key: keyof AcForm) => ({
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
};

export function invalidAcFields(form: AcForm): (keyof AcForm)[] {
  return (Object.keys(AC_LIMITS) as (keyof AcForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return true;
    const { min, max } = AC_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
}

export function toAcInput(form: AcForm): AcInput | null {
  if (invalidAcFields(form).length > 0) return null;
  return {
    basicPrice: form.basicPrice!,
    efficientPrice: form.efficientPrice!,
    basicUnits: form.basicUnits!,
    efficientUnits: form.efficientUnits!,
    usage: form.usage!,
    pricePerUnit: form.pricePerUnit!,
    tariffRise: form.tariffRise!,
    interestRate: form.interestRate!,
    years: form.years!,
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
} as const satisfies Partial<Record<keyof AcForm, number>>;

export const AC_EXAMPLE_FORM: AcForm = { ...AC_START_FORM, ...AC_EXAMPLE_VALUES };

export const AC_EXAMPLE_KEYS = Object.keys(AC_EXAMPLE_VALUES) as (keyof AcForm)[];
