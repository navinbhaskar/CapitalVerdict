/**
 * The rent vs buy form. The visitor's own figures (price, rent, return) start empty, as do market
 * values that are not verified yet (stamp duty, home-loan rate, maintenance, selling cost).
 * Home price growth and rent growth start at the base row of the default scenario table.
 */
import { defaults, verifiedStampDuty } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { RentBuyInput } from './rentBuy';

export interface RentBuyForm {
  homePrice: number | null;
  downPayment: number | null;
  loanRate: number | null;
  loanYears: number | null;
  stampDuty: number | null;
  otherUpfront: number | null;
  maintenance: number | null;
  propertyTax: number | null;
  appreciation: number | null;
  sellingCost: number | null;
  monthlyRent: number | null;
  rentGrowth: number | null;
  securityDeposit: number | null;
  investmentReturn: number | null;
  inflation: number | null;
  horizonYears: number | null;
  /** Extra paid towards the loan each year, ₹ (optional). */
  prepayYearly: number | null;
  /** Take-home income a month, ₹ (optional): only to show the EMI's share of it. */
  monthlyIncome: number | null;
}

const table = defaults.scenarioVariables;

export const RENT_BUY_START_FORM: RentBuyForm = {
  homePrice: null,
  downPayment: 0.2,
  loanRate: null,
  loanYears: 20,
  stampDuty: verifiedStampDuty(),
  otherUpfront: null,
  maintenance: null,
  propertyTax: null,
  appreciation: table.propertyAppreciation.values.base,
  sellingCost: null,
  monthlyRent: null,
  rentGrowth: table.rentGrowth.values.base,
  securityDeposit: null,
  investmentReturn: null,
  inflation: table.inflation.values.base,
  horizonYears: 15,
  prepayYearly: null,
  monthlyIncome: null,
};

export const RENT_BUY_LIMITS = {
  homePrice: { min: 1, max: 50_00_00_000 },
  downPayment: { min: 0, max: 1 },
  loanRate: { min: 0, max: 0.25 },
  loanYears: { min: 1, max: 30 },
  stampDuty: { min: 0, max: 0.2 },
  otherUpfront: { min: 0, max: 5_00_00_000 },
  maintenance: { min: 0, max: 0.1 },
  propertyTax: { min: 0, max: 50_00_000 },
  appreciation: { min: -0.1, max: 0.3 },
  sellingCost: { min: 0, max: 0.1 },
  monthlyRent: { min: 0, max: 50_00_000 },
  rentGrowth: { min: 0, max: 0.3 },
  securityDeposit: { min: 0, max: 5_00_00_000 },
  investmentReturn: { min: 0, max: 0.3 },
  inflation: { min: 0, max: 0.2 },
  horizonYears: { min: 1, max: 40 },
  prepayYearly: { min: 0, max: 10_00_00_000 },
  monthlyIncome: { min: 1, max: 10_00_00_000 },
} as const satisfies Record<keyof RentBuyForm, { min: number; max: number }>;

/** May be left empty; empty means zero. */
const OPTIONAL: (keyof RentBuyForm)[] = [
  'otherUpfront',
  'propertyTax',
  'securityDeposit',
  'prepayYearly',
  'monthlyIncome',
];
const INTEGER: (keyof RentBuyForm)[] = ['loanYears', 'horizonYears'];

const num = (param: string, key: keyof RentBuyForm) => ({
  param,
  type: 'number' as const,
  ...RENT_BUY_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const rentBuyShareSchema: ShareSchema<RentBuyForm> = {
  homePrice: num('hp', 'homePrice'),
  downPayment: num('dp', 'downPayment'),
  loanRate: num('lr', 'loanRate'),
  loanYears: num('ly', 'loanYears'),
  stampDuty: num('sd', 'stampDuty'),
  otherUpfront: num('ou', 'otherUpfront'),
  maintenance: num('mt', 'maintenance'),
  propertyTax: num('pt', 'propertyTax'),
  appreciation: num('ap', 'appreciation'),
  sellingCost: num('sc', 'sellingCost'),
  monthlyRent: num('rent', 'monthlyRent'),
  rentGrowth: num('rg', 'rentGrowth'),
  securityDeposit: num('dep', 'securityDeposit'),
  investmentReturn: num('ret', 'investmentReturn'),
  inflation: num('inf', 'inflation'),
  horizonYears: num('y', 'horizonYears'),
  prepayYearly: num('pre', 'prepayYearly'),
  monthlyIncome: num('inc', 'monthlyIncome'),
};

export function invalidRentBuyFields(form: RentBuyForm): (keyof RentBuyForm)[] {
  // A full cash purchase needs no loan rate or tenure.
  const cash = form.downPayment === 1;
  return (Object.keys(RENT_BUY_LIMITS) as (keyof RentBuyForm)[]).filter((key) => {
    if (cash && (key === 'loanRate' || key === 'loanYears')) return false;
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = RENT_BUY_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
}

export function toRentBuyInput(form: RentBuyForm): RentBuyInput | null {
  if (invalidRentBuyFields(form).length > 0) return null;
  return {
    homePrice: form.homePrice!,
    downPayment: form.downPayment!,
    loanRate: form.loanRate ?? 0,
    loanYears: form.loanYears ?? 1,
    stampDuty: form.stampDuty!,
    otherUpfront: form.otherUpfront ?? 0,
    maintenance: form.maintenance!,
    propertyTax: form.propertyTax ?? 0,
    appreciation: form.appreciation!,
    sellingCost: form.sellingCost!,
    monthlyRent: form.monthlyRent!,
    rentGrowth: form.rentGrowth!,
    securityDeposit: form.securityDeposit ?? 0,
    investmentReturn: form.investmentReturn!,
    inflation: form.inflation!,
    horizonYears: form.horizonYears!,
    prepayYearly: form.prepayYearly ?? 0,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data; the same case as the rent vs buy blog post.
 */
export const RENT_BUY_EXAMPLE_VALUES = {
  homePrice: 5_000_000,
  monthlyRent: 15_000,
  loanRate: 0.09,
  stampDuty: 0.07,
  maintenance: 0.005,
  sellingCost: 0.02,
  investmentReturn: 0.08,
  otherUpfront: 50_000,
  propertyTax: 6_000,
  securityDeposit: 45_000,
} as const satisfies Partial<Record<keyof RentBuyForm, number>>;

export const RENT_BUY_EXAMPLE_FORM: RentBuyForm = {
  ...RENT_BUY_START_FORM,
  ...RENT_BUY_EXAMPLE_VALUES,
};

export const RENT_BUY_EXAMPLE_KEYS = Object.keys(RENT_BUY_EXAMPLE_VALUES) as (keyof RentBuyForm)[];
