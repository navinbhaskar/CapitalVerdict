/**
 * Flat-rate loans: interest is charged on the full amount for the whole term, though it is repaid
 * month by month. This finds the usual reducing-balance rate that charges the same EMI.
 */
import { irr } from '@/engine/irr';

/** Reducing-balance rate a year (nominal, monthly) that a flat rate over `years` really charges. */
export function flatToReducing(flatRate: number, years: number): number {
  if (!(flatRate >= 0) || !Number.isInteger(years) || years < 1) {
    throw new RangeError('flat rate must not be negative; years a positive whole number');
  }
  const months = years * 12;
  const payment = (1 + flatRate * years) / months;
  return irr([1, ...Array<number>(months).fill(-payment)])! * 12;
}
