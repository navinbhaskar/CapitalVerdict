/**
 * Schemas for data files. Every number that comes from the outside world carries its unit, source,
 * effective date and verification status. Unverified values are `TODO_VERIFY` and must not be shown
 * as facts.
 */
import { z } from 'zod';
import defaultsJson from './defaults.json';

export const verificationStatus = z.enum(['TODO_VERIFY', 'verified']);

const provenance = {
  unit: z.string().min(1),
  source: z.string().min(1),
  effectiveDate: z.iso.date(),
  status: verificationStatus,
};

/** A single sourced value. `value` is null while it is still TODO_VERIFY. */
export const dataRecord = z
  .object({ value: z.number().nullable(), ...provenance })
  .refine((r) => r.value !== null || r.status === 'TODO_VERIFY', {
    message: 'a verified record must have a value',
  });
export type DataRecord = z.infer<typeof dataRecord>;

export const scenarioVariable = z.object({
  values: z.object({ pessimistic: z.number(), base: z.number(), optimistic: z.number() }),
  ...provenance,
});
export type ScenarioVariable = z.infer<typeof scenarioVariable>;

export const defaultsSchema = z.object({
  scenarioVariables: z.object({
    inflation: scenarioVariable,
    equityReturnNominal: scenarioVariable,
    propertyAppreciation: scenarioVariable,
    rentGrowth: scenarioVariable,
    energyPriceRise: scenarioVariable,
  }),
});
export type Defaults = z.infer<typeof defaultsSchema>;

/** Parsed and validated at import time, so a malformed file fails the build and the tests. */
export const defaults: Defaults = defaultsSchema.parse(defaultsJson);
