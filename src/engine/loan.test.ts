import { describe, expect, it } from 'vitest';
import { amortise, emi, outstanding } from './loan';

// Hand-checked: r = 0.09/12 = 0.0075, (1.0075)^240 = 6.009152,
// EMI = 10,00,000 × 0.0075 × 6.009152 / 5.009152 = ₹8,997.26.
const P = 1_000_000;
const RATE = 0.09;
const N = 240;
const EMI = 8997.2596;

describe('emi', () => {
  it('₹10 lakh at 9% for 20 years → ₹8,997.26', () => {
    expect(emi(P, RATE, N)).toBeCloseTo(EMI, 3);
  });

  it('₹5 lakh at 8.5% for 10 years → ₹6,199.28', () => {
    expect(emi(500_000, 0.085, 120)).toBeCloseTo(6199.2844, 3);
  });

  it('zero interest is principal / months', () => {
    expect(emi(120_000, 0, 12)).toBe(10_000);
  });

  it('zero principal is zero', () => {
    expect(emi(0, RATE, N)).toBe(0);
  });

  it('rejects non-positive tenure', () => {
    expect(() => emi(P, RATE, 0)).toThrow(RangeError);
  });
});

describe('outstanding', () => {
  it('after 60 of 240 EMIs → ₹8,87,070.49', () => {
    expect(outstanding(P, RATE, N, 60)).toBeCloseTo(887070.49, 1);
  });

  it('is zero at or after tenure', () => {
    expect(outstanding(P, RATE, N, 240)).toBe(0);
  });

  it('matches the schedule', () => {
    const s = amortise(P, RATE, N);
    expect(s.rows[59]!.closing).toBeCloseTo(outstanding(P, RATE, N, 60), 4);
  });
});

describe('amortise without prepayment', () => {
  const s = amortise(P, RATE, N);

  it('first month: ₹7,500 interest, ₹1,497.26 principal', () => {
    expect(s.rows[0]!.interest).toBeCloseTo(7500, 6);
    expect(s.rows[0]!.principal).toBeCloseTo(1497.2596, 3);
  });

  it('runs exactly the tenure and ends at zero', () => {
    expect(s.monthsTaken).toBe(240);
    expect(s.rows.at(-1)!.closing).toBe(0);
  });

  it('total paid = EMI × 240 and principal sums back to the loan', () => {
    expect(s.totalPaid).toBeCloseTo(EMI * 240, 1);
    const principalSum = s.rows.reduce((sum, row) => sum + row.principal, 0);
    expect(principalSum).toBeCloseTo(P, 4);
    expect(s.totalInterest).toBeCloseTo(EMI * 240 - P, 1);
  });
});

describe('amortise with prepayment', () => {
  const prepayments = [{ month: 12, amount: 200_000 }];

  it('reduce tenure: same EMI, finishes early, less interest', () => {
    const base = amortise(P, RATE, N);
    const s = amortise(P, RATE, N, { prepayments, mode: 'reduceTenure' });
    expect(s.rows[12]!.emi).toBeCloseTo(EMI, 3);
    expect(s.monthsTaken).toBeLessThan(240);
    expect(s.totalInterest).toBeLessThan(base.totalInterest);
  });

  it('reduce EMI: same end date, EMI recomputed on the new balance', () => {
    const s = amortise(P, RATE, N, { prepayments, mode: 'reduceEmi' });
    const balanceAfter = s.rows[11]!.closing;
    expect(s.monthsTaken).toBe(240);
    expect(s.rows[12]!.emi).toBeCloseTo(emi(balanceAfter, RATE, 228), 6);
    expect(s.rows[12]!.emi).toBeLessThan(EMI);
  });

  it('reduce tenure saves more interest than reduce EMI', () => {
    const t = amortise(P, RATE, N, { prepayments, mode: 'reduceTenure' });
    const e = amortise(P, RATE, N, { prepayments, mode: 'reduceEmi' });
    expect(t.totalInterest).toBeLessThan(e.totalInterest);
  });

  it('a prepayment larger than the balance closes the loan', () => {
    const s = amortise(P, RATE, N, { prepayments: [{ month: 1, amount: 5_000_000 }] });
    expect(s.monthsTaken).toBe(1);
    expect(s.rows[0]!.prepayment).toBeCloseTo(P - s.rows[0]!.principal, 6);
  });

  it('rejects negative prepayments', () => {
    expect(() => amortise(P, RATE, N, { prepayments: [{ month: 1, amount: -1 }] })).toThrow();
  });
});
