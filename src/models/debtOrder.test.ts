import { describe, expect, it } from 'vitest';
import { emi } from '@/engine/loan';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { compareDebtOrders, debtOrder, runDebts, type Debt } from './debtOrder';
import { debtExampleForm, debtShareSchema, invalidDebtFields, toDebtInput } from './debtOrderForm';

/** ₹1,000 at 24% (2% a month), paying ₹500; ₹2,000 at 12% (1% a month), paying ₹500. */
const A: Debt = { kind: 'card', balance: 1_000, annualRate: 0.24, payment: 500 };
const B: Debt = { kind: 'personal', balance: 2_000, annualRate: 0.12, payment: 500 };

describe('one debt', () => {
  it('₹1,000 at 12% paying ₹600: cleared in month 2 with ₹14.10 of interest', () => {
    // Month 1: 1,000 + 10 − 600 = 410. Month 2: 410 + 4.10 = 414.10, paid in full.
    const r = runDebts(
      {
        debts: [{ kind: 'other', balance: 1_000, annualRate: 0.12, payment: 600 }],
        extra: 0,
        lumpSum: 0,
      },
      'highRate',
    );
    expect(r.months).toBe(2);
    expect(r.totalInterest).toBeCloseTo(14.1, 8);
    expect(r.paidByMonth).toEqual([0, 600, expect.closeTo(414.1, 8)]);
  });
});

describe('the cleared payment rolls over', () => {
  it('highest rate first: done in month 4, ₹77.33 of interest', () => {
    // Month 1: A 1,020 − 500 = 520; B 2,020 − 500 = 1,520. Interest 40.
    // Month 2: A 530.40 − 500 = 30.40; B 1,535.20 − 500 = 1,035.20. Interest 25.60.
    // Month 3: A 31.008 cleared, and the unused 468.992 goes to B:
    //          B 1,045.552 − 500 − 468.992 = 76.56. Interest 10.96.
    // Month 4: B 77.3256 cleared by its own payment. Interest 0.7656.
    const r = runDebts({ debts: [A, B], extra: 0, lumpSum: 0 }, 'highRate');
    expect(r.order).toEqual([0, 1]);
    expect(r.clearedMonth).toEqual([3, 4]);
    expect(r.months).toBe(4);
    expect(r.totalInterest).toBeCloseTo(77.3256, 8);
    expect(r.balanceByMonth[3]).toBeCloseTo(76.56, 8);
  });

  it('as you are: no rollover, so B takes until month 5 and ₹82.53 of interest', () => {
    // Month 3: B 1,045.552 − 500 = 545.552. Month 4: 551.00752 − 500 = 51.00752.
    // Month 5: 51.5176 cleared. Interest 40 + 25.6 + 10.96 + 5.45552 + 0.5100752.
    const r = runDebts({ debts: [A, B], extra: 0, lumpSum: 0 }, null);
    expect(r.clearedMonth).toEqual([3, 5]);
    expect(r.totalInterest).toBeCloseTo(82.5255952, 6);
  });

  it('the spare money goes to the first debt in the order, and the rest to the next', () => {
    // ₹600 spare: month 1 A is 520 after its payment, cleared by 520 of the spare;
    // the other 80 goes to B: 1,520 − 80 = 1,440.
    const r = runDebts({ debts: [A, B], extra: 600, lumpSum: 0 }, 'highRate');
    expect(r.clearedMonth[0]).toBe(1);
    expect(r.balanceByMonth[1]).toBeCloseTo(1_440, 8);
  });

  it('a one-off amount today goes in the same order before any interest', () => {
    const r = runDebts({ debts: [A, B], extra: 0, lumpSum: 1_200 }, 'highRate');
    expect(r.clearedMonth[0]).toBe(0);
    expect(r.balanceByMonth[0]).toBeCloseTo(1_800, 8);
    expect(r.paidByMonth[0]).toBe(1_200);
  });
});

describe('orders', () => {
  const C: Debt = { kind: 'home', balance: 500, annualRate: 0.09, payment: 100 };
  it('highest rate, smallest balance, lowest rate', () => {
    expect(debtOrder([A, B, C], 'highRate')).toEqual([0, 1, 2]);
    expect(debtOrder([A, B, C], 'smallBalance')).toEqual([2, 0, 1]);
    expect(debtOrder([A, B, C], 'lowRate')).toEqual([2, 1, 0]);
  });

  it('a payment below the interest is flagged, and a debt that never clears has no end month', () => {
    const stuck: Debt = { kind: 'card', balance: 100_000, annualRate: 0.36, payment: 2_000 };
    const r = compareDebtOrders({ debts: [stuck, B], extra: 0, lumpSum: 0 });
    expect(r.notCovering).toEqual([0]);
    expect(r.now.months).toBeNull();
  });
});

describe('the example', () => {
  const input = toDebtInput(debtExampleForm())!;
  const r = compareDebtOrders(input);

  it('uses the EMI for ₹30 lakh at 9% over 15 years', () => {
    expect(Math.round(emi(3_000_000, 0.09, 180))).toBe(30_428);
  });

  it('the card first costs least; the home loan first costs most', () => {
    expect(r.best).toBe('highRate');
    expect(r.orders.highRate.order.map((i) => input.debts[i]!.kind)).toEqual([
      'card',
      'personal',
      'home',
    ]);
    expect(r.orders.highRate.totalInterest).toBeLessThan(
      r.orders.smallBalance.totalInterest + 0.01,
    );
    expect(r.orders.lowRate.totalInterest).toBeGreaterThan(r.orders.highRate.totalInterest);
    expect(r.now.totalInterest).toBeGreaterThan(r.orders.lowRate.totalInterest);
    for (const run of [r.now, ...Object.values(r.orders)]) expect(run.months).not.toBeNull();
  });

  it('every rupee is accounted for: paid = owed + interest', () => {
    for (const run of [r.now, ...Object.values(r.orders)]) {
      expect(run.totalPaid).toBeCloseTo(3_210_000 + run.totalInterest, 4);
    }
  });
});

describe('the form', () => {
  it('needs at least two debts, and every started row in full', () => {
    const form = {
      ...debtExampleForm(),
      d2Balance: null,
      d2Rate: null,
      d2Payment: null,
      d3Payment: null,
    };
    expect(invalidDebtFields(form)).toEqual(['d3Payment']);
    expect(toDebtInput({ ...form, d3Balance: null, d3Rate: null })).toBeNull();
  });

  it('round-trips through a share link', () => {
    const form = { ...debtExampleForm(), lumpSum: 50_000 };
    const filled = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== null));
    expect(decodeShare(`?${encodeShare(form, debtShareSchema)}`, debtShareSchema)).toMatchObject(
      filled,
    );
  });
});
