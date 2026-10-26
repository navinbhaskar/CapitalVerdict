/**
 * The guide tables and charts are computed, so they cannot drift from the models. These checks make
 * sure they still agree with the figures the guide text quotes.
 */
import { describe, expect, it } from 'vitest';
import {
  ac,
  breakEvenFigures,
  cngFigures,
  emiFigures,
  rentBuy,
  solarFigures,
  todays,
  carLoan,
  fd,
  lowerEmi,
  plotFigures,
  prepay,
  rebate,
  saving,
  taxRegime,
  planFigures,
} from './guideFigures';

const cell = (rows: string[][], r: number, c: number) => rows[r]![c];

describe('guide figures agree with the guide text', () => {
  it('tax regime: slabs from the data, the three salaries', () => {
    expect(taxRegime.slabs.rows[0]).toEqual(['Up to ₹2.5 lakh', 'Nil', 'Nil']);
    expect(taxRegime.slabs.rows.at(-1)).toEqual(['Above ₹24 lakh', '30%', '30%']);
    expect(taxRegime.examples.rows.map((r) => r.slice(2))).toEqual([
      ['Nil', '₹65,000', 'Never'],
      ['₹97,500', '₹1,79,400', '₹5,43,750'],
      ['₹1,92,400', '₹2,96,400', '₹7,08,333'],
    ]);
  });

  it('₹12 lakh: ₹13 lakh salary pays ₹26,000; the chart starts at nil', () => {
    expect(cell(rebate.steps.rows, 1, 4)).toBe('₹26,000');
    expect(rebate.cliff.series[1]!.values[0]).toBe(0);
  });

  it('SIP vs PPF bars and the 10% row', () => {
    expect(saving.bars.map((b) => b.display)).toEqual([
      '₹37.44 lakh',
      '₹31.56 lakh',
      '₹26.20 lakh',
    ]);
    expect(saving.byReturn.rows[3]).toEqual([
      '10%',
      '₹37.44 lakh',
      '₹31.56 lakh',
      'SIP by ₹5.88 lakh',
    ]);
    expect(saving.sipSteps.at(-1)!.value / 1e5).toBeCloseTo(37.44, 2);
  });

  it('prepay: 8% leaves ₹28.97 lakh against ₹23.30 lakh; 10% flips to invest', () => {
    expect(prepay.byReturn.rows[2]).toEqual([
      '8%',
      '₹28.97 lakh',
      '₹23.30 lakh',
      'Prepay by ₹5.66 lakh',
    ]);
    expect(cell(prepay.byReturn.rows, 4, 3)).toBe('Invest by ₹3.10 lakh');
  });

  it('lower EMI: ₹31,490 EMI, ₹18.42 lakh against ₹5.80 lakh saved', () => {
    expect(lowerEmi.compare.rows[0]).toEqual(['EMI', '₹35,989', '₹31,490']);
    expect(lowerEmi.compare.rows[2]).toEqual(['Interest saved', '₹18.42 lakh', '₹5.80 lakh']);
    expect(lowerEmi.balance.series.every((s) => s.values.at(-1) === 0)).toBe(true);
  });

  it('plot: keeps ₹30.08 lakh; FD ₹34.57 lakh; fund ₹51.71 lakh', () => {
    expect(plotFigures.steps.at(-2)!.value / 1e5).toBeCloseTo(30.08, 2);
    expect(plotFigures.bars.map((b) => b.display)).toEqual([
      '₹30.08 lakh',
      '₹34.57 lakh',
      '₹51.71 lakh',
    ]);
    expect(cell(plotFigures.byGrowth.rows, 2, 1)).toBe('₹39.12 lakh');
  });

  it('FD: 4.82% and −1.12% at the 30% slab; ₹8.94 lakh in today’s rupees', () => {
    expect(fd.bySlab.rows[3]).toEqual(['30% slab', '31.2%', '4.82%', '−1.12%']);
    expect(fd.steps.at(-1)!.value / 1e5).toBeCloseTo(8.94, 2);
  });

  it('AC: 7 years at the label, never at half use', () => {
    expect(ac.byUse.rows[2]).toEqual(['100% of the label', '₹2,450', '7 years', 'Ahead ₹3,573']);
    expect(cell(ac.byUse.rows, 0, 2)).toBe('Not in 10 years');
  });

  it('car loan: cash ahead at 7%, loan at 10%; flat 5% is 9.15%', () => {
    expect(carLoan.byReturn.rows[1]).toEqual(['7%', 'Cash', '₹67,298']);
    expect(carLoan.byReturn.rows[4]).toEqual(['10%', 'Loan', '₹8,927']);
    expect(carLoan.flat.rows[1]).toEqual(['5% flat', '₹16,667', '9.15%']);
  });

  it('solar: 3 kW pays back in 7 years 2 months, ₹4.50 lakh after 25 years; ₹60,000 a kW', () => {
    expect(solarFigures.bySize.rows[2]).toEqual([
      '3 kW',
      '₹1.80 lakh',
      '₹25,200',
      '7 years 2 months',
      '₹4.50 lakh',
    ]);
    expect(solarFigures.net.series[0]!.values.at(-1)).toBeCloseTo(450_000, 0);
  });

  it('CNG: ₹5.66 and ₹4.12 a km; 46 months and ₹1.13 lakh at 1,800 km; 33 months at the old price', () => {
    expect(cngFigures.perKm.rows[2]).toEqual(['Cost a km', '₹5.66', '₹4.12']);
    expect(cngFigures.byKm.rows[3]).toEqual([
      '1,800 km',
      '₹2,778',
      '46 months',
      'CNG ahead ₹1.13 lakh',
    ]);
    expect(cngFigures.update.rows[2]).toEqual([
      'Pays back, counting interest',
      '33 months',
      '46 months',
    ]);
  });

  it('break-even chart: savings pass ₹90,000 at month 33 and the extra with interest at 46', () => {
    const [saved, owed, flat] = breakEvenFigures.race.series.map((s) => s.values as number[]);
    expect(saved!.findIndex((v, m) => v >= flat![m]!)).toBe(33);
    expect(saved!.findIndex((v, m) => v >= owed![m]!)).toBe(46);
  });

  it('rent or buy: ₹38,572 against ₹15,000; flips at 6.58%, 5.64%, 6.32%', () => {
    expect(rentBuy.firstMonth.rows[2]).toEqual(['Paid in all', '₹38,572', '₹15,000']);
    expect(rentBuy.flips.rows.map((r) => r[2])).toEqual([
      'Above 6.58%',
      'Below 5.64%',
      'Below 6.32%',
    ]);
    expect(rentBuy.worth.series[0]!.values.at(-1)! / 1e7).toBeCloseTo(1.09, 2);
  });

  it('EMI: ₹46.37 lakh interest, ₹17.34 lakh owed after 15 years, interest the larger share for 12 years', () => {
    expect(emiFigures.total[1]!.display).toBe('₹46.37 lakh');
    expect(emiFigures.byYear.rows[4]![3]).toBe('₹17.34 lakh');
    const [interest, principal] = emiFigures.split.series.map((s) => s.values as number[]);
    expect(interest!.findIndex((v, i) => v < principal![i]!)).toBe(12);
  });

  it("today's rupees: ₹1 crore in 15 years at 5%, 6%, 7%", () => {
    expect(todays.grid.rows[1]).toEqual(['15 years', '₹48.10 lakh', '₹41.73 lakh', '₹36.24 lakh']);
  });

  it('plan return: 4.8% bar, the PPF line ends ahead, the plan ends ₹15 lakh up', () => {
    expect(planFigures.bars[0]!.note).toBe('4.8% a year');
    expect(planFigures.bars.map((b) => b.display)).toEqual([
      '₹22.50 lakh',
      '₹35.89 lakh',
      '₹61.59 lakh',
    ]);
    const [ppf, plan] = planFigures.net.series.map((s) => s.values as number[]);
    expect(plan!.at(-1)).toBeCloseTo(1_500_000, 6);
    expect(plan![15]).toBe(-750_000);
    expect(plan!.findIndex((v) => v >= 0 && v !== 0)).toBe(28);
    expect(ppf!.at(-1)!).toBeGreaterThan(plan!.at(-1)!);
    expect(planFigures.times.rows[4]).toEqual(['40 years', '2.78%']);
  });
});
