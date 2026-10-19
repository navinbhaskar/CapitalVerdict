/**
 * Car fuel type: is the pricier but cheaper-to-run option (CNG, EV) worth its extra purchase price?
 *
 * Monthly simulation. Per option, per month:
 *   cost = monthlyKm / mileage × energyPrice(month) + annualUpkeep / 12
 * where energyPrice steps up once a year by annualPriceRise and upkeep stays flat (nominal).
 *
 * Saving = base cost − alternative cost, accumulated month by month.
 * Two break-even tests:
 *   - no interest:   cumulative saving ≥ extraPrice
 *   - with interest: cumulative saving ≥ extraPrice × (1 + r/12)^month
 * The with-interest test charges the extra price its borrowing/opportunity cost, but the monthly
 * savings themselves are not reinvested. This matches the spec's reference example.
 */
import { breakeven, cumulative } from '@/engine/breakeven';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { growthFactor, nominalToMonthly, yearlySteppedPrice } from '@/engine/timeValue';

export interface FuelOption {
  /** Distance per unit of energy: km/L, km/kg or km/kWh. */
  mileage: number;
  /** ₹ per unit of energy at the start (per L, kg or kWh). */
  energyPrice: number;
  /** Yearly rise in energyPrice, decimal. */
  annualPriceRise: number;
  /** Running cost per year beyond energy that this option adds, ₹ (flat, not escalated). */
  annualUpkeep: number;
}

export interface CarFuelInput {
  monthlyKm: number;
  horizonMonths: number;
  base: FuelOption;
  alternative: FuelOption;
  /** How much more the alternative costs to buy, ₹. */
  extraPrice: number;
  /** Annual rate charged on the extra price (loan or forgone return), nominal with monthly compounding. */
  interestRate: number;
}

export interface BreakevenDetail {
  /** First whole month in which the alternative has paid back. */
  months: number;
  /** Interpolated, for "≈25.3 months" style output. */
  fractionalMonths: number;
  /** Distance driven by `months`. */
  km: number;
  years: number;
}

export interface NetPosition {
  /** Cumulative saving − extra price. */
  noInterest: number;
  /** Cumulative saving − extra price grown at the interest rate. */
  withInterest: number;
}

export interface CarFuelResult {
  /** Energy cost per km in month 1, ₹. */
  costPerKm: { base: number; alternative: number };
  /** Saving in month 1, ₹ (energy + upkeep). */
  firstMonthSaving: number;
  /** Per month, index 0 = month 1. */
  monthlyCost: { base: number[]; alternative: number[] };
  /** Index = month, index 0 = start (0). */
  cumulativeSaving: number[];
  /** Index = month: extra price with interest accrued to that month. */
  extraPriceWithInterest: number[];
  breakevenNoInterest: BreakevenDetail | null;
  breakevenWithInterest: BreakevenDetail | null;
  /** null when the horizon is shorter than 5 / 10 years. */
  netAt5Years: NetPosition | null;
  netAt10Years: NetPosition | null;
  netAtHorizon: NetPosition;
}

function validate(input: CarFuelInput): void {
  const { monthlyKm, horizonMonths, base, alternative, extraPrice } = input;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1) {
    throw new RangeError('horizonMonths must be a positive whole number');
  }
  if (monthlyKm < 0) throw new RangeError('monthlyKm must not be negative');
  if (extraPrice < 0) throw new RangeError('extraPrice must not be negative');
  for (const option of [base, alternative]) {
    if (!(option.mileage > 0)) throw new RangeError('mileage must be positive');
    if (option.energyPrice < 0) throw new RangeError('energyPrice must not be negative');
  }
}

function monthlyCost(option: FuelOption, monthlyKm: number, month: number): number {
  const price = yearlySteppedPrice(option.energyPrice, option.annualPriceRise, month);
  return (monthlyKm / option.mileage) * price + option.annualUpkeep / 12;
}

export function compareCarFuel(input: CarFuelInput): CarFuelResult {
  validate(input);
  const { monthlyKm, horizonMonths, base, alternative, extraPrice, interestRate } = input;
  const r = nominalToMonthly(interestRate);

  const months = Array.from({ length: horizonMonths }, (_, i) => i + 1);
  const baseCost = months.map((m) => monthlyCost(base, monthlyKm, m));
  const altCost = months.map((m) => monthlyCost(alternative, monthlyKm, m));
  const cumulativeSaving = cumulative(baseCost.map((cost, i) => cost - altCost[i]!));
  const flatExtra = cumulativeSaving.map(() => extraPrice);
  const extraPriceWithInterest = cumulativeSaving.map((_, m) => extraPrice * growthFactor(r, m));

  const detail = (b: ReturnType<typeof breakeven>): BreakevenDetail | null =>
    b && {
      months: b.month,
      fractionalMonths: b.fractionalMonth,
      km: b.month * monthlyKm,
      years: b.month / 12,
    };

  const netAt = (month: number): NetPosition | null =>
    month > horizonMonths
      ? null
      : {
          noInterest: cumulativeSaving[month]! - extraPrice,
          withInterest: cumulativeSaving[month]! - extraPriceWithInterest[month]!,
        };

  return {
    costPerKm: {
      base: base.energyPrice / base.mileage,
      alternative: alternative.energyPrice / alternative.mileage,
    },
    firstMonthSaving: baseCost[0]! - altCost[0]!,
    monthlyCost: { base: baseCost, alternative: altCost },
    cumulativeSaving,
    extraPriceWithInterest,
    breakevenNoInterest: detail(breakeven(cumulativeSaving, flatExtra)),
    breakevenWithInterest: detail(breakeven(cumulativeSaving, extraPriceWithInterest)),
    netAt5Years: netAt(60),
    netAt10Years: netAt(120),
    netAtHorizon: netAt(horizonMonths)!,
  };
}

export type CarFuelVariable =
  'monthlyKm' | 'baseEnergyPrice' | 'alternativeEnergyPrice' | 'alternativeMileage';

export interface CarFuelFlip extends Flip {
  variable: CarFuelVariable;
}

/**
 * "What flips the answer": for each variable, the value at which the with-interest net position at
 * the horizon crosses zero, holding everything else. Positive net = the alternative wins.
 * Variables that cannot flip the answer within a plausible range are left out.
 */
export function carFuelFlips(input: CarFuelInput): CarFuelFlip[] {
  const net = (i: CarFuelInput) => compareCarFuel(i).netAtHorizon.withInterest;
  const { base, alternative } = input;

  const probes: {
    variable: CarFuelVariable;
    lo: number;
    hi: number;
    apply: (v: number) => CarFuelInput;
  }[] = [
    {
      variable: 'monthlyKm',
      lo: 0,
      hi: Math.max(10_000, input.monthlyKm * 3),
      apply: (v) => ({ ...input, monthlyKm: v }),
    },
    {
      variable: 'baseEnergyPrice',
      lo: 0,
      hi: base.energyPrice * 3,
      apply: (v) => ({ ...input, base: { ...base, energyPrice: v } }),
    },
    {
      variable: 'alternativeEnergyPrice',
      lo: 0,
      hi: alternative.energyPrice * 3,
      apply: (v) => ({ ...input, alternative: { ...alternative, energyPrice: v } }),
    },
    {
      variable: 'alternativeMileage',
      lo: alternative.mileage * 0.2,
      hi: alternative.mileage * 3,
      apply: (v) => ({ ...input, alternative: { ...alternative, mileage: v } }),
    },
  ];

  const flips: CarFuelFlip[] = [];
  for (const { variable, lo, hi, apply } of probes) {
    if (!(hi > lo)) continue;
    const flip = findFlip((v) => net(apply(v)), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}
