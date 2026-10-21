/**
 * AC payback: is the more efficient (pricier) AC worth its extra price?
 *
 * Each AC's yearly units come from its star label, scaled by how much the visitor runs it compared
 * with the label's assumption (usage 1 = as labelled). Units are spread evenly over the months;
 * the price per unit steps up once a year by the tariff rise.
 *
 *   saving(month)   = (basic units − efficient units) × usage ÷ 12 × price per unit(month)
 *   break-even      = first month the savings so far cover the extra price
 *   with interest   = … cover extra price × (1 + r/12)^month (the car fuel tool's convention:
 *                     the extra price carries its borrowing or opportunity cost; savings are
 *                     not reinvested)
 *   net gain        = savings over the years − extra price with interest
 */
import { breakeven, cumulative } from '@/engine/breakeven';
import { findFlip, type Flip } from '@/engine/sensitivity';
import { growthFactor, nominalToMonthly, yearlySteppedPrice } from '@/engine/timeValue';

export interface AcInput {
  /** Price of the cheaper AC, ₹. */
  basicPrice: number;
  /** Price of the more efficient AC, ₹. */
  efficientPrice: number;
  /** Units (kWh) a year on each AC's star label. */
  basicUnits: number;
  efficientUnits: number;
  /** How much you run it compared with the label, decimal (1 = as labelled). */
  usage: number;
  /** Average ₹ per unit on your bill at the start. */
  pricePerUnit: number;
  /** Yearly rise in the price per unit, decimal. */
  tariffRise: number;
  /** Interest on the extra price, annual nominal, monthly compounding. */
  interestRate: number;
  years: number;
}

export interface AcResult {
  months: number;
  extraPrice: number;
  /** Units saved a year at your usage. */
  unitsSavedYearly: number;
  /** Saving in the first year, ₹. */
  firstYearSaving: number;
  /** Saving each month, index 0 = month 1. */
  monthlySaving: number[];
  /** Savings so far, index = month, 0 = today (0). */
  cumulativeSaving: number[];
  /** Extra price with interest, index = month. */
  extraWithInterest: number[];
  /** Savings so far − extra price with interest, index = month. */
  net: number[];
  breakevenNoInterest: { months: number; fractionalMonths: number } | null;
  breakevenWithInterest: { months: number; fractionalMonths: number } | null;
  /** Net gain after the years, ₹. Positive = the efficient AC pays. */
  netGain: number;
  totalSaving: number;
}

function validate(i: AcInput): void {
  for (const [name, v] of Object.entries(i)) {
    if (!(v >= 0)) throw new RangeError(`${name} must not be negative`);
  }
  if (!Number.isInteger(i.years) || i.years < 1) {
    throw new RangeError('years must be a positive whole number');
  }
}

export function acPayback(input: AcInput): AcResult {
  validate(input);
  const months = input.years * 12;
  const extraPrice = input.efficientPrice - input.basicPrice;
  const unitsSavedYearly = (input.basicUnits - input.efficientUnits) * input.usage;
  const r = nominalToMonthly(input.interestRate);

  const monthlySaving: number[] = [];
  for (let m = 1; m <= months; m++) {
    const price = yearlySteppedPrice(input.pricePerUnit, input.tariffRise, m);
    monthlySaving.push((unitsSavedYearly / 12) * price);
  }
  const cumulativeSaving = cumulative(monthlySaving);
  const extraWithInterest = cumulativeSaving.map((_, m) => extraPrice * growthFactor(r, m));
  const net = cumulativeSaving.map((s, m) => s - extraWithInterest[m]!);
  const flat = cumulativeSaving.map(() => extraPrice);

  const toResult = (b: ReturnType<typeof breakeven>) =>
    b ? { months: b.month, fractionalMonths: b.fractionalMonth } : null;
  return {
    months,
    extraPrice,
    unitsSavedYearly,
    firstYearSaving: cumulativeSaving[Math.min(12, months)]!,
    monthlySaving,
    cumulativeSaving,
    extraWithInterest,
    net,
    breakevenNoInterest: extraPrice > 0 ? toResult(breakeven(cumulativeSaving, flat)) : null,
    breakevenWithInterest:
      extraPrice > 0 ? toResult(breakeven(cumulativeSaving, extraWithInterest)) : null,
    netGain: net[months]!,
    totalSaving: cumulativeSaving[months]!,
  };
}

export type AcVariable = 'usage' | 'pricePerUnit' | 'efficientPrice';

export interface AcFlip extends Flip {
  variable: AcVariable;
}

/** Where the efficient AC's net gain after the years crosses zero, one input at a time. */
export function acFlips(input: AcInput, only?: AcVariable[]): AcFlip[] {
  const gain = (i: AcInput) => acPayback(i).netGain;
  const probes: { variable: AcVariable; lo: number; hi: number }[] = [
    { variable: 'usage', lo: 0, hi: 4 },
    { variable: 'pricePerUnit', lo: 0, hi: 30 },
    { variable: 'efficientPrice', lo: input.basicPrice, hi: input.basicPrice * 3 + 1 },
  ];
  const flips: AcFlip[] = [];
  for (const { variable, lo, hi } of probes) {
    if (only && !only.includes(variable)) continue;
    const flip = findFlip((x) => gain({ ...input, [variable]: x }), { lo, hi, steps: 60 });
    if (flip) flips.push({ variable, ...flip });
  }
  return flips;
}
