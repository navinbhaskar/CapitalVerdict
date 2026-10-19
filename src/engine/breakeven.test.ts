import { describe, expect, it } from 'vitest';
import { breakeven, cumulative } from './breakeven';

describe('cumulative', () => {
  it('starts with the start value at index 0', () => {
    expect(cumulative([10, 20, 30])).toEqual([0, 10, 30, 60]);
    expect(cumulative([5, 5], 100)).toEqual([100, 105, 110]);
  });

  it('handles an empty series', () => {
    expect(cumulative([])).toEqual([0]);
  });
});

describe('breakeven', () => {
  it('finds the first month A catches up with a flat B', () => {
    // Saving 100/month vs a one-off 250: month 2 → 200, month 3 → 300.
    const a = cumulative(Array(10).fill(100));
    const b = Array(11).fill(250);
    expect(breakeven(a, b)).toEqual({ month: 3, fractionalMonth: 2.5 });
  });

  it('counts an exact tie as break-even', () => {
    const a = cumulative(Array(5).fill(100));
    const b = Array(6).fill(300);
    expect(breakeven(a, b)?.month).toBe(3);
    expect(breakeven(a, b)?.fractionalMonth).toBe(3);
  });

  it('is month 0 when A already leads', () => {
    expect(breakeven([10, 20], [5, 50])).toEqual({ month: 0, fractionalMonth: 0 });
  });

  it('is null when A never catches up within the horizon', () => {
    const a = cumulative(Array(12).fill(10));
    const b = Array(13).fill(1000);
    expect(breakeven(a, b)).toBeNull();
  });

  it('works against a growing B (interest on the extra price)', () => {
    // B grows 10%/month from 100; A gains 30/month. Month 4: A=120, B=146.41; month 6: A=180, B=177.16.
    const a = cumulative(Array(12).fill(30));
    const b = Array.from({ length: 13 }, (_, m) => 100 * 1.1 ** m);
    expect(breakeven(a, b)?.month).toBe(6);
  });
});
