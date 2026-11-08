/**
 * A new car or a used one: what each costs to own for the same number of years, counted on the day
 * you sell it.
 *
 * For each car, month by month:
 *   month 0          the price (less any loan), plus the one-off costs (road tax on a new car,
 *                    transfer charges on a used one)
 *   start of a year  that year's insurance
 *   every month      a twelfth of the yearly upkeep, and the EMI while the loan runs
 *   the last month   the car is sold; any loan still owed is paid off from the sale
 *
 * Every rupee paid out could have stayed invested, so each payment is grown to the sale day at the
 * return you could have earned after tax. Then:
 *
 *   cost of owning = payments, grown to the sale day − (sale price − loan still owed)
 *
 * The car with the lower cost is the better deal. Fuel is left out, as both cars use about the same.
 * Between purchase and sale the car's value is taken to fall in a straight line, only for the
 * month-by-month chart; the answer uses the sale price you enter.
 */
import { emi as loanEmi, outstanding } from '@/engine/loan';
import { effectiveToMonthly } from '@/engine/timeValue';

export type CarKind = 'new' | 'used';

export interface CarSide {
  price: number;
  /** Paid once at purchase: road tax and registration, or transfer charges, ₹. */
  oneOff: number;
  /** A year, paid at the start of each year, ₹. */
  insurance: number;
  /** Servicing and repairs a year, spread over the months, ₹. */
  upkeep: number;
  /** What you expect to sell it for at the end, ₹. */
  sale: number;
  /** Loan rate a year (reducing balance); used only when there is a loan. */
  loanRate: number;
}

export interface NewVsUsedInput {
  new: CarSide;
  used: CarSide;
  years: number;
  /** Share of the price borrowed; 0 means paying cash. */
  loanShare: number;
  loanYears: number;
  /** What money kept invested would earn a year after tax (effective). */
  investmentReturn: number;
}

export interface CarCost {
  loanAmount: number;
  emi: number;
  /** EMIs paid plus the balance cleared at the sale, minus the amount borrowed. */
  interest: number;
  /** Loan still owed when the car is sold, ₹. */
  owedAtSale: number;
  insuranceTotal: number;
  upkeepTotal: number;
  /** Everything paid out, minus what the sale brings in, without growth. */
  plainCost: number;
  /** What the payments could have earned by the sale day. */
  forgone: number;
  /** The answer: plainCost + forgone. */
  cost: number;
  /** Index m = month m (0 … months): cost if sold that month, value falling in a straight line. */
  costByMonth: number[];
}

export interface NewVsUsedResult {
  months: number;
  new: CarCost;
  used: CarCost;
  better: CarKind;
  /** How much less the better car costs, ₹. */
  saving: number;
  /** Index m: new car's cost − used car's cost if both were sold at month m. */
  usedAheadByMonth: number[];
}

function validate(i: NewVsUsedInput): void {
  if (!Number.isInteger(i.years) || i.years < 1)
    throw new RangeError('years must be whole and ≥ 1');
  if (!(i.loanShare >= 0 && i.loanShare < 1))
    throw new RangeError('loan share must be 0 to below 1');
  if (i.loanShare > 0 && !(Number.isInteger(i.loanYears) && i.loanYears >= 1)) {
    throw new RangeError('loan years must be whole and ≥ 1');
  }
  if (!(i.investmentReturn >= 0)) throw new RangeError('return must be zero or more');
  for (const side of [i.new, i.used]) {
    for (const [name, v] of Object.entries(side)) {
      if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
    }
  }
}

function carCost(side: CarSide, input: NewVsUsedInput): CarCost {
  const months = input.years * 12;
  const loanMonths = input.loanYears * 12;
  const loanAmount = side.price * input.loanShare;
  const emi = loanAmount > 0 ? loanEmi(loanAmount, side.loanRate, loanMonths) : 0;
  const grow = effectiveToMonthly(input.investmentReturn);
  const owedAt = (m: number) =>
    loanAmount > 0 ? outstanding(loanAmount, side.loanRate, loanMonths, m) : 0;

  const costByMonth: number[] = [];
  // Payments grown to month m, and the same without growth.
  let grown = side.price - loanAmount + side.oneOff + side.insurance;
  let plain = grown;
  let insuranceTotal = side.insurance;
  let upkeepTotal = 0;
  let emis = 0;
  costByMonth.push(grown - (side.price - loanAmount));
  for (let m = 1; m <= months; m++) {
    const payingEmi = m <= loanMonths ? emi : 0;
    // Insurance for the next year is due at the start of it, if the car is kept that long.
    const renew = m % 12 === 0 && m < months ? side.insurance : 0;
    const paid = side.upkeep / 12 + payingEmi + renew;
    grown = grown * (1 + grow) + paid;
    plain += paid;
    insuranceTotal += renew;
    upkeepTotal += side.upkeep / 12;
    emis += payingEmi;
    const value = side.price + ((side.sale - side.price) * m) / months;
    costByMonth.push(grown - (value - owedAt(m)));
  }
  const owedAtSale = owedAt(months);
  const plainCost = plain + owedAtSale - side.sale;
  const cost = grown + owedAtSale - side.sale;
  return {
    loanAmount,
    emi,
    interest: emis + owedAtSale - loanAmount,
    owedAtSale,
    insuranceTotal,
    upkeepTotal,
    plainCost,
    forgone: cost - plainCost,
    cost,
    costByMonth,
  };
}

export function newVsUsed(input: NewVsUsedInput): NewVsUsedResult {
  validate(input);
  const n = carCost(input.new, input);
  const u = carCost(input.used, input);
  return {
    months: input.years * 12,
    new: n,
    used: u,
    better: u.cost < n.cost ? 'used' : 'new',
    saving: Math.abs(n.cost - u.cost),
    usedAheadByMonth: n.costByMonth.map((c, m) => c - u.costByMonth[m]!),
  };
}
