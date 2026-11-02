import { describe, expect, it } from 'vitest';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { hraCalc } from './hra';
import {
  HRA_CITIES,
  SLAB_RATES,
  hraExampleForm,
  hraShareSchema,
  invalidHraFields,
  toHraInput,
} from './hraForm';

describe('HRA exemption (Rule 279)', () => {
  it('the example in Bengaluru: rent minus 10% of salary is the least, ₹2.76 lakh', () => {
    // A year: salary 6,00,000, HRA 3,00,000, rent 3,36,000.
    // 1. HRA received 3,00,000. 2. Rent − 10% of salary = 3,36,000 − 60,000 = 2,76,000.
    // 3. 50% of salary (Bengaluru) = 3,00,000. Least: 2,76,000; taxable HRA 24,000.
    // Tax saved at 30% + 4% cess: 2,76,000 × 0.312 = 86,112.
    const r = hraCalc(toHraInput(hraExampleForm())!, incomeTax);
    expect(r.limits).toEqual({ received: 300_000, rent: 276_000, salaryShare: 300_000 });
    expect(r.binding).toBe('rent');
    expect(r.exempt).toBe(276_000);
    expect(r.taxable).toBe(24_000);
    expect(r.taxSaved).toBeCloseTo(86_112, 6);
  });

  it('elsewhere the limit is 40% of salary', () => {
    // 40% of 6,00,000 = 2,40,000, now the least.
    const r = hraCalc({ ...toHraInput(hraExampleForm())!, largeCity: false }, incomeTax);
    expect(r.limits.salaryShare).toBe(240_000);
    expect(r.binding).toBe('salaryShare');
    expect(r.exempt).toBe(240_000);
  });

  it('rent below 10% of salary leaves nothing exempt', () => {
    const r = hraCalc({ ...toHraInput(hraExampleForm())!, rentPaid: 4_000 }, incomeTax);
    expect(r.limits.rent).toBe(0);
    expect(r.exempt).toBe(0);
    expect(r.taxable).toBe(300_000);
  });

  it('only the months you rent count', () => {
    // 6 months: salary 3,00,000, HRA 1,50,000, rent 1,68,000 − 30,000 = 1,38,000.
    const r = hraCalc({ ...toHraInput(hraExampleForm())!, months: 6 }, incomeTax);
    expect(r.exempt).toBe(138_000);
  });
});

describe('HRA form', () => {
  it('lists the eight 50% cities and the old regime slab rates', () => {
    expect(HRA_CITIES).toHaveLength(9);
    expect(HRA_CITIES.at(-1)).toBe('other');
    expect(SLAB_RATES).toEqual([0.05, 0.2, 0.3]);
  });

  it('needs every amount; months are whole, 1 to 12', () => {
    expect(invalidHraFields({ ...hraExampleForm(), rentPaid: null, months: 13 }).sort()).toEqual([
      'months',
      'rentPaid',
    ]);
  });

  it('round-trips through a share link, snapping the slab rate', () => {
    const form = { ...hraExampleForm(), city: 'other', slabRate: 0.2 };
    expect(decodeShare(`?${encodeShare(form, hraShareSchema)}`, hraShareSchema)).toMatchObject(
      form,
    );
    expect(toHraInput({ ...form, slabRate: 0.21 })!.slabRate).toBe(0.2);
  });
});
