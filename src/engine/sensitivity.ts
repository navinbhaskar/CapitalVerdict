/**
 * One-at-a-time sensitivity: vary a single input, hold everything else, and find where the answer flips.
 *
 * A tool expresses its answer as a signed number (for example "net gain of option B over A at the
 * horizon"): positive means B wins, negative means A wins. A flip is where that sign changes.
 */

export interface SweepPoint<O> {
  value: number;
  output: O;
}

/** Evaluate `model` with one input set to each value in `values`. */
export function sweep<I, O>(
  model: (input: I) => O,
  input: I,
  apply: (input: I, value: number) => I,
  values: readonly number[],
): SweepPoint<O>[] {
  return values.map((value) => ({ value, output: model(apply(input, value)) }));
}

export interface Flip {
  /** The input value at which the signed answer crosses zero. */
  threshold: number;
  /** Sign of the answer just below the threshold (+1 or −1). Above it, the sign is reversed. */
  signBelow: 1 | -1;
}

export interface FindFlipOptions {
  lo: number;
  hi: number;
  /** Grid points used to locate the first sign change before bisecting. Catches non-monotonic answers. */
  steps?: number;
  /** Stop bisecting when the bracket is narrower than this. Defaults to (hi − lo) × 1e-9. */
  tolerance?: number;
}

/**
 * First value in [lo, hi] where `signedAnswer` changes sign, or null if it never does on the grid.
 * Two flips closer together than one grid step can be missed; pick `steps` to suit the input.
 */
export function findFlip(
  signedAnswer: (value: number) => number,
  { lo, hi, steps = 200, tolerance }: FindFlipOptions,
): Flip | null {
  if (!(hi > lo)) throw new RangeError('hi must be greater than lo');
  const tol = tolerance ?? (hi - lo) * 1e-9;
  const step = (hi - lo) / steps;

  let prevX = lo;
  let prevY = signedAnswer(lo);
  for (let k = 1; k <= steps; k++) {
    const x = k === steps ? hi : lo + k * step;
    const y = signedAnswer(x);
    if (prevY !== 0 && Math.sign(y) !== Math.sign(prevY)) {
      return {
        threshold: bisect(signedAnswer, prevX, x, prevY, tol),
        signBelow: prevY > 0 ? 1 : -1,
      };
    }
    prevX = x;
    prevY = y;
  }
  return null;
}

function bisect(f: (x: number) => number, a: number, b: number, fa: number, tol: number): number {
  for (let i = 0; i < 200 && b - a > tol; i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}
