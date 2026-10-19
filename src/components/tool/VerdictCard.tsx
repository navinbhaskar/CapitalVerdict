import type { ComponentChildren } from 'preact';
import { t, type Locale } from '@/i18n/t';
import { formatMoney, formatNumber, formatPercent, formatRupeesPrecise } from '@/lib/formatTool';
import type { ScenarioName, ScenarioRun } from '@/engine/scenarios';
import type { CarFuelInput, CarFuelResult, CarFuelVerdict } from '@/models/carFuel';

interface Props {
  locale: Locale;
  input: CarFuelInput;
  /** Petrol vs CNG, CNG as the alternative: drives the stats. */
  result: CarFuelResult;
  /** The headline, asked of whichever car costs more to buy. */
  verdict: CarFuelVerdict;
  /** Comparison with the dearer car as the alternative (for the no-interest break-even). */
  basis: CarFuelResult;
  /** Price-rise scenarios on the same basis, for the range line. */
  runs: Record<ScenarioName, ScenarioRun<CarFuelInput, CarFuelResult>>;
  baseName: string;
  altName: string;
}

/** The one-line answer, shared by the verdict card and the mobile result bar. */
export function verdictHeadline(
  locale: Locale,
  verdict: CarFuelVerdict,
  names: { base: string; alternative: string },
  years: number,
): string {
  switch (verdict.kind) {
    case 'payback':
      return t(locale, 'verdict.paysBack', { alt: names[verdict.payer], months: verdict.months });
    case 'never':
      return t(locale, 'verdict.never', { base: names[verdict.winner], years });
    case 'dominant':
      return t(locale, 'verdict.dominant', { winner: names[verdict.winner] });
    case 'tie':
      return t(locale, 'verdict.tie');
  }
}

/** Verdict, scenario range and headline numbers. */
export default function VerdictCard(props: Props) {
  const { locale, input, result, verdict, basis, runs, baseName, altName } = props;
  const years = input.horizonMonths / 12;
  const dearer = input.extraPrice < 0 ? baseName : altName;
  const km = (n: number) => t(locale, 'unit.km', { n: formatNumber(n) });

  const headline = verdictHeadline(
    locale,
    verdict,
    { base: baseName, alternative: altName },
    years,
  );

  const detail =
    verdict.kind === 'payback'
      ? t(locale, 'verdict.paysBackDetail', {
          km: km(verdict.km),
          rate: formatPercent(input.interestRate),
        })
      : verdict.kind === 'never'
        ? t(locale, 'verdict.neverDetail', { alt: dearer, years })
        : verdict.kind === 'dominant'
          ? t(locale, 'verdict.dominantDetail')
          : null;

  // Range across price-rise scenarios, only meaningful when there is a break-even to range over.
  const scenarioMonths = (['pessimistic', 'base', 'optimistic'] as const).map(
    (s) => runs[s].output.breakevenWithInterest?.months ?? null,
  );
  const reached = scenarioMonths.filter((m): m is number => m !== null);
  const monthsText = (m: number | null) =>
    m === null ? t(locale, 'verdict.notWithin', { years }) : t(locale, 'unit.months', { n: m });
  const range =
    verdict.kind !== 'payback' || reached.length === 0
      ? null
      : new Set(scenarioMonths).size === 1
        ? t(locale, 'verdict.rangeSame', { value: monthsText(scenarioMonths[0]!) })
        : t(locale, 'verdict.range', {
            low: monthsText(Math.min(...reached)),
            high: monthsText(reached.length < 3 ? null : Math.max(...reached)),
          });

  // The 5-year row only when the horizon is longer; the horizon row always (10 years by default).
  const netRows: { label: string; net: number }[] = [
    ...(years > 5 && result.netAt5Years
      ? [{ label: t(locale, 'stat.net5'), net: result.netAt5Years.withInterest }]
      : []),
    {
      label: years === 10 ? t(locale, 'stat.net10') : t(locale, 'stat.netHorizon', { years }),
      net: result.netAtHorizon.withInterest,
    },
  ];
  const total = result.totalCost;
  const end = input.horizonMonths;

  return (
    <section
      aria-labelledby="verdict-heading"
      id="verdict"
      class="scroll-mt-24 rounded-xl bg-raised p-4 shadow-raised sm:p-5"
    >
      <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
      <h2
        id="verdict-heading"
        class="mt-1 font-display text-xl font-semibold sm:text-2xl sm:font-medium"
        aria-live="polite"
      >
        <span key={headline} class="tick block">
          {headline}
        </span>
      </h2>
      {detail && <p class="mt-2 text-ink-muted">{detail}</p>}
      {range && (
        <p class="mt-2 inline-flex rounded-full bg-surface px-3 py-1 text-sm text-ink-muted">
          {range}
        </p>
      )}

      <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
        {total && (
          <>
            <Stat label={t(locale, 'stat.totalCost', { car: baseName, years })}>
              {formatMoney(total.base[end]!)}
            </Stat>
            <Stat label={t(locale, 'stat.totalCost', { car: altName, years })}>
              {formatMoney(total.alternative[end]!)}
            </Stat>
          </>
        )}
        <Stat label={t(locale, 'stat.monthlySaving')}>
          <span class={result.firstMonthSaving < 0 ? 'text-danger' : ''}>
            {formatMoney(result.firstMonthSaving)}
          </span>
        </Stat>
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
            <span class={row.net < 0 ? 'text-danger' : ''}>{formatMoney(row.net)}</span>
          </Stat>
        ))}
        {verdict.kind === 'payback' && (
          <Stat label={t(locale, 'stat.breakevenNoInterest')}>
            {basis.breakevenNoInterest
              ? t(locale, 'unit.months', {
                  n: formatNumber(basis.breakevenNoInterest.fractionalMonths, 1),
                })
              : t(locale, 'stat.notReached')}
          </Stat>
        )}
      </dl>
      <p class="mt-3 text-xs text-ink-muted">{t(locale, 'stat.netHelp')}</p>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-sm text-ink-muted">{label}</dt>
      <dd class="mt-0.5 font-semibold num">{children}</dd>
    </div>
  );
}
