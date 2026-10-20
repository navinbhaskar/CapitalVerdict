/**
 * The cash or car loan form. The visitor's own figures (price, return) start empty. The loan rate
 * starts at the car-loan rate in the global assumptions; down payment and tenure start at common
 * choices the visitor can change. Inflation starts at the base row of the default scenario table.
 */
import { defaults } from '@/data';
import type { ShareSchema } from '@/lib/shareLink';
import type { CarLoanInput } from './carLoan';

export interface CarLoanForm {
  carPrice: number | null;
  downPayment: number | null;
  loanRate: number | null;
  loanYears: number | null;
  processingFee: number | null;
  investmentReturn: number | null;
  inflation: number | null;
}

export const CAR_LOAN_START_FORM: CarLoanForm = {
  carPrice: null,
  downPayment: 0.2,
  loanRate: defaults.globalAssumptions.carLoanRate.value,
  loanYears: 5,
  processingFee: null,
  investmentReturn: null,
  inflation: defaults.scenarioVariables.inflation.values.base,
};

export const CAR_LOAN_LIMITS = {
  carPrice: { min: 1, max: 10_00_00_000 },
  downPayment: { min: 0, max: 0.95 },
  loanRate: { min: 0, max: 0.3 },
  loanYears: { min: 1, max: 10 },
  processingFee: { min: 0, max: 10_00_000 },
  investmentReturn: { min: 0, max: 0.3 },
  inflation: { min: 0, max: 0.2 },
} as const satisfies Record<keyof CarLoanForm, { min: number; max: number }>;

/** May be left empty; empty means zero. */
const OPTIONAL: (keyof CarLoanForm)[] = ['processingFee'];
const INTEGER: (keyof CarLoanForm)[] = ['loanYears'];

const num = (param: string, key: keyof CarLoanForm) => ({
  param,
  type: 'number' as const,
  ...CAR_LOAN_LIMITS[key],
  integer: INTEGER.includes(key),
});

export const carLoanShareSchema: ShareSchema<CarLoanForm> = {
  carPrice: num('price', 'carPrice'),
  downPayment: num('dp', 'downPayment'),
  loanRate: num('lr', 'loanRate'),
  loanYears: num('ly', 'loanYears'),
  processingFee: num('fee', 'processingFee'),
  investmentReturn: num('ret', 'investmentReturn'),
  inflation: num('inf', 'inflation'),
};

export function invalidCarLoanFields(form: CarLoanForm): (keyof CarLoanForm)[] {
  const bad = (Object.keys(CAR_LOAN_LIMITS) as (keyof CarLoanForm)[]).filter((key) => {
    const v = form[key];
    if (v === null) return !OPTIONAL.includes(key);
    const { min, max } = CAR_LOAN_LIMITS[key];
    if (!Number.isFinite(v) || v < min || v > max) return true;
    return INTEGER.includes(key) && !Number.isInteger(v);
  });
  // The fee has to be smaller than the loan it is charged on.
  const loan = (form.carPrice ?? 0) * (1 - (form.downPayment ?? 0));
  if ((form.processingFee ?? 0) >= loan && loan > 0 && !bad.includes('processingFee')) {
    bad.push('processingFee');
  }
  return bad;
}

export function toCarLoanInput(form: CarLoanForm): CarLoanInput | null {
  if (invalidCarLoanFields(form).length > 0) return null;
  return {
    carPrice: form.carPrice!,
    downPayment: form.downPayment!,
    loanRate: form.loanRate!,
    loanYears: form.loanYears!,
    processingFee: form.processingFee ?? 0,
    investmentReturn: form.investmentReturn!,
    inflation: form.inflation!,
  };
}

/**
 * What the tool opens with, so a first visit gets an answer straight away. ILLUSTRATIVE EXAMPLES
 * (labelled "Example" on the page), not market data.
 */
export const CAR_LOAN_EXAMPLE_VALUES = {
  carPrice: 1_000_000,
  processingFee: 5_000,
  investmentReturn: 0.07,
} as const satisfies Partial<Record<keyof CarLoanForm, number>>;

export const CAR_LOAN_EXAMPLE_FORM: CarLoanForm = {
  ...CAR_LOAN_START_FORM,
  ...CAR_LOAN_EXAMPLE_VALUES,
};

export const CAR_LOAN_EXAMPLE_KEYS = Object.keys(CAR_LOAN_EXAMPLE_VALUES) as (keyof CarLoanForm)[];
