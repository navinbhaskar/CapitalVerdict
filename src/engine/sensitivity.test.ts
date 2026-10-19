import { describe, expect, it } from 'vitest';
import { findFlip, sweep } from './sensitivity';

describe('sweep', () => {
  it('varies one input and keeps the rest', () => {
    const model = (i: { a: number; b: number }) => i.a * i.b;
    const points = sweep(model, { a: 2, b: 3 }, (i, v) => ({ ...i, a: v }), [1, 2, 3]);
    expect(points).toEqual([
      { value: 1, output: 3 },
      { value: 2, output: 6 },
      { value: 3, output: 9 },
    ]);
  });
});

describe('findFlip', () => {
  it('finds a linear threshold', () => {
    const flip = findFlip((x) => x - 930.331, { lo: 0, hi: 5000 });
    expect(flip?.threshold).toBeCloseTo(930.331, 5);
    expect(flip?.signBelow).toBe(-1);
  });

  it('reports the sign below the threshold', () => {
    const flip = findFlip((x) => 50 - x, { lo: 0, hi: 100 });
    expect(flip?.threshold).toBeCloseTo(50, 6);
    expect(flip?.signBelow).toBe(1);
  });

  it('returns the first flip of a non-monotonic answer', () => {
    const flip = findFlip((x) => (x - 2) * (x - 5), { lo: 0, hi: 10 });
    expect(flip?.threshold).toBeCloseTo(2, 6);
  });

  it('returns null when the answer never changes sign', () => {
    expect(findFlip((x) => x + 1, { lo: 0, hi: 100 })).toBeNull();
  });

  it('handles a zero exactly on a grid point', () => {
    const flip = findFlip((x) => x - 50, { lo: 0, hi: 100, steps: 4 });
    expect(flip?.threshold).toBeCloseTo(50, 6);
  });

  it('rejects an empty range', () => {
    expect(() => findFlip((x) => x, { lo: 5, hi: 5 })).toThrow(RangeError);
  });
});
