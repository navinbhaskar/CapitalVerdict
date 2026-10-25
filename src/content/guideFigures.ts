/**
 * The tables and charts in the guides, worked out with the same models as the calculators. Nothing
 * here is typed in by hand: change a model or a data file and every figure follows. Labels are
 * guide copy (see COPY_REVIEW.md); the numbers are not.
 */
import { incomeTax, smallSavings } from '@/data';
import { toTodaysRupees } from '@/engine/timeValue';
import { formatDuration } from '@/lib/duration';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort, formatPercent } from '@/lib/formatTool';
import type { CompareItem } from '@/components/tool/CompareBars';
import { acPayback, type AcInput } from '@/models/ac';
import { cashOrLoan, type CarLoanInput } from '@/models/carLoan';
import { flatToReducing } from '@/models/flatRate';
import { monthlySaving, type MonthlySavingInput } from '@/models/monthlySaving';
import { plotVs, type PlotVsInput } from '@/models/plotVs';
import { prepayOrInvest, type PrepayInput } from '@/models/prepay';
import { breakEvenDeductions, compareRegimes, regimeTax } from '@/models/taxRegime';

export interface TableData {
  head: string[];
  rows: string[][];
  /** Row drawn in brass: the guide's own example. */
  highlight?: number;
}

export interface LineSeries {
  label: string;
  values: (number | null)[];
  tone: 'accent' | 'ink' | 'muted';
  dashed?: boolean;
}

export interface LineData {
  /** One label per point, e.g. "Year 5". The chart shows a few; the table shows all. */
  xLabels: string[];
  /** Points to label on the axis, by index. */
  ticks: number[];
  series: LineSeries[];
}

export interface WaterfallStep {
  label: string;
  value: number;
  /** total: a bar from zero; change: a step up or down from the running total. */
  kind: 'total' | 'change';
  /** The bar the figure is about, drawn in brass. */
  answer?: boolean;
}

const money = formatMoney;
const short = formatMoneyShort;
const pct = formatPercent;
const dur = (months: number) => formatDuration('en', months);
const cess = 1 + incomeTax.cessRate;
const salaryOnly = (salary: number, oldDeductions = 0) => ({
  salary,
  otherIncome: 0,
  oldDeductions,
  newDeductions: 0,
});
const years = (n: number) => Array.from({ length: n + 1 }, (_, y) => y);
const yearLabels = (n: number) => years(n).map((y) => (y === 0 ? 'Today' : `Year ${y}`));

/* ---------- Old or new tax regime ---------- */

function slabRate(income: number, slabs: readonly { upTo: number | null; rate: number }[]) {
  return slabs.find((s) => s.upTo === null || income < s.upTo)!.rate;
}

/** Both regimes' slab rates on one set of income bands. */
function slabTable(): TableData {
  const { new: n, old: o } = incomeTax.regimes;
  const edges = [
    ...new Set([...n.slabs, ...o.slabs].map((s) => s.upTo).filter((x) => x !== null)),
  ].sort((a, b) => a - b);
  const rows = [0, ...edges].map((from, i) => {
    const to = edges[i];
    const band =
      to === undefined
        ? `Above ${short(from)}`
        : from === 0
          ? `Up to ${short(to)}`
          : `${short(from)} to ${short(to)}`;
    const rate = (r: number) => (r === 0 ? 'Nil' : pct(r));
    return [band, rate(slabRate(from, n.slabs)), rate(slabRate(from, o.slabs))];
  });
  return { head: ['Taxable income', 'New regime', 'Old regime'], rows };
}

const threeSalaries: [number, number][] = [
  [1_000_000, 200_000],
  [1_500_000, 250_000],
  [2_000_000, 375_000],
];

export const taxRegime = {
  slabs: slabTable(),
  examples: {
    head: ['Salary', 'Deductions', 'New regime tax', 'Old regime tax', 'Old wins above'],
    rows: threeSalaries.map(([salary, deductions]) => {
      const r = compareRegimes(salaryOnly(salary, deductions), incomeTax);
      const edge = breakEvenDeductions(salaryOnly(salary), incomeTax);
      return [
        short(salary),
        short(deductions),
        r.new.total === 0 ? 'Nil' : formatINR(r.new.total),
        formatINR(r.old.total),
        edge === null ? 'Never' : formatINR(edge),
      ];
    }),
  } satisfies TableData,
  /** Deductions the old regime needs, salary ₹10 lakh to ₹30 lakh. */
  breakEven: (() => {
    const salaries = Array.from({ length: 41 }, (_, i) => 1_000_000 + i * 50_000);
    return {
      xLabels: salaries.map((s) => short(s)),
      ticks: [0, 10, 20, 30, 40],
      series: [
        {
          label: 'Deductions the old regime needs to win',
          values: salaries.map((s) => breakEvenDeductions(salaryOnly(s), incomeTax)),
          tone: 'accent',
        },
      ],
    } satisfies LineData;
  })(),
};

/* ---------- Is ₹12 lakh tax-free? ---------- */

export const rebate = {
  /** Salary ₹11.5 lakh to ₹14 lakh, every ₹5,000: tax with and without marginal relief. */
  cliff: (() => {
    const salaries = Array.from({ length: 51 }, (_, i) => 1_150_000 + i * 5_000);
    const limit = incomeTax.regimes.new.rebate.incomeLimit;
    return {
      xLabels: salaries.map((s) => short(s)),
      ticks: [0, 10, 20, 30, 40, 50],
      series: [
        {
          label: 'Without marginal relief',
          values: salaries.map((s) => {
            const r = regimeTax('new', salaryOnly(s), incomeTax);
            return r.taxable > limit ? r.slabTax * cess : 0;
          }),
          tone: 'muted',
          dashed: true,
        },
        {
          label: 'Tax you pay',
          values: salaries.map((s) => regimeTax('new', salaryOnly(s), incomeTax).total),
          tone: 'accent',
        },
      ],
    } satisfies LineData;
  })(),
  steps: {
    head: ['Salary', 'Taxable', 'Slab tax', 'Rebate or relief', 'You pay'],
    rows: [1_275_000, 1_300_000, 1_325_000, 1_350_000, 1_400_000].map((s) => {
      const r = regimeTax('new', salaryOnly(s), incomeTax);
      return [
        short(s),
        short(r.taxable),
        formatINR(r.slabTax),
        r.rebate > 0 ? `−${formatINR(r.rebate)}` : 'None',
        r.total === 0 ? 'Nil' : formatINR(r.total),
      ];
    }),
    highlight: 1,
  } satisfies TableData,
};

/* ---------- SIP vs PPF vs RD ---------- */

export const sipCase: MonthlySavingInput = {
  monthly: 10_000,
  years: 15,
  sipReturn: 0.1,
  ppfRate: smallSavings.ppf.rate,
  rdRate: 0.07,
  taxRate: 0.312,
  inflation: 0.06,
};

const sip = monthlySaving(sipCase, incomeTax, smallSavings.ppf);

export const saving = {
  bars: [
    {
      label: 'Equity SIP',
      value: sip.sip.net,
      display: money(sip.sip.net),
      tax: sip.sip.tax,
      note: `After ${money(sip.sip.tax)} tax`,
      best: sip.best === 'sip',
    },
    {
      label: 'PPF',
      value: sip.ppf.net,
      display: money(sip.ppf.net),
      note: 'Tax-free',
      best: sip.best === 'ppf',
    },
    {
      label: 'Recurring deposit',
      value: sip.rd.net,
      display: money(sip.rd.net),
      tax: sip.rd.tax,
      note: `After ${money(sip.rd.tax)} tax`,
      best: sip.best === 'rd',
    },
  ] satisfies CompareItem[],
  growth: {
    xLabels: yearLabels(15),
    ticks: [0, 5, 10, 15],
    series: [
      { label: 'Equity SIP, after tax', values: sip.sip.byYear, tone: 'accent' },
      { label: 'PPF', values: sip.ppf.byYear, tone: 'ink' },
      { label: 'Recurring deposit', values: sip.rd.byYear, tone: 'muted', dashed: true },
    ],
  } satisfies LineData,
  byReturn: {
    head: ['Fund return a year', 'SIP keeps', 'PPF keeps', 'Ahead'],
    rows: [0.06, 0.07, 0.08, 0.1, 0.12].map((r) => {
      const x = monthlySaving({ ...sipCase, sipReturn: r }, incomeTax, smallSavings.ppf);
      const lead = x.sip.net - x.ppf.net;
      return [
        pct(r),
        money(x.sip.net),
        money(x.ppf.net),
        `${lead >= 0 ? 'SIP' : 'PPF'} by ${money(Math.abs(lead))}`,
      ];
    }),
    highlight: 3,
  } satisfies TableData,
  /** The whole SIP: what went in, what it grew by, the tax, what is left. */
  sipSteps: [
    { label: 'You put in', value: sip.deposited, kind: 'total' },
    { label: 'Growth', value: sip.sip.value - sip.deposited, kind: 'change' },
    { label: 'Value when sold', value: sip.sip.value, kind: 'total' },
    { label: 'Tax on the gain', value: -sip.sip.tax, kind: 'change' },
    { label: 'You keep', value: sip.sip.net, kind: 'total', answer: true },
  ] satisfies WaterfallStep[],
};

/* ---------- Mutual fund tax ---------- */

const cg = incomeTax.capitalGains;

export const fundTax = {
  rules: {
    head: ['Held', 'Taxed at', 'With cess', 'Tax-free part'],
    rows: [
      [
        `${cg.listedLongTermAfterMonths} months or less`,
        pct(cg.equityShortTermRate),
        pct(cg.equityShortTermRate * cess),
        'None',
      ],
      [
        `Over ${cg.listedLongTermAfterMonths} months`,
        pct(cg.longTermRate),
        pct(cg.longTermRate * cess),
        `First ${money(cg.equityLongTermExemption)} a year`,
      ],
    ],
  } satisfies TableData,
};

/* ---------- Prepay or invest; lower EMI or shorter loan ---------- */

export const prepayCase: PrepayInput = {
  outstanding: 4_000_000,
  loanRate: 0.09,
  yearsLeft: 20,
  lumpSum: 500_000,
  yearlyAmount: 0,
  mode: 'reduceTenure',
  investmentReturn: 0.08,
  prepaymentCharge: 0,
  interestTaxRate: 0,
  interestDeductionCap: 0,
  inflation: 0.06,
};

const keep = prepayOrInvest(prepayCase);
const lower = prepayOrInvest({ ...prepayCase, mode: 'reduceEmi' });
/** Loan owed at the start of each year; year 0 is after the ₹5 lakh goes in. */
const owedByYear = (balance: number[], start: number) =>
  years(20).map((y) => (y === 0 ? start : (balance[y * 12 - 1] ?? 0)));
const loanEnd = (paidOffMonth: number) => `After ${dur(paidOffMonth)}`;

export const prepay = {
  byReturn: {
    head: ['Your return after tax', 'Prepay leaves', 'Invest leaves', 'Ahead'],
    rows: [0.06, 0.07, 0.08, 0.09, 0.1, 0.11].map((r) => {
      const x = prepayOrInvest({ ...prepayCase, investmentReturn: r });
      const d = x.atEnd.difference;
      return [
        pct(r),
        money(x.atEnd.prepay),
        money(x.atEnd.invest),
        `${d >= 0 ? 'Prepay' : 'Invest'} by ${money(Math.abs(d))}`,
      ];
    }),
    highlight: 2,
  } satisfies TableData,
  bars: [
    {
      label: 'Prepay the ₹5 lakh',
      value: keep.atEnd.prepay,
      display: money(keep.atEnd.prepay),
      best: keep.atEnd.difference >= 0,
    },
    {
      label: 'Invest the ₹5 lakh',
      value: keep.atEnd.invest,
      display: money(keep.atEnd.invest),
      best: keep.atEnd.difference < 0,
    },
  ] satisfies CompareItem[],
};

export const lowerEmi = {
  balance: {
    xLabels: yearLabels(20),
    ticks: [0, 5, 10, 15, 20],
    series: [
      {
        label: 'No prepayment',
        values: owedByYear(keep.invest.balance, prepayCase.outstanding),
        tone: 'muted',
        dashed: true,
      },
      {
        label: 'Prepay, lower the EMI',
        values: owedByYear(lower.prepay.balance, prepayCase.outstanding - prepayCase.lumpSum),
        tone: 'ink',
      },
      {
        label: 'Prepay, keep the EMI',
        values: owedByYear(keep.prepay.balance, prepayCase.outstanding - prepayCase.lumpSum),
        tone: 'accent',
      },
    ],
  } satisfies LineData,
  compare: {
    head: ['', 'Keep the EMI', 'Lower the EMI'],
    rows: [
      ['EMI', formatINR(keep.emi), formatINR(lower.emiAfterLump)],
      ['Loan ends', loanEnd(keep.prepay.paidOffMonth), loanEnd(lower.prepay.paidOffMonth)],
      ['Interest saved', money(keep.interestSaved), money(lower.interestSaved)],
      ['Invested after 20 years', money(keep.atEnd.prepay), money(lower.atEnd.prepay)],
    ],
  } satisfies TableData,
};

/* ---------- Plot vs FD vs fund ---------- */

export const plotCase: PlotVsInput = {
  plotPrice: 2_000_000,
  stampDuty: 0.07,
  otherBuyCosts: 20_000,
  yearlyCost: 5_000,
  plotGrowth: 0.05,
  sellingCost: 0.02,
  fdRate: 0.07,
  taxRate: 0.312,
  fundReturn: 0.1,
  years: 10,
  inflation: 0.06,
};

const plot = plotVs(plotCase, incomeTax);

export const plotFigures = {
  steps: [
    { label: 'Sale price after 10 years', value: plot.plot.salePrice, kind: 'total' },
    { label: 'Selling costs', value: -plot.plot.sellingCosts, kind: 'change' },
    { label: 'Capital-gains tax', value: -plot.plot.tax, kind: 'change' },
    { label: 'Upkeep over the years', value: -plot.plot.upkeep, kind: 'change' },
    { label: 'You keep', value: plot.plot.net, kind: 'total', answer: true },
    { label: 'You paid at the start', value: plot.cash, kind: 'total' },
  ] satisfies WaterfallStep[],
  bars: [
    {
      label: 'Plot',
      value: plot.plot.net,
      display: money(plot.plot.net),
      tax: plot.plot.tax,
      note: `After ${money(plot.plot.tax)} tax and all costs`,
      best: plot.best === 'plot',
    },
    {
      label: 'Fixed deposit',
      value: plot.fd.net,
      display: money(plot.fd.net),
      tax: plot.fd.tax,
      note: `After ${money(plot.fd.tax)} tax on the interest`,
      best: plot.best === 'fd',
    },
    {
      label: 'Equity mutual fund',
      value: plot.fund.net,
      display: money(plot.fund.net),
      tax: plot.fund.tax,
      note: `After ${money(plot.fund.tax)} tax`,
      best: plot.best === 'fund',
    },
  ] satisfies CompareItem[],
  byGrowth: {
    head: ['Plot price growth a year', 'Plot leaves', 'A year on your money'],
    rows: [0.03, 0.05, 0.08, 0.1, 0.12].map((g) => {
      const x = plotVs({ ...plotCase, plotGrowth: g }, incomeTax);
      return [pct(g), money(x.plot.net), pct(Number(x.plot.yearlyReturn.toFixed(4)))];
    }),
    highlight: 1,
  } satisfies TableData,
};

/* ---------- FD real return ---------- */

const FD_RATE = 0.07;
const INFLATION = 0.06;
const slabs: [string, number][] = [
  ['No tax', 0],
  ['10% slab', 0.1],
  ['20% slab', 0.2],
  ['30% slab', 0.3],
];
const fdEnd = (tax: number) => 1_000_000 * Math.pow(1 + FD_RATE * (1 - tax), 10);
const signedPct = (r: number) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${pct(Math.abs(r))}`;

export const fd = {
  bySlab: {
    head: ['Your slab', 'Tax with cess', 'After tax', 'After 6% inflation'],
    rows: slabs.map(([label, slab]) => {
      const tax = slab * cess;
      const after = FD_RATE * (1 - tax);
      const real = (1 + after) / (1 + INFLATION) - 1;
      return [label, pct(tax), pct(Number(after.toFixed(4))), signedPct(Number(real.toFixed(4)))];
    }),
    highlight: 3,
  } satisfies TableData,
  /** ₹10 lakh for 10 years at 31.2% tax: interest, tax, then inflation. */
  steps: (() => {
    const gross = fdEnd(0);
    const net = fdEnd(0.3 * cess);
    const today = toTodaysRupees(net, INFLATION, 120);
    return [
      { label: 'You put in', value: 1_000_000, kind: 'total' },
      { label: 'Interest over 10 years', value: gross - 1_000_000, kind: 'change' },
      { label: 'Before tax', value: gross, kind: 'total' },
      { label: 'Tax, and the interest it would have earned', value: net - gross, kind: 'change' },
      { label: 'After tax', value: net, kind: 'total' },
      { label: 'Lost to 6% inflation', value: today - net, kind: 'change' },
      { label: 'In today’s rupees', value: today, kind: 'total', answer: true },
    ] satisfies WaterfallStep[];
  })(),
};

/* ---------- 5-star AC ---------- */

export const acCase: AcInput = {
  basicPrice: 35_000,
  efficientPrice: 45_000,
  basicUnits: 1_100,
  efficientUnits: 750,
  usage: 1,
  pricePerUnit: 7,
  tariffRise: 0.03,
  interestRate: 0.09,
  years: 10,
};

const usages = [0.5, 1, 1.5];

export const ac = {
  byUse: {
    head: ['How much you run it', 'Saves in year 1', 'Pays back', 'After 10 years'],
    rows: [0.5, 0.75, 1, 1.25, 1.5].map((u) => {
      const x = acPayback({ ...acCase, usage: u });
      return [
        `${Math.round(u * 100)}% of the label`,
        formatINR(x.firstYearSaving),
        x.breakevenWithInterest ? dur(x.breakevenWithInterest.months) : 'Not in 10 years',
        `${x.netGain >= 0 ? 'Ahead' : 'Behind'} ${formatINR(Math.abs(x.netGain))}`,
      ];
    }),
    highlight: 2,
  } satisfies TableData,
  net: {
    xLabels: yearLabels(10),
    ticks: [0, 2, 4, 6, 8, 10],
    series: usages.map((u) => {
      const x = acPayback({ ...acCase, usage: u });
      return {
        label: `${Math.round(u * 100)}% of the label`,
        values: years(10).map((y) => x.net[y * 12]!),
        tone: u === 1 ? 'accent' : u > 1 ? 'ink' : 'muted',
        dashed: u < 1,
      } satisfies LineSeries;
    }),
  } satisfies LineData,
};

/* ---------- Car loan or cash ---------- */

export const carCase: CarLoanInput = {
  carPrice: 1_000_000,
  downPayment: 0.2,
  loanRate: 0.09,
  loanYears: 5,
  processingFee: 5000,
  investmentReturn: 0.07,
  inflation: 0.06,
};

const car = cashOrLoan(carCase);

export const carLoan = {
  bars: [
    {
      label: 'Pay cash, invest the EMI each month',
      value: car.atEnd.cash,
      display: money(car.atEnd.cash),
      best: car.atEnd.difference >= 0,
    },
    {
      label: 'Take the loan, keep the savings invested',
      value: car.atEnd.loan,
      display: money(car.atEnd.loan),
      best: car.atEnd.difference < 0,
    },
  ] satisfies CompareItem[],
  byReturn: {
    head: ['Your savings earn after tax', 'Comes out ahead', 'By'],
    rows: [0.06, 0.07, 0.08, 0.09, 0.1, 0.11].map((r) => {
      const d = cashOrLoan({ ...carCase, investmentReturn: r }).atEnd.difference;
      return [pct(r), d >= 0 ? 'Cash' : 'Loan', formatINR(Math.abs(d))];
    }),
    highlight: 1,
  } satisfies TableData,
  flat: {
    head: ['Quoted flat rate', 'EMI on ₹8 lakh, 5 years', 'Real rate a year'],
    rows: [0.04, 0.05, 0.06, 0.07].map((f) => [
      `${pct(f)} flat`,
      formatINR((800_000 * (1 + f * 5)) / 60),
      pct(Number(flatToReducing(f, 5).toFixed(4))),
    ]),
    highlight: 1,
  } satisfies TableData,
};
