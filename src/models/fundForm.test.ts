import { describe, expect, it } from 'vitest';
import { fundExampleForm, invalidFundFields, toFundInput } from './fundForm';

describe('fund forms', () => {
  it('each example gives an answer straight away', () => {
    for (const mode of ['sip', 'lumpsum', 'swp'] as const) {
      expect(invalidFundFields(mode, fundExampleForm(mode)), mode).toEqual([]);
      expect(toFundInput(mode, fundExampleForm(mode)), mode).not.toBeNull();
    }
  });

  it('a calculator ignores fields it does not use', () => {
    const form = { ...fundExampleForm('sip'), lumpSum: 999_999, withdrawal: 5_000 };
    const input = toFundInput('sip', form)!;
    expect(input.lumpSum).toBe(0);
    expect(input.withdrawal).toBe(0);
    expect(input.monthly).toBe(10_000);
  });

  it('the FD comparison is optional; years must be whole', () => {
    const lump = fundExampleForm('lumpsum');
    expect(invalidFundFields('lumpsum', { ...lump, fdRate: null, taxRate: null })).toEqual([]);
    expect(invalidFundFields('lumpsum', { ...lump, years: 2.5 })).toEqual(['years']);
    expect(invalidFundFields('swp', { ...fundExampleForm('swp'), withdrawal: null })).toEqual([
      'withdrawal',
    ]);
  });
});
