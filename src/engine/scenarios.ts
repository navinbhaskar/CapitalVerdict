/**
 * Run one model under pessimistic / base / optimistic assumption sets.
 * "Pessimistic" means bad for the user from that tool's point of view; each tool decides
 * which direction of each variable is pessimistic when it builds its sets.
 */

export const SCENARIOS = ['pessimistic', 'base', 'optimistic'] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export type ScenarioSets<I> = Record<ScenarioName, Partial<I>>;

export interface ScenarioRun<I, O> {
  input: I;
  output: O;
}

export function runScenarios<I extends object, O>(
  model: (input: I) => O,
  input: I,
  sets: ScenarioSets<I>,
): Record<ScenarioName, ScenarioRun<I, O>> {
  const run = (name: ScenarioName): ScenarioRun<I, O> => {
    const merged = { ...input, ...sets[name] };
    return { input: merged, output: model(merged) };
  };
  return { pessimistic: run('pessimistic'), base: run('base'), optimistic: run('optimistic') };
}

export interface Range {
  low: number;
  base: number;
  high: number;
}

/** Low/base/high of one metric across scenarios. Low and high are sorted, whichever scenario they came from. */
export function scenarioRange<I, O>(
  runs: Record<ScenarioName, ScenarioRun<I, O>>,
  metric: (output: O) => number,
): Range {
  const values = SCENARIOS.map((name) => metric(runs[name].output));
  return {
    low: Math.min(...values),
    base: metric(runs.base.output),
    high: Math.max(...values),
  };
}
