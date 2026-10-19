import { t, type Locale } from '@/i18n/t';
import Block, { type WorkingRow as Row } from './WorkingBlock';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent, formatRupeesPrecise } from '@/lib/formatTool';
import type { CarFuelInput, CarFuelResult } from '@/models/carFuel';

interface Props {
  locale: Locale;
  input: CarFuelInput;
  result: CarFuelResult;
}

/** "Show the working": every intermediate number, with the arithmetic that produced it. */
export default function CarFuelWorking({ locale, input, result }: Props) {
  const { monthlyKm, base, alternative, interestRate, horizonMonths } = input;
  const years = horizonMonths / 12;
  const km = (n: number) => t(locale, 'unit.km', { n: formatNumber(n) });
  const petrolMonthly = result.monthlyCost.base[0]!;
  const cngMonthly = result.monthlyCost.alternative[0]!;
  const savingPerKm = result.costPerKm.base - result.costPerKm.alternative;

  const running: Row[] = [
    {
      label: t(locale, 'working.petrolPerKm'),
      formula: `${formatRupeesPrecise(base.energyPrice)} ÷ ${t(locale, 'unit.kmPerLitre', { n: formatNumber(base.mileage, 2) })}`,
      value: formatRupeesPrecise(result.costPerKm.base),
    },
    {
      label: t(locale, 'working.cngPerKm'),
      formula: `${formatRupeesPrecise(alternative.energyPrice)} ÷ ${t(locale, 'unit.kmPerKg', { n: formatNumber(alternative.mileage, 2) })}`,
      value: formatRupeesPrecise(result.costPerKm.alternative),
    },
    {
      label: t(locale, 'working.savingPerKm'),
      formula: `${formatRupeesPrecise(result.costPerKm.base)} − ${formatRupeesPrecise(result.costPerKm.alternative)}`,
      value: formatRupeesPrecise(savingPerKm),
      negative: savingPerKm < 0,
    },
    {
      label: t(locale, 'working.petrolMonthly'),
      formula: `${km(monthlyKm)} ÷ ${formatNumber(base.mileage, 2)} × ${formatRupeesPrecise(base.energyPrice)}${
        base.annualUpkeep ? ` + ${formatINR(base.annualUpkeep)} ÷ 12` : ''
      }`,
      value: formatINR(petrolMonthly),
    },
    {
      label: t(locale, 'working.cngMonthly'),
      formula: `${km(monthlyKm)} ÷ ${formatNumber(alternative.mileage, 2)} × ${formatRupeesPrecise(alternative.energyPrice)} + ${formatINR(alternative.annualUpkeep)} ÷ 12`,
      value: formatINR(cngMonthly),
    },
    {
      label: t(locale, 'working.monthlySaving'),
      formula: `${formatINR(petrolMonthly)} − ${formatINR(cngMonthly)}`,
      value: formatINR(result.firstMonthSaving),
      strong: true,
      negative: result.firstMonthSaving < 0,
    },
    {
      label: t(locale, 'working.yearlySaving'),
      formula: `${formatINR(result.firstMonthSaving)} × 12`,
      value: formatINR(result.firstMonthSaving * 12),
      negative: result.firstMonthSaving < 0,
    },
  ];

  const never =
    result.firstMonthSaving <= 0
      ? t(locale, 'working.cngNeverCheaper')
      : t(locale, 'working.notWithin', { years });
  const r1 = result.breakevenNoInterest;
  const r2 = result.breakevenWithInterest;
  const result1: Row[] = r1
    ? [
        {
          label: t(locale, 'working.months'),
          value: formatNumber(r1.fractionalMonths, 1),
          strong: true,
        },
        { label: t(locale, 'working.km'), value: formatNumber(r1.fractionalMonths * monthlyKm) },
        { label: t(locale, 'working.years'), value: formatNumber(r1.fractionalMonths / 12, 1) },
      ]
    : [{ label: t(locale, 'working.months'), value: never, strong: true }];
  const result2: Row[] = r2
    ? [
        { label: t(locale, 'working.months'), value: formatNumber(r2.months), strong: true },
        { label: t(locale, 'working.km'), value: formatNumber(r2.km) },
        { label: t(locale, 'working.years'), value: formatNumber(r2.years, 1) },
      ]
    : [{ label: t(locale, 'working.months'), value: never, strong: true }];

  const end = horizonMonths;
  const total = result.totalCost;
  const prices = input.purchasePrices;
  const growth = (1 + interestRate / 12) ** end;
  const tcoRows = (side: 'base' | 'alternative', name: string): Row[] =>
    !total || !prices
      ? []
      : [
          {
            label: t(locale, 'working.tcoPrice', { car: name }),
            formula: `${formatINR(prices[side])} × (1 + ${formatPercent(interestRate)} ÷ 12)^${end}`,
            value: formatMoney(prices[side] * growth),
          },
          {
            label: t(locale, 'working.tcoRunning', { car: name }),
            value: formatMoney(result.cumulativeRunningCost[side][end]!),
          },
          {
            label: t(locale, 'working.tcoTotal', { car: name }),
            value: formatMoney(total[side][end]!),
            strong: true,
          },
        ];
  const tco: Row[] = total
    ? [
        ...tcoRows('base', t(locale, 'fuel.petrol')),
        ...tcoRows('alternative', t(locale, 'fuel.cng')),
        {
          label: t(locale, 'working.tcoDifference'),
          formula: `${formatMoney(total.base[end]!)} − ${formatMoney(total.alternative[end]!)}`,
          value: formatMoney(total.base[end]! - total.alternative[end]!),
          strong: true,
          negative: total.base[end]! - total.alternative[end]! < 0,
        },
      ]
    : [];

  const longRun: Row[] = [
    result.netAt5Years && {
      label: t(locale, 'stat.net5'),
      value: formatMoney(result.netAt5Years.withInterest),
      negative: result.netAt5Years.withInterest < 0,
    },
    years !== 5 && {
      label: years === 10 ? t(locale, 'stat.net10') : t(locale, 'stat.netHorizon', { years }),
      value: formatMoney(result.netAtHorizon.withInterest),
      negative: result.netAtHorizon.withInterest < 0,
      strong: true,
    },
  ].filter(Boolean) as Row[];

  return (
    <section aria-labelledby="working-heading">
      <h2 id="working-heading" class="font-display text-xl font-semibold">
        {t(locale, 'working.heading')}
      </h2>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="grid content-start gap-4">
          <Block title={t(locale, 'working.runningCost')} rows={running} />
          {tco.length > 0 && (
            <Block title={t(locale, 'working.tco', { years })} rows={tco}>
              {t(locale, 'working.tcoNote')}
            </Block>
          )}
        </div>
        <div class="grid gap-4">
          <Block title={t(locale, 'working.result1')} rows={result1}>
            {t(locale, 'working.result1Note')}
          </Block>
          <Block
            title={t(locale, 'working.result2', { rate: formatPercent(interestRate) })}
            rows={result2}
          >
            {t(locale, 'working.result2Note')}
          </Block>
          <Block title={t(locale, 'working.longRun')} rows={longRun}>
            {t(locale, 'stat.netHelp')}
          </Block>
        </div>
      </div>
    </section>
  );
}
