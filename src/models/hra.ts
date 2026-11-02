/**
 * House rent allowance exemption, old regime (Income-tax Rules, 2026, Rule 279). For the months
 * you rent, the tax-free part of HRA is the least of:
 *   1. the HRA received,
 *   2. the rent paid minus 10% of salary,
 *   3. 50% of salary in the eight large cities, 40% anywhere else,
 * where salary is basic pay plus dearness allowance. The rest of the HRA is taxed as salary. The
 * tax it saves is the exempt amount at your old-regime slab rate, plus cess. Under the new regime
 * HRA is not exempt at all.
 */
import type { IncomeTaxData } from '@/data/schema';

export interface HraInput {
  /** A month, ₹. */
  basicPlusDa: number;
  hraReceived: number;
  rentPaid: number;
  /** Months in the year you rented, 1 to 12. */
  months: number;
  /** Lives in one of the 50% cities. */
  largeCity: boolean;
  /** Your old-regime slab rate, decimal, before cess. */
  slabRate: number;
}

export type HraLimit = 'received' | 'rent' | 'salaryShare';

export interface HraResult {
  /** For the months rented, ₹. */
  salary: number;
  received: number;
  rent: number;
  /** The three amounts; the least is exempt. */
  limits: Record<HraLimit, number>;
  /** Which of the three is the least (the first, if two tie). */
  binding: HraLimit;
  /** The share of salary in limit 3: 50% or 40%. */
  salaryShare: number;
  exempt: number;
  taxable: number;
  /** Tax saved by the exemption: exempt × slab rate × (1 + cess), ₹. */
  taxSaved: number;
}

export function hraCalc(input: HraInput, rules: IncomeTaxData): HraResult {
  const salary = input.basicPlusDa * input.months;
  const received = input.hraReceived * input.months;
  const rent = input.rentPaid * input.months;
  const salaryShare = input.largeCity ? rules.hra.largeCityShare : rules.hra.otherShare;
  const limits: Record<HraLimit, number> = {
    received,
    rent: Math.max(0, rent - rules.hra.rentAboveShareOfSalary * salary),
    salaryShare: salaryShare * salary,
  };
  const order: HraLimit[] = ['received', 'rent', 'salaryShare'];
  const binding = order.reduce((a, b) => (limits[b] < limits[a] ? b : a));
  const exempt = limits[binding];
  return {
    salary,
    received,
    rent,
    limits,
    binding,
    salaryShare,
    exempt,
    taxable: received - exempt,
    taxSaved: exempt * input.slabRate * (1 + rules.cessRate),
  };
}
