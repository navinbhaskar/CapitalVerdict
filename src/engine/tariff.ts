/**
 * Electricity bill from a state slab tariff.
 *
 * Mechanics only. Real tariff tables live in src/data/tariffs/ and must be verified (TODO_VERIFY).
 *
 * A month's bill, in order:
 *   energy  = the slab charge on the units
 *   fixed   = per connection, or per kW of sanctioned load; with load bands (Delhi), the whole
 *             load at the rate of the band it falls in
 *   PPAC    = a power-purchase adjustment, a share of energy + fixed (optional, it varies)
 *   levies  = surcharges on energy, or on energy + fixed; then any tax on the energy charge plus
 *             the PPAC and the levies marked `inTaxBase` on it (Delhi's electricity tax)
 *   subsidy = a state subsidy for those who opt in: the whole bill up to one number of units, a
 *             capped share of it up to a second, nothing above
 *   total   = energy + fixed + PPAC + levies - subsidy
 * Not modelled: minimum charges, rebates and net-metering export credit.
 */
import { progressiveSum, validateBands, type Band } from './bands';
import type { VerificationStatus } from './tax';

/** Band of monthly kWh; rate is ₹ per kWh. */
export type EnergySlab = Band;

export interface FixedCharge {
  basis: 'perConnection' | 'perKW';
  /** ₹ per month. */
  amount: number;
  /** Load bands: this rate applies to the whole load when it is up to this many kW (null: above). */
  loadUpToKW?: number | null;
}

export interface Levy {
  name: string;
  /** Decimal, e.g. 0.05 for 5%. */
  rate: number;
  /**
   * `energyAndEnergyLevies`: a tax on the energy charge plus the PPAC and the `inTaxBase` levies'
   * share of it, worked out after the other levies.
   */
  on: 'energy' | 'energyAndFixed' | 'energyAndEnergyLevies';
  /** This levy's share on the energy charge is part of the tax base. */
  inTaxBase?: boolean;
}

export interface Subsidy {
  /** The whole bill is subsidised up to this many units a month. */
  fullUpToUnits: number;
  /** Up to this many units, a share of the bill, capped; nothing above. */
  partialUpToUnits: number;
  partialShare: number;
  partialCapPerMonth: number;
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
  /** A state subsidy for those who opt in, if the state has one. */
  subsidy?: Subsidy;
  source: string;
  effectiveDate: string;
  status: VerificationStatus;
}

export interface BillOptions {
  sanctionedLoadKW?: number;
  /** PPAC as a share of energy + fixed; 0 when unknown. */
  ppacRate?: number;
  /** Opted in to the state subsidy (applies only if the tariff has one). */
  subsidy?: boolean;
}

export interface Bill {
  energy: number;
  fixed: number;
  ppac: number;
  levies: number;
  /** Taken off by the state subsidy. */
  subsidy: number;
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

/** Fixed charge for the month. With load bands, only the band holding the load applies. */
export function fixedCharge(tariff: Tariff, sanctionedLoadKW: number): number {
  const banded = tariff.fixedCharges.some((c) => c.loadUpToKW !== undefined);
  const charges = banded
    ? [
        tariff.fixedCharges.find(
          (c) => c.loadUpToKW === null || sanctionedLoadKW <= (c.loadUpToKW ?? Infinity),
        )!,
      ]
    : tariff.fixedCharges;
  return charges.reduce(
    (sum, c) => sum + (c.basis === 'perKW' ? c.amount * sanctionedLoadKW : c.amount),
    0,
  );
}

export function bill(
  kWh: number,
  tariff: Tariff,
  { sanctionedLoadKW = 1, ppacRate = 0, subsidy = true }: BillOptions = {},
): Bill {
  const energy = energyCharge(kWh, tariff);
  const fixed = fixedCharge(tariff, sanctionedLoadKW);
  const ppac = ppacRate * (energy + fixed);
  // Levies on energy or energy + fixed first; the share each takes on energy feeds the tax base.
  let levies = 0;
  let taxBase = energy + ppacRate * energy;
  for (const l of tariff.levies) {
    if (l.on === 'energyAndEnergyLevies') continue;
    levies += l.rate * (l.on === 'energy' ? energy : energy + fixed);
    if (l.inTaxBase) taxBase += l.rate * energy;
  }
  for (const l of tariff.levies) {
    if (l.on === 'energyAndEnergyLevies') levies += l.rate * taxBase;
  }
  const gross = energy + fixed + ppac + levies;
  const s = tariff.subsidy;
  const off =
    !subsidy || !s || kWh > s.partialUpToUnits
      ? 0
      : kWh <= s.fullUpToUnits
        ? gross
        : Math.min(s.partialShare * gross, s.partialCapPerMonth);
  return { energy, fixed, ppac, levies, subsidy: off, total: gross - off };
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

/**
 * A one-rate tariff for when the state's slab tariff is not available: every unit at `ratePerKWh`,
 * plus a flat monthly fixed charge. Saving units then saves exactly `ratePerKWh` each.
 */
export function simpleTariff(ratePerKWh: number, fixedPerMonth: number): Tariff {
  return {
    state: 'custom',
    category: 'user-entered average rate',
    method: 'telescopic',
    slabs: [{ upTo: null, rate: ratePerKWh }],
    fixedCharges: fixedPerMonth > 0 ? [{ basis: 'perConnection', amount: fixedPerMonth }] : [],
    levies: [],
    source: 'Entered by the user',
    effectiveDate: '2000-01-01',
    status: 'verified',
  };
}
