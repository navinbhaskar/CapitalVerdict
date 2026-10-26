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
import dlTariffJson from './tariffs/DL.json';
import upSolarJson from './solar/UP.json';
import dlSolarJson from './solar/DL.json';
import propertyJson from './property.json';
import incomeTaxJson from './incomeTax.json';
import smallSavingsJson from './smallSavings.json';
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

/** States with data: Delhi and Uttar Pradesh. */
export const stateId = z.enum(['DL', 'UP']);

export const fuelPricesSchema = z.object({
  cities: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z]+$/),
        state: stateId,
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
    /**
     * With `loadUpToKW`, the charges are load bands: the whole sanctioned load is billed at the
     * rate of the band it falls in (Delhi). Without it, every charge applies (UP).
     */
    fixedCharges: z.array(
      z.object({
        basis: z.enum(['perConnection', 'perKW']),
        amount: z.number().min(0),
        loadUpToKW: z.number().positive().nullable().optional(),
      }),
    ),
    /**
     * `energyAndEnergyLevies`: on the energy charge plus the other levies' (and PPAC's) share on
     * the energy charge, as Delhi's electricity tax is.
     */
    levies: z.array(
      z.object({
        name: z.string().min(1),
        rate: z.number().min(0),
        on: z.enum(['energy', 'energyAndFixed', 'energyAndEnergyLevies']),
      }),
    ),
    /** Power purchase adjustment, a share of the energy and fixed charges; varies through the year. */
    ppac: dataRecord.optional(),
    /** A state government subsidy on domestic bills, for consumers who opt in. */
    subsidy: z
      .object({
        /** The whole bill is subsidised up to this many units a month. */
        fullUpToUnits: z.number().min(0),
        /** A share of the bill, capped, up to this many units; nothing above. */
        partialUpToUnits: z.number().min(0),
        partialShare: z.number().min(0).max(1),
        partialCapPerMonth: z.number().min(0),
        optIn: z.boolean(),
        source: z.string().min(1),
        effectiveDate: z.iso.date(),
        status: verificationStatus,
      })
      .optional(),
    source: z.string().min(1),
    effectiveDate: z.iso.date(),
    status: verificationStatus,
  })
  .refine((t) => t.status === 'TODO_VERIFY' || (t.method !== null && t.slabs.length > 0), {
    message: 'a verified tariff needs a slab method and slabs',
  });
export type TariffData = z.infer<typeof tariffSchema>;

const sourced = {
  unit: z.string().min(1),
  source: z.string().min(1),
  effectiveDate: z.iso.date(),
  status: verificationStatus,
};

/**
 * A state's rooftop solar figures. The subsidy is either one amount (`subsidy`, UP) or set by
 * system size (`centralSubsidy` bands, plus any state capital subsidy and generation incentive).
 */
export const solarSchema = z
  .object({
    state: stateId,
    subsidy: dataRecord.optional(),
    /** ₹ per kW within each size band (progressive), e.g. PM Surya Ghar. */
    centralSubsidy: z
      .object({
        bands: z
          .array(z.object({ upToKW: z.number().positive().nullable(), perKW: z.number().min(0) }))
          .min(1),
        ...sourced,
      })
      .optional(),
    stateCapitalSubsidy: z
      .object({ perKW: z.number().min(0), max: z.number().min(0), ...sourced })
      .optional(),
    /** ₹ per kWh generated, by system size band (the whole system at its band's rate). */
    generationIncentive: z
      .object({
        bands: z
          .array(z.object({ upToKW: z.number().positive().nullable(), perKWh: z.number().min(0) }))
          .min(1),
        ...sourced,
      })
      .optional(),
    generationIncentiveYears: dataRecord.optional(),
    generationPerKWPerDay: dataRecord,
    degradationPerYear: dataRecord,
    exportRatePerKWh: dataRecord,
  })
  .refine((d) => d.subsidy !== undefined || d.centralSubsidy !== undefined, {
    message: 'a state needs a subsidy amount or subsidy bands',
  });
export type SolarData = z.infer<typeof solarSchema>;

export const propertySchema = z.object({
  state: z.string().min(1),
  stampDutyAndRegistration: dataRecord,
});
export type PropertyData = z.infer<typeof propertySchema>;

const band = z.object({ upTo: z.number().positive().nullable(), rate: z.number().min(0).max(1) });
const regime = z.object({
  slabs: z.array(band).min(1),
  standardDeduction: z.number().min(0),
  rebate: z.object({
    max: z.number().min(0),
    incomeLimit: z.number().min(0),
    marginalRelief: z.boolean(),
  }),
});

/** Income-tax rules for one tax year, both regimes. Verified as a whole, with one source note. */
export const incomeTaxSchema = z.object({
  taxYear: z.string().regex(/^\d{4}-\d{2}$/),
  appliesTo: z.string().min(1),
  cessRate: z.number().min(0).max(1),
  surchargeFrom: z.number().positive(),
  regimes: z.object({ new: regime, old: regime }),
  /** Capital-gains rates for resident individuals, with their own source note. */
  capitalGains: z.object({
    longTermRate: z.number().min(0).max(1),
    equityLongTermExemption: z.number().min(0),
    equityShortTermRate: z.number().min(0).max(1),
    /** Listed equity (and equity funds) held longer than this is long-term. */
    listedLongTermAfterMonths: z.number().int().positive(),
    source: z.string().min(1),
    effectiveDate: z.iso.date(),
    status: verificationStatus,
  }),
  source: z.string().min(1),
  effectiveDate: z.iso.date(),
  status: verificationStatus,
});
export type IncomeTaxData = z.infer<typeof incomeTaxSchema>;

/** Government small-savings schemes. Verified as a whole, with one source note each. */
export const smallSavingsSchema = z.object({
  ppf: z.object({
    rate: z.number().min(0).max(1),
    minYearly: z.number().min(0),
    maxYearly: z.number().positive(),
    termYears: z.number().int().positive(),
    extensionYears: z.number().int().positive(),
    interestTaxFree: z.boolean(),
    source: z.string().min(1),
    effectiveDate: z.iso.date(),
    status: verificationStatus,
  }),
});
export type SmallSavingsData = z.infer<typeof smallSavingsSchema>;

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
  tariffSchema.parse(dlTariffJson);
  solarSchema.parse(upSolarJson);
  solarSchema.parse(dlSolarJson);
  propertySchema.parse(propertyJson);
  incomeTaxSchema.parse(incomeTaxJson);
  smallSavingsSchema.parse(smallSavingsJson);
  changelogSchema.parse(changelogJson);
}
