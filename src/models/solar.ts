/**
 * Rooftop solar payback.
 *
 * Monthly simulation over the horizon. Per month m:
 *   generation = kW × kWh-per-kW-per-day × (365 ÷ 12) × (1 − degradation)^(year − 1)
 *   bill without solar = tariff(consumption) × tariffFactor
 *   bill with solar    = max(tariff(max(consumption − generation, 0)) × tariffFactor − export credit,
 *                            fixed charges × tariffFactor)
 *   export credit      = max(generation − consumption, 0) × export rate   (flat, not escalated)
 *   saving             = bill without − bill with
 * tariffFactor steps up once a year by the tariff rise. Because each bill runs through the slab
 * tariff, units saved come off the highest slab first.
 *
 * Simplifications, stated on the page: units are netted month by month (no banking of exported
 * units across months), the export credit cannot push the bill below the fixed charges, and the
 * inverter replacement cost is in today's rupees.
 *
 * Where the state subsidises bills (Delhi), both bills run through the subsidy: solar can only
 * save what the visitor still pays. A state generation incentive (₹ per unit generated) counts as
 * a saving for the years it is paid. The tariff rise scales the whole bill, subsidy included.
 */
import { breakeven } from '@/engine/breakeven';
import { annualise, irr } from '@/engine/irr';
import { runScenarios } from '@/engine/scenarios';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { bill, type Tariff } from '@/engine/tariff';
import { growthFactor } from '@/engine/timeValue';

export const DAYS_PER_MONTH = 365 / 12;

export interface SolarInput {
  systemKW: number;
  /** Price of the installed system before subsidy, ₹. */
  grossCost: number;
  /** Subsidy received, ₹. */
  subsidy: number;
  generationPerKWPerDay: number;
  /** Decimal per year, e.g. 0.005. */
  degradationPerYear: number;
  monthlyConsumptionKWh: number;
  tariff: Tariff;
  sanctionedLoadKW: number;
  /** Yearly rise in the whole bill, decimal. */
  tariffRisePerYear: number;
  /** Credit per unit exported to the grid, ₹ (0 when there is none). */
  exportRatePerKWh: number;
  /** One inverter replacement, if any. */
  inverter: { year: number; cost: number } | null;
  horizonYears: number;
  /** PPAC and the state subsidy opt-in, passed to every bill. */
  billOptions?: { ppacRate?: number; subsidy?: boolean };
  /** A state payment per unit generated, for the first `years` years. */
  generationIncentive?: { perKWh: number; years: number } | null;
}

export interface SolarResult {
  netCost: number;
  /** Per month, index 0 = month 1. */
  generation: number[];
  billWithout: number[];
  billWith: number[];
  saving: number[];
  /** The generation incentive in each month's saving, ₹. */
  incentive: number[];
  exportedKWh: number[];
  /** Index = month, 0 = installation: savings so far minus net cost and any inverter spend. */
  cumulativeNet: number[];
  payback: { months: number; years: number } | null;
  netAtHorizon: number;
  firstYearSaving: number;
  /** Effective annual internal rate of return of the cash flows, null if it has none. */
  irr: number | null;
}

function validate(i: SolarInput): void {
  if (!Number.isInteger(i.horizonYears) || i.horizonYears < 1) {
    throw new RangeError('horizonYears must be a positive whole number');
  }
  for (const [name, v] of Object.entries({
    systemKW: i.systemKW,
    grossCost: i.grossCost,
    subsidy: i.subsidy,
    generationPerKWPerDay: i.generationPerKWPerDay,
    degradationPerYear: i.degradationPerYear,
    monthlyConsumptionKWh: i.monthlyConsumptionKWh,
    exportRatePerKWh: i.exportRatePerKWh,
  })) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (i.subsidy > i.grossCost) throw new RangeError('subsidy cannot exceed the system cost');
  if (i.inverter && (i.inverter.year < 1 || i.inverter.cost < 0)) {
    throw new RangeError('inverter replacement needs a year from 1 and a cost from 0');
  }
}

/**
 * `withIrr: false` skips the IRR search when only the net figures are needed (the sensitivity sweeps
 * run this hundreds of times).
 */
export function solarPayback(input: SolarInput, { withIrr = true } = {}): SolarResult {
  validate(input);
  const months = input.horizonYears * 12;
  const opts = { sanctionedLoadKW: input.sanctionedLoadKW, ...input.billOptions };
  const fixedOnly = bill(0, input.tariff, opts).total;
  const gi = input.generationIncentive;
  const withoutBase = bill(input.monthlyConsumptionKWh, input.tariff, opts).total;

  const generation: number[] = [];
  const billWithout: number[] = [];
  const billWith: number[] = [];
  const saving: number[] = [];
  const incentive: number[] = [];
  const exportedKWh: number[] = [];
  const netCost = input.grossCost - input.subsidy;
  const cumulativeNet = [-netCost];
  const flows = [-netCost];

  for (let m = 1; m <= months; m++) {
    const year = Math.floor((m - 1) / 12);
    const factor = growthFactor(input.tariffRisePerYear, year);
    const gen =
      input.systemKW *
      input.generationPerKWPerDay *
      DAYS_PER_MONTH *
      growthFactor(-input.degradationPerYear, year);
    const imported = Math.max(input.monthlyConsumptionKWh - gen, 0);
    const exported = Math.max(gen - input.monthlyConsumptionKWh, 0);
    const without = withoutBase * factor;
    const withSolar = Math.max(
      bill(imported, input.tariff, opts).total * factor - exported * input.exportRatePerKWh,
      fixedOnly * factor,
    );
    const paid = gi && year < gi.years ? gen * gi.perKWh : 0;
    const save = without - withSolar + paid;
    const inverterSpend =
      input.inverter && m === input.inverter.year * 12 ? input.inverter.cost : 0;

    generation.push(gen);
    billWithout.push(without);
    billWith.push(withSolar);
    saving.push(save);
    incentive.push(paid);
    exportedKWh.push(exported);
    cumulativeNet.push(cumulativeNet[m - 1]! + save - inverterSpend);
    flows.push(save - inverterSpend);
  }

  const be = breakeven(
    cumulativeNet,
    cumulativeNet.map(() => 0),
  );
  const monthlyIrr = withIrr ? irr(flows) : null;

  return {
    netCost,
    generation,
    billWithout,
    billWith,
    saving,
    incentive,
    exportedKWh,
    cumulativeNet,
    payback: be && { months: be.month, years: be.month / 12 },
    netAtHorizon: cumulativeNet[months]!,
    firstYearSaving: saving.slice(0, 12).reduce((a, b) => a + b, 0),
    irr: monthlyIrr === null ? null : annualise(monthlyIrr),
  };
}

export interface SolarScenarioRates {
  pessimistic: number;
  base: number;
  optimistic: number;
}

/** The same system with the tariff rising 0% / 3% / 5% a year (from the default table). */
export function solarScenarios(input: SolarInput, rates: SolarScenarioRates) {
  return runScenarios(solarPayback, input, {
    pessimistic: { tariffRisePerYear: rates.pessimistic },
    base: { tariffRisePerYear: rates.base },
    optimistic: { tariffRisePerYear: rates.optimistic },
  });
}

export type SolarVariable = 'generationPerKWPerDay' | 'tariffRisePerYear' | 'netCost';

export interface SolarFlip extends Flip {
  variable: SolarVariable;
}

/** Where the net position at the horizon crosses zero, one input at a time. */
export function solarFlips(input: SolarInput): SolarFlip[] {
  const net = (i: SolarInput) => solarPayback(i, { withIrr: false }).netAtHorizon;
  const now = solarPayback(input, { withIrr: false });
  // Search net cost up to well past the lifetime savings, so a break-even cost is always in range.
  const lifetimeSavings = now.netAtHorizon + now.netCost + (input.inverter?.cost ?? 0);
  const probes: {
    variable: SolarVariable;
    lo: number;
    hi: number;
    apply: (v: number) => SolarInput;
  }[] = [
    {
      variable: 'generationPerKWPerDay',
      lo: 0.1,
      hi: Math.max(8, input.generationPerKWPerDay * 2),
      apply: (v) => ({ ...input, generationPerKWPerDay: v }),
    },
    {
      variable: 'tariffRisePerYear',
      lo: 0,
      hi: 0.15,
      apply: (v) => ({ ...input, tariffRisePerYear: v }),
    },
    {
      variable: 'netCost',
      lo: 0,
      hi: Math.max(input.grossCost * 3, lifetimeSavings * 1.5, 1),
      apply: (v) => ({ ...input, grossCost: v + input.subsidy }),
    },
  ];
  const flips: SolarFlip[] = [];
  for (const { variable, lo, hi, apply } of probes) {
    const flip = findFlip((v) => net(apply(v)), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}
