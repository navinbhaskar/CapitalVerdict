import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { planReturn, type PlanInput } from './planReturn';
import { termVsPlan } from './termVsPlan';
import { invalidTermFields, termExampleForm, termShareSchema, toTermInput } from './termVsPlanForm';
import { PLAN_SHAPES } from './planReturnForm';

/** Pay ₹1 lakh once; get ₹2 lakh at the end of year 10. */
const ONCE: PlanInput = {
  premium: 100_000,
  payFrequency: 'once',
  payYears: 0,
  income: 0,
  incomeFrequency: 'monthly',
  incomeStartYear: 1,
  incomeYears: 0,
  lumpSums: [{ amount: 200_000, year: 10 }],
  taxRate: 0,
  inflation: 0.05,
};
const plan = planReturn(ONCE);

describe('term plus investing against a plan', () => {
  it('free cover at 10%: ₹1 lakh grows to ₹2,59,374, leaving ₹59,374 after the ₹2 lakh', () => {
    // 1,00,000 × 1.1^10 = 2,59,374.25; less the 2,00,000 the plan pays.
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: null,
      investReturn: 0.1,
      inflation: 0.05,
    });
    expect(r.leftover).toBeCloseTo(59_374.25, 1);
    expect(r.shortMonth).toBeNull();
    // Today's rupees: 59,374.25 ÷ 1.05^10 = 36,450.68.
    expect(r.leftoverToday).toBeCloseTo(36_450.68, 1);
  });

  it('the most the term plan can cost: ₹3,386.78 a year', () => {
    // Each yearly rupee of premium, paid at the start of years 1 to 10, would have grown to
    // 1.1^10 + 1.1^9 + … + 1.1 = 11 × (1.1^10 − 1) = 17.5311675 by year 10.
    // 59,374.25 ÷ 17.5311675 = 3,386.78.
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: null,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.maxTermPremium).toBeCloseTo(3_386.78, 1);
    const tie = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: r.maxTermPremium,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(tie.leftover).toBeCloseTo(0, 4);
  });

  it('a ₹5,000 term plan at 10%: ₹28,281.59 short, showing only when the ₹2 lakh comes out', () => {
    // 59,374.25 − 5,000 × 17.5311675 = −28,281.59.
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: 5_000,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.leftover).toBeCloseTo(-28_281.59, 1);
    expect(r.termPaid).toBe(50_000);
    // The fund after the year-7 premium is 1,00,000 × 1.1^6 − 5,000 × (1.1^6 + … + 1) ≈ 1,38,582
    // and stays positive until the ₹2 lakh comes out at the end of year 10.
    expect(r.shortMonth).toBe(120);
  });

  it('without a term premium, the tie is the plan’s own return: 2^(1/10) − 1 = 7.18%', () => {
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: null,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.breakEvenReturn).toBeCloseTo(Math.pow(2, 0.1) - 1, 8);
    expect(r.breakEvenReturn).toBeCloseTo(plan.annualReturn!, 8);
  });

  it('with a term premium, the investment must earn more, and at that rate the two tie', () => {
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: 5_000,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.breakEvenReturn!).toBeGreaterThan(0.1);
    const tie = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: 5_000,
      investReturn: r.breakEvenReturn!,
      inflation: 0,
    });
    expect(tie.leftover).toBeCloseTo(0, 2);
  });

  it('when the plan earns more than the investment, no term price wins', () => {
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: null,
      investReturn: 0.05,
      inflation: 0,
    });
    // 1,00,000 × 1.05^10 = 1,62,889.46, short of 2,00,000 by 37,110.54.
    expect(r.leftover).toBeCloseTo(-37_110.54, 1);
    expect(r.maxTermPremium).toBeNull();
  });

  it('years: what went in, the term premiums, what came out, and the fund at the year end', () => {
    const r = termVsPlan({
      plan,
      coverYears: 10,
      termPremium: 5_000,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.years).toHaveLength(10);
    expect(r.years[0]).toMatchObject({ year: 1, invested: 100_000, term: 5_000, taken: 0 });
    // End of year 1: (1,00,000 − 5,000) × 1.1 = 1,04,500, before the year-2 premium.
    expect(r.years[0]!.balance).toBeCloseTo(104_500, 4);
    expect(r.years[9]).toMatchObject({ year: 10, invested: 0, term: 5_000, taken: 200_000 });
    expect(r.years[9]!.balance).toBeCloseTo(r.leftover, 6);
  });

  it('cover that outlasts the plan keeps the timeline going', () => {
    const r = termVsPlan({
      plan,
      coverYears: 15,
      termPremium: 1_000,
      investReturn: 0.1,
      inflation: 0,
    });
    expect(r.months).toBe(168);
    expect(r.termPaid).toBe(15_000);
  });
});

describe('the form', () => {
  it('starts on the endowment example with no term price, at PPF’s rate', () => {
    const form = termExampleForm();
    expect(form).toMatchObject({
      shape: 'endowment',
      premium: 100_000,
      payYears: 12,
      lump1: 2_000_000,
      lump1Year: 20,
      cover: 1_000_000,
      coverYears: 20,
      termPremium: null,
      investReturn: 0.071,
    });
    expect(invalidTermFields(form)).toEqual([]);
  });

  it('every shape gives an answer', () => {
    for (const shape of PLAN_SHAPES) {
      const input = toTermInput(termExampleForm(shape));
      expect(input, shape).not.toBeNull();
      const r = termVsPlan({ ...input!, plan: planReturn(input!.plan), inflation: 0.05 });
      expect(Number.isFinite(r.leftover), shape).toBe(true);
    }
  });

  it('the endowment example: ₹1 lakh a year for 12 years into PPF beats ₹20 lakh in year 20', () => {
    // Twelve yearly ₹1 lakh deposits at 7.1% grow to 1,00,000 × (1.071^12 − 1) ÷ 0.071 × 1.071
    // = 19,22,105.4 by the end of year 12, then × 1.071^8 = 33,30,883 at year 20; less ₹20 lakh.
    const input = toTermInput(termExampleForm())!;
    const r = termVsPlan({ ...input, plan: planReturn(input.plan), inflation: 0.05 });
    const fv12 = (100_000 * (Math.pow(1.071, 12) - 1) * 1.071) / 0.071;
    expect(r.leftover).toBeCloseTo(fv12 * Math.pow(1.071, 8) - 2_000_000, 0);
  });

  it('needs the cover, its years and a return; the term premium may wait', () => {
    const form = { ...termExampleForm(), cover: null, coverYears: 2.5, investReturn: null };
    expect(invalidTermFields(form).sort()).toEqual(['cover', 'coverYears', 'investReturn']);
    expect(toTermInput(form)).toBeNull();
  });

  it('ignores the plan calculator’s comparison rates', () => {
    const form = { ...termExampleForm(), fundReturn: null, fdRate: 5, fdTaxRate: null };
    expect(invalidTermFields(form)).toEqual([]);
  });

  it('round-trips through a share link', () => {
    const form = { ...termExampleForm(), termPremium: 9_500 };
    const query = encodeShare(form, termShareSchema);
    const filled = Object.fromEntries(
      Object.entries(form).filter(
        ([k, v]) => v !== null && !['fundReturn', 'fdRate', 'fdTaxRate'].includes(k),
      ),
    );
    expect(decodeShare(`?${query}`, termShareSchema)).toMatchObject(filled);
    expect(query).not.toMatch(/(^|&)(r|fd|fdt)=/);
  });
});
