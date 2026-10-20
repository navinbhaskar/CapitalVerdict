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
import { runScenarios } from '@/engine/scenarios';
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
  /** A single cost in one month, e.g. an EV battery or a CNG cylinder, ₹ (month 1 = first month). */
  oneOff?: { month: number; amount: number };
}

export interface CarFuelInput {
  monthlyKm: number;
  horizonMonths: number;
  base: FuelOption;
  alternative: FuelOption;
  /**
   * How much more the alternative costs to buy, ₹. Negative when the alternative is cheaper to buy
   * (use carFuelVerdict for the headline in that case).
   */
  extraPrice: number;
  /**
   * On-road price of each car, ₹. Optional: only needed for total cost of ownership. When given,
   * extraPrice must equal alternative − base.
   */
  purchasePrices?: { base: number; alternative: number };
  /** Annual rate charged on the extra price (loan or forgone return), nominal with monthly compounding. */
  interestRate: number;
  /**
   * What each car sells for at the end of the horizon, ₹. Counted only at the horizon: it changes
   * the net position and total cost then, not the break-even month (savings must earn that).
   */
  resale?: { base: number; alternative: number };
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
  /** Energy price per unit in each month, index 0 = month 1. */
  monthlyPrice: { base: number[]; alternative: number[] };
  /** Index = month, index 0 = start (0). */
  cumulativeSaving: number[];
  /**
   * Total cost of owning each car by month (index = month, 0 = purchase): on-road price grown at the
   * interest rate plus fuel and upkeep paid so far. null without purchasePrices.
   * base − alternative at any month equals the with-interest net position.
   */
  totalCost: { base: number[]; alternative: number[] } | null;
  /** Fuel and upkeep paid so far, by month (index 0 = 0). */
  cumulativeRunningCost: { base: number[]; alternative: number[] };
  /** Index = month: extra price with interest accrued to that month. */
  extraPriceWithInterest: number[];
  breakevenNoInterest: BreakevenDetail | null;
  breakevenWithInterest: BreakevenDetail | null;
  /** null when the horizon is shorter than 5 / 10 years. */
  netAt5Years: NetPosition | null;
  netAt10Years: NetPosition | null;
  /** Includes the resale gap. */
  netAtHorizon: NetPosition;
  /** Alternative's resale − base's resale, ₹ (0 without resale). */
  resaleGap: number;
}

function validate(input: CarFuelInput): void {
  const { monthlyKm, horizonMonths, base, alternative, extraPrice } = input;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1) {
    throw new RangeError('horizonMonths must be a positive whole number');
  }
  if (monthlyKm < 0) throw new RangeError('monthlyKm must not be negative');
  if (!Number.isFinite(extraPrice)) throw new RangeError('extraPrice must be a number');
  const prices = input.purchasePrices;
  if (prices) {
    if (!(prices.base >= 0 && prices.alternative >= 0)) {
      throw new RangeError('purchase prices must not be negative');
    }
    if (Math.abs(prices.alternative - prices.base - extraPrice) > 1e-6) {
      throw new RangeError('extraPrice must equal the difference of the purchase prices');
    }
  }
  for (const option of [base, alternative]) {
    if (!(option.mileage > 0)) throw new RangeError('mileage must be positive');
    if (option.energyPrice < 0) throw new RangeError('energyPrice must not be negative');
    const once = option.oneOff;
    if (once && !(Number.isInteger(once.month) && once.month >= 1 && once.amount >= 0)) {
      throw new RangeError('oneOff needs a whole month from 1 and an amount of 0 or more');
    }
  }
  const resale = input.resale;
  if (resale && !(resale.base >= 0 && resale.alternative >= 0)) {
    throw new RangeError('resale must not be negative');
  }
}

function monthlyCost(option: FuelOption, monthlyKm: number, month: number): number {
  const price = yearlySteppedPrice(option.energyPrice, option.annualPriceRise, month);
  const once = option.oneOff?.month === month ? option.oneOff.amount : 0;
  return (monthlyKm / option.mileage) * price + option.annualUpkeep / 12 + once;
}

export function compareCarFuel(input: CarFuelInput): CarFuelResult {
  validate(input);
  const { monthlyKm, horizonMonths, base, alternative, extraPrice, interestRate } = input;
  const r = nominalToMonthly(interestRate);

  const months = Array.from({ length: horizonMonths }, (_, i) => i + 1);
  const basePrice = months.map((m) =>
    yearlySteppedPrice(base.energyPrice, base.annualPriceRise, m),
  );
  const altPrice = months.map((m) =>
    yearlySteppedPrice(alternative.energyPrice, alternative.annualPriceRise, m),
  );
  const baseCost = months.map((m) => monthlyCost(base, monthlyKm, m));
  const altCost = months.map((m) => monthlyCost(alternative, monthlyKm, m));
  const cumulativeSaving = cumulative(baseCost.map((cost, i) => cost - altCost[i]!));
  const flatExtra = cumulativeSaving.map(() => extraPrice);
  const growth = cumulativeSaving.map((_, m) => growthFactor(r, m));
  const cumulativeRunningCost = { base: cumulative(baseCost), alternative: cumulative(altCost) };
  const prices = input.purchasePrices;
  const resale = input.resale ?? { base: 0, alternative: 0 };
  const resaleGap = resale.alternative - resale.base;
  // Resale comes back only when the car is sold, at the horizon.
  const sold = (m: number, amount: number) => (m === horizonMonths ? amount : 0);
  const totalCost = prices
    ? {
        base: growth.map(
          (g, m) => prices.base * g + cumulativeRunningCost.base[m]! - sold(m, resale.base),
        ),
        alternative: growth.map(
          (g, m) =>
            prices.alternative * g +
            cumulativeRunningCost.alternative[m]! -
            sold(m, resale.alternative),
        ),
      }
    : null;
  const extraPriceWithInterest = growth.map((g) => extraPrice * g);

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
          noInterest: cumulativeSaving[month]! - extraPrice + sold(month, resaleGap),
          withInterest:
            cumulativeSaving[month]! - extraPriceWithInterest[month]! + sold(month, resaleGap),
        };

  return {
    costPerKm: {
      base: base.energyPrice / base.mileage,
      alternative: alternative.energyPrice / alternative.mileage,
    },
    firstMonthSaving: baseCost[0]! - altCost[0]!,
    monthlyCost: { base: baseCost, alternative: altCost },
    monthlyPrice: { base: basePrice, alternative: altPrice },
    cumulativeSaving,
    totalCost,
    cumulativeRunningCost,
    extraPriceWithInterest,
    breakevenNoInterest: detail(breakeven(cumulativeSaving, flatExtra)),
    breakevenWithInterest: detail(breakeven(cumulativeSaving, extraPriceWithInterest)),
    netAt5Years: netAt(60),
    netAt10Years: netAt(120),
    netAtHorizon: netAt(horizonMonths)!,
    resaleGap,
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
export function carFuelFlips(input: CarFuelInput, only?: CarFuelVariable[]): CarFuelFlip[] {
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
    if (only && !only.includes(variable)) continue;
    if (!(hi > lo)) continue;
    const flip = findFlip((v) => net(apply(v)), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}

export interface CarFuelScenarioRates {
  pessimistic: number;
  base: number;
  optimistic: number;
}

/**
 * Price-rise scenarios: the same comparison with both fuels' yearly price rise set to each rate
 * from the default scenario table. Equal rises widen the rupee gap between a cheaper and a dearer
 * fuel, so the lowest rise is the pessimistic case for the cheaper-to-run option.
 * These sit beside the user's own result; they do not replace it.
 */
export function carFuelScenarios(input: CarFuelInput, rates: CarFuelScenarioRates) {
  const withRise = (rise: number): Partial<CarFuelInput> => ({
    base: { ...input.base, annualPriceRise: rise },
    alternative: { ...input.alternative, annualPriceRise: rise },
  });
  return runScenarios(compareCarFuel, input, {
    pessimistic: withRise(rates.pessimistic),
    base: withRise(rates.base),
    optimistic: withRise(rates.optimistic),
  });
}

export type CarFuelVerdict =
  /** The dearer car earns back its extra price within the horizon. */
  | { kind: 'payback'; payer: 'base' | 'alternative'; months: number; km: number }
  /** The dearer car never earns back its extra price; the cheaper one wins over the horizon. */
  | { kind: 'never'; winner: 'base' | 'alternative' }
  /** Savings never earn back the extra price, but the dearer car's higher resale puts it ahead. */
  | { kind: 'resale'; winner: 'base' | 'alternative' }
  /** One car costs no more to buy and less to run: it wins from day one. */
  | { kind: 'dominant'; winner: 'base' | 'alternative' }
  /** Same price and same running cost. */
  | { kind: 'tie' };

/** Swap the two options so the dearer car is always the "alternative". */
export function swapOptions(input: CarFuelInput): CarFuelInput {
  return {
    ...input,
    base: input.alternative,
    alternative: input.base,
    extraPrice: -input.extraPrice,
    purchasePrices: input.purchasePrices && {
      base: input.purchasePrices.alternative,
      alternative: input.purchasePrices.base,
    },
    resale: input.resale && { base: input.resale.alternative, alternative: input.resale.base },
  };
}

/**
 * Headline answer. The break-even question is always asked of the car that costs more to buy:
 * does its lower running cost earn back the difference (with interest) within the horizon?
 * Returns the verdict and the comparison it was based on (swapped when petrol is the dearer car).
 */
export function carFuelVerdict(input: CarFuelInput): {
  verdict: CarFuelVerdict;
  /** Comparison with the dearer car as the alternative. */
  basis: CarFuelResult;
  swapped: boolean;
} {
  const swapped = input.extraPrice < 0;
  const basisInput = swapped ? swapOptions(input) : input;
  const basis = compareCarFuel(basisInput);
  const dearer = swapped ? 'base' : 'alternative';
  const cheaper = swapped ? 'alternative' : 'base';
  const saving = basis.firstMonthSaving;

  if (basisInput.extraPrice === 0) {
    if (Math.abs(saving) < 1e-9) return { verdict: { kind: 'tie' }, basis, swapped };
    return {
      verdict: { kind: 'dominant', winner: saving > 0 ? dearer : cheaper },
      basis,
      swapped,
    };
  }
  const be = basis.breakevenWithInterest;
  if (be)
    return {
      verdict: { kind: 'payback', payer: dearer, months: be.months, km: be.km },
      basis,
      swapped,
    };
  if (basis.netAtHorizon.withInterest > 0) {
    return { verdict: { kind: 'resale', winner: dearer }, basis, swapped };
  }
  if (saving <= 0) return { verdict: { kind: 'dominant', winner: cheaper }, basis, swapped };
  return { verdict: { kind: 'never', winner: cheaper }, basis, swapped };
}

export interface CarSetEntry {
  key: string;
  purchasePrice: number;
  /** Energy cost per km in month 1, ₹. */
  costPerKm: number;
  /** Fuel or charging plus upkeep in month 1, ₹. */
  firstMonthRunning: number;
  /** Fuel, upkeep and one-off costs over the horizon, ₹. */
  running: number;
  /** Interest on the full on-road price over the horizon (loan or forgone return), ₹. */
  interest: number;
  resale: number;
  /** purchasePrice + interest + running − resale: the total cost of owning the car, ₹. */
  netCost: number;
  /** Total cost by month (index 0 = purchase), as in CarFuelResult.totalCost. */
  totalCost: number[];
}

export interface CarSetResult {
  /** Base first, then the alternatives in the order given. */
  entries: CarSetEntry[];
  /** Keys from lowest to highest total cost at the horizon. */
  ranking: string[];
  /** Each alternative against the base, with its headline verdict. */
  pairs: Record<string, { result: CarFuelResult; verdict: CarFuelVerdict }>;
}

/**
 * Several cars against one base (petrol vs CNG vs EV). Every comparison must share the base car,
 * horizon, distance and interest rate, and carry purchase prices. The cheapest car is the one with
 * the lowest total cost of owning it over the horizon, resale included.
 */
export function compareCarSet(
  baseKey: string,
  alternatives: Record<string, CarFuelInput>,
): CarSetResult {
  const keys = Object.keys(alternatives);
  const first = alternatives[keys[0]!];
  if (!first?.purchasePrices)
    throw new RangeError('compareCarSet needs an alternative with prices');
  for (const key of keys) {
    const i = alternatives[key]!;
    if (
      !i.purchasePrices ||
      i.horizonMonths !== first.horizonMonths ||
      i.monthlyKm !== first.monthlyKm ||
      i.interestRate !== first.interestRate ||
      i.purchasePrices.base !== first.purchasePrices.base
    ) {
      throw new RangeError('compareCarSet inputs must share the base car, prices and assumptions');
    }
  }
  const end = first.horizonMonths;
  const g = growthFactor(nominalToMonthly(first.interestRate), end);
  const pairs: CarSetResult['pairs'] = {};
  for (const key of keys) {
    pairs[key] = {
      result: compareCarFuel(alternatives[key]!),
      verdict: carFuelVerdict(alternatives[key]!).verdict,
    };
  }
  const entry = (key: string, side: 'base' | 'alternative', input: CarFuelInput): CarSetEntry => {
    const result = pairs[side === 'base' ? keys[0]! : key]!.result;
    const option = input[side];
    const price = input.purchasePrices![side];
    return {
      key,
      purchasePrice: price,
      costPerKm: option.energyPrice / option.mileage,
      firstMonthRunning: result.monthlyCost[side][0]!,
      running: result.cumulativeRunningCost[side][end]!,
      interest: price * (g - 1),
      resale: input.resale?.[side] ?? 0,
      netCost: result.totalCost![side][end]!,
      totalCost: result.totalCost![side],
    };
  };
  const entries = [
    entry(baseKey, 'base', first),
    ...keys.map((key) => entry(key, 'alternative', alternatives[key]!)),
  ];
  const ranking = [...entries].sort((a, b) => a.netCost - b.netCost).map((e) => e.key);
  return { entries, ranking, pairs };
}
