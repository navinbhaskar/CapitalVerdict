/**
 * Several debts, each with its own balance, rate and monthly payment, and some money to spare each
 * month (and perhaps once, today). Which debt should the spare money go to first?
 *
 * Each month, for every debt still owed:
 * 1. Interest is added at the yearly rate ÷ 12 on the balance, as Indian lenders quote loans.
 *    A credit card is treated the same way: its yearly rate ÷ 12 on what is carried over.
 * 2. Its regular payment is made (or the whole balance, if that is less).
 * Then the spare money goes to the first debt in the chosen order that is still owed, and anything
 * left over to the next. When a debt is cleared, its regular payment joins the spare money from
 * then on (and any part of it not needed in the month it clears).
 *
 * A one-off amount today goes to the debts in the same order before the first month.
 * "As you are" pays only the regular payments, with no spare money and no rollover.
 */
import { nominalToMonthly } from '@/engine/timeValue';

export type DebtKind = 'card' | 'personal' | 'car' | 'home' | 'other';
export const DEBT_KINDS: readonly DebtKind[] = ['card', 'personal', 'car', 'home', 'other'];

export type DebtOrder = 'highRate' | 'smallBalance' | 'lowRate';
export const DEBT_ORDERS: readonly DebtOrder[] = ['highRate', 'smallBalance', 'lowRate'];

export interface Debt {
  kind: DebtKind;
  /** Owed today, ₹. */
  balance: number;
  /** Yearly rate, decimal. */
  annualRate: number;
  /** Regular payment a month, ₹ (EMI or what you pay on the card). */
  payment: number;
}

export interface DebtInput {
  debts: readonly Debt[];
  /** Spare money a month on top of the regular payments, ₹. */
  extra: number;
  /** Spare money once, today, ₹; 0 for none. */
  lumpSum: number;
}

/** No plan runs longer than this; past it the debts are reported as never cleared. */
export const MAX_MONTHS = 600;

export interface DebtRun {
  /** Months until every debt is cleared; null if not within MAX_MONTHS. */
  months: number | null;
  totalInterest: number;
  /** Everything paid, including the one-off amount, ₹. */
  totalPaid: number;
  /** Month each debt is cleared (0 = by the one-off amount today), in input order; null if never. */
  clearedMonth: (number | null)[];
  /** Order in which spare money is aimed, as input indexes. */
  order: number[];
  /** Total owed after each month, index 0 = today after any one-off amount. */
  balanceByMonth: number[];
  /** Interest added each month, index 0 = 0. */
  interestByMonth: number[];
  /** Paid each month, index 0 = the one-off amount. */
  paidByMonth: number[];
}

/** Input indexes in the order spare money goes to them. Ties keep the input order. */
export function debtOrder(debts: readonly Debt[], order: DebtOrder): number[] {
  const idx = debts.map((_, i) => i);
  const by: Record<DebtOrder, (a: number, b: number) => number> = {
    highRate: (a, b) =>
      debts[b]!.annualRate - debts[a]!.annualRate || debts[a]!.balance - debts[b]!.balance,
    smallBalance: (a, b) =>
      debts[a]!.balance - debts[b]!.balance || debts[b]!.annualRate - debts[a]!.annualRate,
    lowRate: (a, b) =>
      debts[a]!.annualRate - debts[b]!.annualRate || debts[a]!.balance - debts[b]!.balance,
  };
  return idx.sort((a, b) => by[order](a, b) || a - b);
}

/** Run the debts month by month: with spare money aimed in `order`, or as they are (`null`). */
export function runDebts(input: DebtInput, order: DebtOrder | null): DebtRun {
  const { debts } = input;
  const aim = order === null ? debts.map((_, i) => i) : debtOrder(debts, order);
  const balance = debts.map((d) => d.balance);
  const rates = debts.map((d) => nominalToMonthly(d.annualRate));
  const clearedMonth: (number | null)[] = debts.map((d) => (d.balance <= 0 ? 0 : null));
  const owed = (i: number) => balance[i]! > 0.005;
  const clear = (i: number, month: number) => {
    balance[i] = 0;
    clearedMonth[i] = month;
  };

  /** Pays `amount` into the debts in aim order; returns what was used. */
  const pour = (amount: number, month: number) => {
    let left = amount;
    for (const i of aim) {
      if (left <= 0) break;
      if (!owed(i)) continue;
      const pay = Math.min(left, balance[i]!);
      balance[i]! -= pay;
      left -= pay;
      if (!owed(i)) clear(i, month);
    }
    return amount - left;
  };

  const lump = order === null ? 0 : pour(input.lumpSum, 0);
  const total = () => balance.reduce((s, b) => s + b, 0);
  const balanceByMonth = [total()];
  const interestByMonth = [0];
  const paidByMonth = [lump];
  let totalInterest = 0;
  let totalPaid = lump;
  let months: number | null = debts.every((_, i) => !owed(i)) ? 0 : null;

  for (let m = 1; m <= MAX_MONTHS && months === null; m++) {
    let interest = 0;
    let paid = 0;
    // Spare money this month: the extra, plus the payments of debts already cleared.
    let spare = order === null ? 0 : input.extra;
    for (let i = 0; i < debts.length; i++) {
      if (!owed(i)) {
        if (order !== null) spare += debts[i]!.payment;
        continue;
      }
      const added = balance[i]! * rates[i]!;
      balance[i]! += added;
      interest += added;
      const pay = Math.min(debts[i]!.payment, balance[i]!);
      balance[i]! -= pay;
      paid += pay;
      if (!owed(i)) {
        clear(i, m);
        if (order !== null) spare += debts[i]!.payment - pay;
      }
    }
    if (order !== null) paid += pour(spare, m);
    totalInterest += interest;
    totalPaid += paid;
    balanceByMonth.push(total());
    interestByMonth.push(interest);
    paidByMonth.push(paid);
    if (debts.every((_, i) => !owed(i))) months = m;
  }

  return {
    months,
    totalInterest,
    totalPaid,
    clearedMonth,
    order: aim,
    balanceByMonth,
    interestByMonth,
    paidByMonth,
  };
}

export interface DebtResult {
  /** Regular payments only. */
  now: DebtRun;
  /** Each order, with the spare money. */
  orders: Record<DebtOrder, DebtRun>;
  /** The order with the least interest (ties go to the earlier in DEBT_ORDERS). */
  best: DebtOrder;
  /** Debts whose regular payment does not cover the first month's interest, by input index. */
  notCovering: number[];
}

export function compareDebtOrders(input: DebtInput): DebtResult {
  const orders = Object.fromEntries(DEBT_ORDERS.map((o) => [o, runDebts(input, o)])) as Record<
    DebtOrder,
    DebtRun
  >;
  const cost = (r: DebtRun) => (r.months === null ? Infinity : r.totalInterest);
  const best = DEBT_ORDERS.reduce((a, b) => (cost(orders[b]) < cost(orders[a]) - 0.005 ? b : a));
  return {
    now: runDebts(input, null),
    orders,
    best,
    notCovering: input.debts
      .map((d, i) => (d.payment <= d.balance * nominalToMonthly(d.annualRate) ? i : -1))
      .filter((i) => i >= 0),
  };
}
