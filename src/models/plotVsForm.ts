/**
 * The plot vs FD vs mutual fund form. The plot's price and costs, the FD rate and the visitor's tax
 * rate are their own (stamp duty fills in once the state rate is verified). Plot price growth and
 * the fund's return start at the base row of the default scenario table; inflation likewise.
 */
import { defaults, verifiedStampDuty } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { PlotVsInput } from './plotVs';

export interface PlotVsForm {
  plotPrice: number | null;
  stampDuty: number | null;
  otherBuyCosts: number | null;
  yearlyCost: number | null;
  plotGrowth: number | null;
  sellingCost: number | null;
  fdRate: number | null;
  taxRate: number | null;
  fundReturn: number | null;
  years: number | null;
  inflation: number | null;
}

const table = defaults.scenarioVariables;

export const PLOT_VS_START_FORM: PlotVsForm = {
  plotPrice: null,
  stampDuty: verifiedStampDuty(),
  otherBuyCosts: null,
  yearlyCost: null,
  plotGrowth: table.propertyAppreciation.values.base,
  sellingCost: null,
  fdRate: defaults.globalAssumptions.fdRate.value,
  taxRate: null,
  fundReturn: table.equityReturnNominal.values.base,
  years: 10,
  inflation: table.inflation.values.base,
};

export const PLOT_VS_LIMITS = {
  plotPrice: { min: 1, max: 50_00_00_000 },
  stampDuty: { min: 0, max: 0.2 },
  otherBuyCosts: { min: 0, max: 5_00_00_000 },
  yearlyCost: { min: 0, max: 50_00_000 },
  plotGrowth: { min: -0.1, max: 0.3 },
  sellingCost: { min: 0, max: 0.2 },
  fdRate: { min: 0, max: 0.2 },
  taxRate: { min: 0, max: 0.45 },
  fundReturn: { min: 0, max: 0.3 },
  years: { min: 3, max: 40 },
  inflation: { min: 0, max: 0.2 },
} as const satisfies Record<keyof PlotVsForm, { min: number; max: number }>;

/** May be left empty; empty means zero. */
const OPTIONAL: (keyof PlotVsForm)[] = ['otherBuyCosts', 'yearlyCost'];
const INTEGER: (keyof PlotVsForm)[] = ['years'];

const num = (param: string, key: keyof PlotVsForm) => ({
  param,
  type: 'number' as const,
  ...PLOT_VS_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const plotVsShareSchema: ShareSchema<PlotVsForm> = {
  plotPrice: num('pp', 'plotPrice'),
  stampDuty: num('sd', 'stampDuty'),
  otherBuyCosts: num('ob', 'otherBuyCosts'),
  yearlyCost: num('yc', 'yearlyCost'),
  plotGrowth: num('pg', 'plotGrowth'),
  sellingCost: num('sc', 'sellingCost'),
  fdRate: num('fd', 'fdRate'),
  taxRate: num('tax', 'taxRate'),
  fundReturn: num('mf', 'fundReturn'),
  years: num('y', 'years'),
  inflation: num('inf', 'inflation'),
};

export function invalidPlotVsFields(form: PlotVsForm): (keyof PlotVsForm)[] {
  return (Object.keys(PLOT_VS_LIMITS) as (keyof PlotVsForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = PLOT_VS_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
}

export function toPlotVsInput(form: PlotVsForm): PlotVsInput | null {
  if (invalidPlotVsFields(form).length > 0) return null;
  return {
    plotPrice: form.plotPrice!,
    stampDuty: form.stampDuty!,
    otherBuyCosts: form.otherBuyCosts ?? 0,
    yearlyCost: form.yearlyCost ?? 0,
    plotGrowth: form.plotGrowth!,
    sellingCost: form.sellingCost!,
    fdRate: form.fdRate!,
    taxRate: form.taxRate!,
    fundReturn: form.fundReturn!,
    years: form.years!,
    inflation: form.inflation!,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data; 7% stamp duty matches the rent vs buy example.
 */
export const PLOT_VS_EXAMPLE_VALUES = {
  plotPrice: 2_000_000,
  stampDuty: 0.07,
  otherBuyCosts: 20_000,
  yearlyCost: 5_000,
  sellingCost: 0.02,
  fdRate: 0.07,
  taxRate: 0.312,
} as const satisfies Partial<Record<keyof PlotVsForm, number>>;

export const PLOT_VS_EXAMPLE_FORM: PlotVsForm = {
  ...PLOT_VS_START_FORM,
  ...PLOT_VS_EXAMPLE_VALUES,
};

export const PLOT_VS_EXAMPLE_KEYS = Object.keys(PLOT_VS_EXAMPLE_VALUES) as (keyof PlotVsForm)[];
