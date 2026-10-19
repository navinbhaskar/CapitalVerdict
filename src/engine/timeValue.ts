/**
 * Time value of money.
 *
 * Conventions used across the engine:
 * - Rates are decimals (9% = 0.09), never percentages.
 * - Periods are months unless a name says otherwise.
 * - No rounding happens here. Round only when displaying.
 */

/** Nominal annual rate compounded monthly (how Indian banks quote loan and FD rates) → monthly rate. */
export function nominalToMonthly(annualRate: number): number {
  return annualRate / 12;
}

/** Effective annual rate (how returns and inflation are usually quoted) → equivalent monthly rate. */
export function effectiveToMonthly(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** Growth factor after `periods` at `rate` per period. */
export function growthFactor(rate: number, periods: number): number {
  return Math.pow(1 + rate, periods);
}

/** Future value of a single amount. */
export function fv(presentValue: number, rate: number, periods: number): number {
  return presentValue * growthFactor(rate, periods);
}

/** Present value of a single future amount. */
export function pv(futureValue: number, rate: number, periods: number): number {
  return futureValue / growthFactor(rate, periods);
}

/**
 * Future value of a level payment made every period.
 * `due = false`: paid at the end of each period. `due = true`: paid at the start.
 */
export function fvAnnuity(payment: number, rate: number, periods: number, due = false): number {
  if (rate === 0) return payment * periods;
  const value = (payment * (growthFactor(rate, periods) - 1)) / rate;
  return due ? value * (1 + rate) : value;
}

/** Fisher relation: real rate from nominal rate and inflation (both effective annual). */
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Inverse of realRate. */
export function nominalRate(real: number, inflation: number): number {
  return (1 + real) * (1 + inflation) - 1;
}

/** Express an amount `months` in the future in today's rupees, given annual inflation. */
export function toTodaysRupees(amount: number, annualInflation: number, months: number): number {
  return pv(amount, effectiveToMonthly(annualInflation), months);
}

/**
 * Price in a given month when the price steps up once a year (month 1–12 at the starting price,
 * month 13–24 one rise higher, and so on). This is how fuel and tariff escalation is modelled.
 */
export function yearlySteppedPrice(startPrice: number, annualRise: number, month: number): number {
  if (month < 1) throw new RangeError('month is 1-based');
  return startPrice * growthFactor(annualRise, Math.floor((month - 1) / 12));
}
