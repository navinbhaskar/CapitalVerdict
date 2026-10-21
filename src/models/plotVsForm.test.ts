import { describe, expect, it } from 'vitest';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { plotVs } from './plotVs';
import {
  PLOT_VS_EXAMPLE_FORM,
  PLOT_VS_START_FORM,
  invalidPlotVsFields,
  plotVsShareSchema,
  toPlotVsInput,
} from './plotVsForm';

describe('plot vs FD vs fund form', () => {
  it('starts with the visitor’s own figures and unverified rates missing', () => {
    expect(invalidPlotVsFields(PLOT_VS_START_FORM).sort()).toEqual(
      ['fdRate', 'plotPrice', 'sellingCost', 'stampDuty', 'taxRate'].sort(),
    );
    // Scenario-table defaults: 5% plot growth, 10% fund return.
    expect(PLOT_VS_START_FORM).toMatchObject({ plotGrowth: 0.05, fundReturn: 0.1, years: 10 });
  });

  it('the example matches the hand-checked case', () => {
    const r = plotVs(toPlotVsInput(PLOT_VS_EXAMPLE_FORM)!, incomeTax);
    expect(r.best).toBe('fund');
    expect(Math.round(r.plot.net)).toBe(3_008_391);
    expect(Math.round(r.fund.net)).toBe(5_171_211);
  });

  it('needs at least three whole years', () => {
    expect(invalidPlotVsFields({ ...PLOT_VS_EXAMPLE_FORM, years: 2 })).toEqual(['years']);
    expect(invalidPlotVsFields({ ...PLOT_VS_EXAMPLE_FORM, years: 4.5 })).toEqual(['years']);
  });

  it('round-trips through a share link', () => {
    const query = encodeShare(PLOT_VS_EXAMPLE_FORM, plotVsShareSchema);
    expect(decodeShare(`?${query}`, plotVsShareSchema)).toMatchObject({
      plotPrice: 2_000_000,
      taxRate: 0.312,
    });
  });
});
