import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { planReturn } from './planReturn';
import {
  PLAN_SHAPES,
  applyShape,
  invalidPlanFields,
  planExampleForm,
  planShareSchema,
  shapeKeys,
  toPlanInput,
} from './planReturnForm';

describe('ready-made shapes', () => {
  it('each gives an answer', () => {
    for (const shape of PLAN_SHAPES) {
      const input = toPlanInput(planExampleForm(shape));
      expect(input, shape).not.toBeNull();
      const r = planReturn(input!);
      expect(r.annualReturn).toBeGreaterThan(0);
    }
  });

  it('pay for 15 years, then an income: the worked example', () => {
    const input = toPlanInput(planExampleForm('income'))!;
    expect(input).toMatchObject({
      premium: 50_000,
      payFrequency: 'yearly',
      payYears: 15,
      income: 8_000,
      incomeStartYear: 16,
      incomeYears: 20,
      lumpSums: [{ amount: 500_000, year: 35 }],
      taxRate: 0,
    });
  });

  it('a new shape clears the old steps and keeps the rates', () => {
    const form = { ...planExampleForm('moneyBack'), taxRate: 0.3, inflation: 0.05 };
    const next = applyShape(form, 'single');
    expect(next.lump2).toBeNull();
    expect(next.payFrequency).toBe('once');
    expect(next.taxRate).toBe(0.3);
    expect(next.inflation).toBe(0.05);
    expect(shapeKeys('single')).not.toContain('payFrequency');
  });
});

describe('validation', () => {
  it('pay years are not needed when paid once', () => {
    const form = { ...planExampleForm('single'), payYears: null };
    expect(invalidPlanFields(form)).toEqual([]);
  });

  it('an income needs its start and length; a lump sum needs its year', () => {
    const form = { ...planExampleForm('endowment'), income: 5_000, lump1Year: null };
    expect(invalidPlanFields(form).sort()).toEqual(['incomeStartYear', 'incomeYears', 'lump1Year']);
  });

  it('no answer without any payout', () => {
    const form = { ...planExampleForm('endowment'), lump1: null, lump1Year: null };
    expect(invalidPlanFields(form)).toEqual([]);
    expect(toPlanInput(form)).toBeNull();
  });

  it('the FD comparison is optional, but needs both figures once started', () => {
    const form = planExampleForm();
    expect(form.fdRate).toBeNull();
    expect(invalidPlanFields({ ...form, fdRate: 0.07 })).toEqual(['fdTaxRate']);
  });
});

describe('share link', () => {
  it('round-trips a plan', () => {
    const form = planExampleForm('moneyBack');
    const query = encodeShare(form, planShareSchema);
    expect(decodeShare(`?${query}`, planShareSchema)).toMatchObject({
      shape: 'moneyBack',
      premium: 40_000,
      lump4: 600_000,
      lump4Year: 20,
    });
  });
});
