/**
 * Electricity bill from a state slab tariff.
 *
 * Mechanics only. Real tariff tables live in src/data/tariffs/ and must be verified (TODO_VERIFY).
 * Not modelled yet, pending verified state rules: minimum charges, rebates, subsidies on the bill,
 * fuel-cost adjustments and net-metering export credit (added with the solar tool in M4).
 */
import { progressiveSum, validateBands, type Band } from './bands';
import type { VerificationStatus } from './tax';

/** Band of monthly kWh; rate is ₹ per kWh. */
export type EnergySlab = Band;

export interface FixedCharge {
  basis: 'perConnection' | 'perKW';
  /** ₹ per month. */
  amount: number;
}

export interface Levy {
  name: string;
  /** Decimal, e.g. 0.05 for 5%. */
  rate: number;
  on: 'energy' | 'energyAndFixed';
}

/**
 * `telescopic`: each band's rate applies only to units inside it.
 * `wholeUnitsAtSlabRate`: all units are billed at the rate of the band the total falls in.
 */
export type SlabMethod = 'telescopic' | 'wholeUnitsAtSlabRate';

export interface Tariff {
  state: string;
  category: string;
  method: SlabMethod;
  slabs: EnergySlab[];
  fixedCharges: FixedCharge[];
  levies: Levy[];
  source: string;
  effectiveDate: string;
  status: VerificationStatus;
}

export interface BillOptions {
  sanctionedLoadKW?: number;
}

export interface Bill {
  energy: number;
  fixed: number;
  levies: number;
  total: number;
}

export function validateTariff(tariff: Tariff): void {
  validateBands(tariff.slabs);
}

export function energyCharge(kWh: number, tariff: Tariff): number {
  validateTariff(tariff);
  if (kWh <= 0) return 0;
  if (tariff.method === 'wholeUnitsAtSlabRate') {
    const slab = tariff.slabs.find((s) => s.upTo === null || kWh <= s.upTo)!;
    return kWh * slab.rate;
  }
  return progressiveSum(kWh, tariff.slabs);
}

export function bill(
  kWh: number,
  tariff: Tariff,
  { sanctionedLoadKW = 1 }: BillOptions = {},
): Bill {
  const energy = energyCharge(kWh, tariff);
  const fixed = tariff.fixedCharges.reduce(
    (sum, c) => sum + (c.basis === 'perKW' ? c.amount * sanctionedLoadKW : c.amount),
    0,
  );
  const levies = tariff.levies.reduce(
    (sum, l) => sum + l.rate * (l.on === 'energy' ? energy : energy + fixed),
    0,
  );
  return { energy, fixed, levies, total: energy + fixed + levies };
}

/** Extra ₹ on the bill from consuming `extraKWh` on top of `baseKWh` (e.g. EV home charging). */
export function incrementalCost(
  baseKWh: number,
  extraKWh: number,
  tariff: Tariff,
  options?: BillOptions,
): number {
  return bill(baseKWh + extraKWh, tariff, options).total - bill(baseKWh, tariff, options).total;
}

/**
 * ₹ saved by consuming `reductionKWh` less (e.g. solar self-consumption).
 * Because it is the difference of two full bills, the saving comes off the highest slab first.
 */
export function savingFromReduction(
  baseKWh: number,
  reductionKWh: number,
  tariff: Tariff,
  options?: BillOptions,
): number {
  const reduced = Math.max(0, baseKWh - reductionKWh);
  return bill(baseKWh, tariff, options).total - bill(reduced, tariff, options).total;
}

/** Average ₹/kWh of the extra units: the right "home charging cost per kWh" for an EV. */
export function marginalRatePerKWh(
  baseKWh: number,
  extraKWh: number,
  tariff: Tariff,
  options?: BillOptions,
): number {
  if (extraKWh <= 0) throw new RangeError('extraKWh must be positive');
  return incrementalCost(baseKWh, extraKWh, tariff, options) / extraKWh;
}
