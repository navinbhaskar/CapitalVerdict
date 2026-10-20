/**
 * Zod schemas for data files. Used at build time (BaseLayout) and in tests, never shipped to the
 * browser: client code reads data through ./index.ts.
 *
 * Schemas for data files. Every number that comes from the outside world carries its unit, source,
 * effective date and verification status. Unverified values are `TODO_VERIFY` and must not be shown
 * as facts.
 */
import { z } from 'zod';
import defaultsJson from './defaults.json';
import fuelPricesJson from './fuelPrices.json';
import upTariffJson from './tariffs/UP.json';
import solarJson from './solar.json';
import propertyJson from './property.json';
import changelogJson from './changelog.json';

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
  globalAssumptions: z.object({
    carLoanRate: dataRecord,
    homeLoanRate: dataRecord,
    fdRate: dataRecord,
  }),
});
export type Defaults = z.infer<typeof defaultsSchema>;

export const fuelPricesSchema = z.object({
  cities: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z]+$/),
        state: z.enum(['UP']),
        petrol: dataRecord,
        cng: dataRecord,
      }),
    )
    .min(1),
});
export type FuelPrices = z.infer<typeof fuelPricesSchema>;
export type CityId = FuelPrices['cities'][number]['id'];

/**
 * A state's domestic tariff. While TODO_VERIFY the method is null and the lists are empty; a
 * verified tariff must have a method and at least one slab.
 */
export const tariffSchema = z
  .object({
    state: z.string().min(1),
    category: z.string().min(1),
    method: z.enum(['telescopic', 'wholeUnitsAtSlabRate']).nullable(),
    slabs: z.array(z.object({ upTo: z.number().positive().nullable(), rate: z.number().min(0) })),
    fixedCharges: z.array(
      z.object({ basis: z.enum(['perConnection', 'perKW']), amount: z.number().min(0) }),
    ),
    levies: z.array(
      z.object({
        name: z.string().min(1),
        rate: z.number().min(0),
        on: z.enum(['energy', 'energyAndFixed']),
      }),
    ),
    source: z.string().min(1),
    effectiveDate: z.iso.date(),
    status: verificationStatus,
  })
  .refine((t) => t.status === 'TODO_VERIFY' || (t.method !== null && t.slabs.length > 0), {
    message: 'a verified tariff needs a slab method and slabs',
  });
export type TariffData = z.infer<typeof tariffSchema>;

export const solarSchema = z.object({
  state: z.string().min(1),
  subsidy: dataRecord,
  generationPerKWPerDay: dataRecord,
  degradationPerYear: dataRecord,
  exportRatePerKWh: dataRecord,
});
export type SolarData = z.infer<typeof solarSchema>;

export const propertySchema = z.object({
  state: z.string().min(1),
  stampDutyAndRegistration: dataRecord,
});
export type PropertyData = z.infer<typeof propertySchema>;

export const changelogSchema = z.object({
  entries: z
    .array(z.object({ date: z.iso.date(), change: z.string().min(1) }))
    .refine((e) => e.every((x, i) => i === 0 || e[i - 1]!.date >= x.date), 'newest first'),
});
export type Changelog = z.infer<typeof changelogSchema>;

/** Throws on any malformed data file. Called from BaseLayout so a bad file fails the build. */
export function validateAllData(): void {
  defaultsSchema.parse(defaultsJson);
  fuelPricesSchema.parse(fuelPricesJson);
  tariffSchema.parse(upTariffJson);
  solarSchema.parse(solarJson);
  propertySchema.parse(propertyJson);
  changelogSchema.parse(changelogJson);
}
