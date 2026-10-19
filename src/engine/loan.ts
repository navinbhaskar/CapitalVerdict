/**
 * Loans: EMI, amortisation schedule, outstanding balance and prepayments.
 * Interest is charged monthly at annualRate / 12 on the opening balance (reducing balance),
 * which is how Indian home and car loans are quoted.
 */
import { growthFactor, nominalToMonthly } from './timeValue';

/** Balances below this are treated as fully repaid (floating-point dust). */
const PAID_OFF = 1e-6;

export function emi(principal: number, annualRate: number, months: number): number {
  if (months <= 0) throw new RangeError('months must be positive');
  if (principal <= 0) return 0;
  const r = nominalToMonthly(annualRate);
  if (r === 0) return principal / months;
  const g = growthFactor(r, months);
  return (principal * r * g) / (g - 1);
}

/** Balance left after `paidMonths` regular EMIs (closed form, no prepayments). */
export function outstanding(
  principal: number,
  annualRate: number,
  months: number,
  paidMonths: number,
): number {
  if (paidMonths >= months) return 0;
  const r = nominalToMonthly(annualRate);
  const payment = emi(principal, annualRate, months);
  if (r === 0) return principal - payment * paidMonths;
  const g = growthFactor(r, paidMonths);
  return Math.max(0, principal * g - (payment * (g - 1)) / r);
}

export interface Prepayment {
  /** 1-based month; the prepayment is applied after that month's EMI. */
  month: number;
  amount: number;
}

/**
 * After a prepayment, either keep the EMI and finish earlier (`reduceTenure`),
 * or keep the end date and lower the EMI (`reduceEmi`).
 */
export type PrepaymentMode = 'reduceTenure' | 'reduceEmi';

export interface ScheduleRow {
  month: number;
  opening: number;
  emi: number;
  interest: number;
  principal: number;
  prepayment: number;
  closing: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totalInterest: number;
  totalPaid: number;
  /** Months until the balance reaches zero. */
  monthsTaken: number;
}

export function amortise(
  principal: number,
  annualRate: number,
  months: number,
  options: { prepayments?: Prepayment[]; mode?: PrepaymentMode } = {},
): Schedule {
  const { prepayments = [], mode = 'reduceTenure' } = options;
  const r = nominalToMonthly(annualRate);
  const extraByMonth = new Map<number, number>();
  for (const p of prepayments) {
    if (p.amount < 0) throw new RangeError('prepayment amount must not be negative');
    extraByMonth.set(p.month, (extraByMonth.get(p.month) ?? 0) + p.amount);
  }

  let payment = emi(principal, annualRate, months);
  let balance = principal;
  const rows: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; balance > PAID_OFF; month++) {
    if (month > months) throw new Error('schedule did not converge within tenure');
    const opening = balance;
    const interest = opening * r;
    const due = Math.min(payment, opening + interest);
    const principalPart = due - interest;
    balance = opening - principalPart;

    const prepayment = Math.min(extraByMonth.get(month) ?? 0, balance);
    balance -= prepayment;
    if (balance < PAID_OFF) balance = 0;

    if (prepayment > 0 && mode === 'reduceEmi' && balance > 0) {
      payment = emi(balance, annualRate, months - month);
    }

    totalInterest += interest;
    totalPaid += due + prepayment;
    rows.push({
      month,
      opening,
      emi: due,
      interest,
      principal: principalPart,
      prepayment,
      closing: balance,
    });
  }

  return { rows, totalInterest, totalPaid, monthsTaken: rows.length };
}
