/**
 * A loan's EMI, where it goes, and what a yearly prepayment does. Interest is charged monthly at
 * the yearly rate ÷ 12 on the balance (reducing balance), as Indian banks quote loans. A yearly
 * prepayment is made after every 12th EMI and keeps the EMI the same, so the loan ends sooner.
 */
import { amortise, emi as emiOf, type Schedule } from '@/engine/loan';
import { toTodaysRupees } from '@/engine/timeValue';

export interface EmiInput {
  /** Borrowed, ₹. */
  amount: number;
  /** Yearly rate, decimal (9% = 0.09). */
  annualRate: number;
  /** Whole years. */
  years: number;
  /** Paid off after every 12th EMI, ₹; 0 for none. */
  yearlyPrepayment: number;
  /** For the last EMI in today's rupees. */
  inflation: number;
}

export interface EmiYear {
  year: number;
  /** EMIs paid in the year, ₹. */
  paid: number;
  interest: number;
  principal: number;
  prepayment: number;
  /** Balance at the end of the year, ₹. */
  balance: number;
}

export interface EmiResult {
  emi: number;
  months: number;
  schedule: Schedule;
  totalInterest: number;
  /** Everything paid: EMIs and prepayments. */
  totalPaid: number;
  /** Share of the first EMI that is interest. */
  firstInterestShare: number;
  /** First year in which more of the EMIs repay the loan than pay interest; null if never. */
  crossoverYear: number | null;
  /** The last EMI in today's rupees. */
  lastEmiToday: number;
  years: EmiYear[];
  /** The same loan without the prepayments, for comparison; null when there are none. */
  withoutPrepayment: Schedule | null;
}

export function emiPlan(input: EmiInput): EmiResult {
  const months = input.years * 12;
  const payment = emiOf(input.amount, input.annualRate, months);
  const prepayments =
    input.yearlyPrepayment > 0
      ? Array.from({ length: input.years - 1 }, (_, i) => ({
          month: 12 * (i + 1),
          amount: input.yearlyPrepayment,
        }))
      : [];
  const schedule = amortise(input.amount, input.annualRate, months, { prepayments });

  const years: EmiYear[] = [];
  for (const row of schedule.rows) {
    const y = Math.ceil(row.month / 12);
    if (!years[y - 1]) {
      years[y - 1] = { year: y, paid: 0, interest: 0, principal: 0, prepayment: 0, balance: 0 };
    }
    const year = years[y - 1]!;
    year.paid += row.emi;
    year.interest += row.interest;
    year.principal += row.principal;
    year.prepayment += row.prepayment;
    year.balance = row.closing;
  }
  const crossover = years.find((y) => y.principal > y.interest);
  const last = schedule.rows.at(-1)!;

  return {
    emi: payment,
    months: schedule.monthsTaken,
    schedule,
    totalInterest: schedule.totalInterest,
    totalPaid: schedule.totalPaid,
    firstInterestShare: payment > 0 ? schedule.rows[0]!.interest / payment : 0,
    crossoverYear: crossover?.year ?? null,
    lastEmiToday: toTodaysRupees(last.emi, input.inflation, last.month),
    years,
    withoutPrepayment:
      prepayments.length > 0 ? amortise(input.amount, input.annualRate, months) : null,
  };
}

/** EMI and total interest at other rates or tenures, for "what would change it". */
export function emiAt(amount: number, annualRate: number, years: number) {
  const s = amortise(amount, annualRate, years * 12);
  return { emi: emiOf(amount, annualRate, years * 12), totalInterest: s.totalInterest };
}
