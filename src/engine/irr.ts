/**
 * Net present value and internal rate of return for evenly spaced cash flows
 * (index 0 = now, negative = money out).
 */

export function npv(ratePerPeriod: number, flows: readonly number[]): number {
  return flows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + ratePerPeriod, i), 0);
}

/**
 * Rate per period at which NPV is zero, by bisection. Returns null when the flows never change
 * sign or the NPV does not cross zero between −99% and +1000% per period.
 */
export function irr(flows: readonly number[]): number | null {
  if (!flows.some((f) => f < 0) || !flows.some((f) => f > 0)) return null;
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo, flows);
  const fHi = npv(hi, flows);
  if (Math.sign(fLo) === Math.sign(fHi)) return null;
  for (let i = 0; i < 300 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Monthly rate → effective annual rate. */
export function annualise(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1;
}
