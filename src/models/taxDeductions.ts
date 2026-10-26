/**
 * Itemised deductions for the old or new tax regime tool: what each claim is worth after its
 * limit, in each regime, and the totals that feed `compareRegimes`.
 *
 * Old regime: HRA exemption, 80C (with PF, PPF, ELSS, life insurance, tuition fees, home-loan
 * principal and your own NPS), 80CCD(1B) extra NPS, 80D health insurance for yourself and for
 * parents, home-loan interest on a self-occupied house, 80E education-loan interest (no limit),
 * 80TTA savings interest and the employer's NPS contribution (80CCD(2)).
 * New regime: only the employer's NPS contribution, at its higher limit.
 *
 * HRA exemption = least of HRA received, rent − 10% of salary, and 50% of salary in the large
 * cities (40% elsewhere), where salary means basic pay plus dearness allowance. Limits come from
 * src/data/incomeTax.json. Savings interest is income in both regimes; 80TTA takes up to its
 * limit off it in the old regime only.
 */
import type { IncomeTaxData } from '@/data/schema';
import type { TaxRegimeInput } from './taxRegime';

export interface DeductionInput {
  /** Gross salary for the year, including HRA and any employer NPS contribution, ₹. */
  salary: number;
  /** Other income at slab rates, apart from savings interest, ₹. */
  otherIncome: number;
  /** Basic pay plus dearness allowance for the year: the "salary" in the HRA and NPS limits, ₹. */
  basicPlusDa: number;
  hraReceived: number;
  /** Rent paid in the year, ₹. */
  rentPaid: number;
  /** Lives in one of the cities with the 50% HRA limit. */
  largeCity: boolean;
  /** Everything under 80C, before the limit, ₹. */
  section80C: number;
  /** Your own extra NPS contribution, beyond 80C, ₹. */
  npsExtra: number;
  /** Health insurance premiums and check-ups for yourself, spouse and children, ₹. */
  healthSelf: number;
  /** Anyone in that cover is 60 or over. */
  healthSelfSenior: boolean;
  healthParents: number;
  healthParentsSenior: boolean;
  /** Interest paid on a home loan for the house you live in, ₹. */
  homeLoanInterest: number;
  educationLoanInterest: number;
  /** Savings-account interest, ₹ (counted as income too). */
  savingsInterest: number;
  /** Your employer's NPS contribution, ₹. */
  employerNps: number;
  /** The employer is the Central or a State Government (14% limit in the old regime too). */
  governmentEmployer: boolean;
}

export type DeductionKey =
  | 'hra'
  | 'section80C'
  | 'npsExtra'
  | 'healthSelf'
  | 'healthParents'
  | 'homeLoanInterest'
  | 'educationLoanInterest'
  | 'savingsInterest'
  | 'employerNps';

export interface DeductionLine {
  key: DeductionKey;
  /** What was entered (for HRA, the HRA received), ₹. */
  entered: number;
  /** What counts after the limit, ₹. */
  allowed: number;
  /** The limit, ₹; null when there is none. */
  limit: number | null;
}

export interface DeductionResult {
  old: DeductionLine[];
  new: DeductionLine[];
  oldTotal: number;
  newTotal: number;
  /** Unused room under each limited old-regime deduction, ₹. */
  roomLeft: { section80C: number; npsExtra: number; healthSelf: number; healthParents: number };
  /** Ready for `compareRegimes`. */
  regimeInput: TaxRegimeInput;
}

/** HRA exemption under the old regime: the least of the three amounts, never below zero. */
export function hraExemption(
  i: Pick<DeductionInput, 'basicPlusDa' | 'hraReceived' | 'rentPaid' | 'largeCity'>,
  rules: IncomeTaxData['hra'],
): number {
  const rentOver = i.rentPaid - rules.rentAboveShareOfSalary * i.basicPlusDa;
  const share = (i.largeCity ? rules.largeCityShare : rules.otherShare) * i.basicPlusDa;
  return Math.max(0, Math.min(i.hraReceived, rentOver, share));
}

const line = (key: DeductionKey, entered: number, limit: number | null): DeductionLine => ({
  key,
  entered,
  allowed: limit === null ? entered : Math.min(entered, limit),
  limit,
});

export function itemisedDeductions(i: DeductionInput, rules: IncomeTaxData): DeductionResult {
  for (const [name, v] of Object.entries(i)) {
    if (typeof v === 'number' && !(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  const d = rules.deductions;
  const health = d.health80D;
  const npsShareOld = i.governmentEmployer
    ? d.employerNps80CCD2.oldGovernmentEmployer
    : d.employerNps80CCD2.old;

  const hra = hraExemption(i, rules.hra);
  const old: DeductionLine[] = [
    { key: 'hra', entered: i.hraReceived, allowed: hra, limit: null },
    line('section80C', i.section80C, d.section80C),
    line('npsExtra', i.npsExtra, d.nps80CCD1B),
    line('healthSelf', i.healthSelf, i.healthSelfSenior ? health.selfSenior : health.self),
    line(
      'healthParents',
      i.healthParents,
      i.healthParentsSenior ? health.parentsSenior : health.parents,
    ),
    line('homeLoanInterest', i.homeLoanInterest, d.homeLoanInterestSelfOccupied),
    line('educationLoanInterest', i.educationLoanInterest, null),
    line('savingsInterest', i.savingsInterest, d.savingsInterest80TTA),
    line('employerNps', i.employerNps, npsShareOld * i.basicPlusDa),
  ];
  const fresh: DeductionLine[] = [
    line('employerNps', i.employerNps, d.employerNps80CCD2.new * i.basicPlusDa),
  ];
  const sum = (lines: DeductionLine[]) => lines.reduce((s, l) => s + l.allowed, 0);
  const allowed = (key: DeductionKey) => old.find((l) => l.key === key)!;
  const room = (key: DeductionKey) => Math.max(0, (allowed(key).limit ?? 0) - allowed(key).allowed);

  const oldTotal = sum(old);
  const newTotal = sum(fresh);
  return {
    old,
    new: fresh,
    oldTotal,
    newTotal,
    roomLeft: {
      section80C: room('section80C'),
      npsExtra: room('npsExtra'),
      healthSelf: room('healthSelf'),
      healthParents: room('healthParents'),
    },
    regimeInput: {
      salary: i.salary,
      otherIncome: i.otherIncome + i.savingsInterest,
      oldDeductions: oldTotal,
      newDeductions: newTotal,
    },
  };
}
