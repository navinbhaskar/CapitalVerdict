/** Shared banded-rate maths for income-tax slabs and electricity tariff slabs. */

export interface Band {
  /** Upper bound of this band (inclusive). null = no upper bound. */
  upTo: number | null;
  rate: number;
}

export function validateBands(bands: readonly Band[]): void {
  if (bands.length === 0) throw new Error('band table is empty');
  let previous = 0;
  bands.forEach((band, i) => {
    const last = i === bands.length - 1;
    if (last !== (band.upTo === null)) throw new Error('only the last band may be open-ended');
    if (band.upTo !== null && band.upTo <= previous) throw new Error('band bounds must increase');
    if (band.rate < 0) throw new Error('band rate must not be negative');
    previous = band.upTo ?? previous;
  });
}

/** Each band's rate applies only to the part of `amount` inside that band. */
export function progressiveSum(amount: number, bands: readonly Band[]): number {
  validateBands(bands);
  let total = 0;
  let lower = 0;
  for (const { upTo, rate } of bands) {
    if (amount <= lower) break;
    const top = upTo === null ? amount : Math.min(amount, upTo);
    total += (top - lower) * rate;
    lower = upTo ?? Infinity;
  }
  return total;
}
