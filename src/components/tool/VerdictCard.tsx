import type { ComponentChildren } from 'preact';
import { t, type Locale } from '@/i18n/t';
import { formatMoney, formatNumber, formatPercent, formatRupeesPrecise } from '@/lib/formatTool';
import type { ScenarioName, ScenarioRun } from '@/engine/scenarios';
import type { CarFuelInput, CarFuelResult } from '@/models/carFuel';

interface Props {
  locale: Locale;
  input: CarFuelInput;
  /** The user's own result. */
  result: CarFuelResult;
  /** Price-rise scenarios, for the range line. */
  runs: Record<ScenarioName, ScenarioRun<CarFuelInput, CarFuelResult>>;
  baseName: string;
  altName: string;
}

/** Verdict, break-even badge, scenario range and headline numbers. */
export default function VerdictCard({ locale, input, result, runs, baseName, altName }: Props) {
  const years = input.horizonMonths / 12;
  const be = result.breakevenWithInterest;
  const km = (n: number) => t(locale, 'unit.km', { n: formatNumber(n) });

  const scenarioMonths = (['pessimistic', 'base', 'optimistic'] as const).map(
    (s) => runs[s].output.breakevenWithInterest?.months ?? null,
  );
  const reached = scenarioMonths.filter((m): m is number => m !== null);
  const monthsText = (m: number | null) =>
    m === null ? t(locale, 'verdict.notWithin', { years }) : t(locale, 'unit.months', { n: m });
  const range =
    reached.length === 0
      ? null
      : new Set(scenarioMonths).size === 1
        ? t(locale, 'verdict.rangeSame', { value: monthsText(scenarioMonths[0]!) })
        : t(locale, 'verdict.range', {
            low: monthsText(Math.min(...reached)),
            high: monthsText(reached.length < 3 ? null : Math.max(...reached)),
          });

  const netRows: { label: string; net: number | null }[] = [
    { label: t(locale, 'stat.net5'), net: result.netAt5Years?.withInterest ?? null },
    years === 10
      ? { label: t(locale, 'stat.net10'), net: result.netAt10Years?.withInterest ?? null }
      : { label: t(locale, 'stat.netHorizon', { years }), net: result.netAtHorizon.withInterest },
  ];

  return (
    <section
      aria-labelledby="verdict-heading"
      class="rounded-2xl border border-line bg-page p-5 shadow-[var(--shadow-raised)] sm:p-7"
    >
      <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
      <h2
        id="verdict-heading"
        class="mt-2 text-[1.625rem] leading-tight font-semibold tracking-[-0.015em] sm:text-[1.875rem]"
        aria-live="polite"
      >
        {be
          ? t(locale, 'verdict.paysBack', { alt: altName, months: be.months })
          : t(locale, 'verdict.never', { base: baseName, years })}
      </h2>
      <p class="mt-2 text-ink-muted">
        {be
          ? t(locale, 'verdict.paysBackDetail', {
              km: km(be.km),
              rate: formatPercent(input.interestRate),
            })
          : t(locale, 'verdict.neverDetail', { alt: altName, years })}
      </p>
      {range && (
        <p class="mt-3 inline-flex rounded-full bg-surface px-3 py-1 text-sm text-ink-muted">
          {range}
        </p>
      )}

      <dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6">
        <Stat label={t(locale, 'stat.monthlySaving')}>{formatMoney(result.firstMonthSaving)}</Stat>
        <Stat label={t(locale, 'stat.costPerKm')}>
          <span class="text-base">
            {t(locale, 'stat.costPerKmValue', {
              base: formatRupeesPrecise(result.costPerKm.base),
              alt: formatRupeesPrecise(result.costPerKm.alternative),
            })}
          </span>
        </Stat>
        {netRows.map((row) => (
          <Stat key={row.label} label={row.label}>
            <span class={row.net !== null && row.net < 0 ? 'text-danger' : ''}>
              {row.net === null ? '—' : formatMoney(row.net)}
            </span>
          </Stat>
        ))}
        <Stat label={t(locale, 'stat.breakevenNoInterest')}>
          {result.breakevenNoInterest
            ? t(locale, 'unit.months', {
                n: formatNumber(result.breakevenNoInterest.fractionalMonths, 1),
              })
            : t(locale, 'stat.notReached')}
        </Stat>
      </dl>
      <p class="mt-5 text-xs text-ink-muted">{t(locale, 'stat.netHelp')}</p>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-sm text-ink-muted">{label}</dt>
      <dd class="mt-1 text-lg font-semibold num">{children}</dd>
    </div>
  );
}
