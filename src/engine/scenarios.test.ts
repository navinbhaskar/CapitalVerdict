import { describe, expect, it } from 'vitest';
import { runScenarios, scenarioRange, type ScenarioSets } from './scenarios';

interface Input {
  amount: number;
  rate: number;
  years: number;
}
const model = (i: Input) => ({ value: i.amount * (1 + i.rate) ** i.years });

const sets: ScenarioSets<Input> = {
  pessimistic: { rate: 0.07 },
  base: { rate: 0.1 },
  optimistic: { rate: 0.12 },
};

describe('runScenarios', () => {
  const runs = runScenarios(model, { amount: 100, rate: 0.5, years: 1 }, sets);

  it('overrides only the fields in each set', () => {
    expect(runs.pessimistic.input).toEqual({ amount: 100, rate: 0.07, years: 1 });
    expect(runs.optimistic.input.amount).toBe(100);
  });

  it('runs the model per scenario', () => {
    expect(runs.pessimistic.output.value).toBeCloseTo(107, 10);
    expect(runs.base.output.value).toBeCloseTo(110, 10);
    expect(runs.optimistic.output.value).toBeCloseTo(112, 10);
  });

  it('does not mutate the input', () => {
    const input = { amount: 100, rate: 0.5, years: 1 };
    runScenarios(model, input, sets);
    expect(input.rate).toBe(0.5);
  });
});

describe('scenarioRange', () => {
  it('returns sorted low/high and the base value', () => {
    const runs = runScenarios(model, { amount: 100, rate: 0, years: 1 }, sets);
    const range = scenarioRange(runs, (o) => o.value);
    expect(range.low).toBeCloseTo(107, 10);
    expect(range.base).toBeCloseTo(110, 10);
    expect(range.high).toBeCloseTo(112, 10);
  });

  it('sorts even when "pessimistic" produces the larger number', () => {
    const inverted: ScenarioSets<Input> = {
      pessimistic: { rate: 0.12 },
      base: { rate: 0.1 },
      optimistic: { rate: 0.07 },
    };
    const runs = runScenarios(model, { amount: 100, rate: 0, years: 1 }, inverted);
    const range = scenarioRange(runs, (o) => o.value);
    expect(range.low).toBeCloseTo(107, 10);
    expect(range.high).toBeCloseTo(112, 10);
  });
});
