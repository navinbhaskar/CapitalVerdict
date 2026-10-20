import type { ComponentChildren } from 'preact';
import { t, type Locale } from '@/i18n/t';
import { formatDuration } from '@/lib/duration';
import { formatMoney, formatNumber, formatPercent, formatRupeesPrecise } from '@/lib/formatTool';
import type { ScenarioName, ScenarioRun } from '@/engine/scenarios';
import type { CarFuelFlip, CarFuelInput, CarFuelResult, CarFuelVerdict } from '@/models/carFuel';

interface Names {
  /** Short names: "Petrol", "CNG", "EV". */
  base: string;
  alternative: string;
}

interface Props {
  locale: Locale;
  input: CarFuelInput;
  /** Petrol vs the alternative as entered: drives the stats. */
  result: CarFuelResult;
  /** The headline, asked of whichever car costs more to buy. */
  verdict: CarFuelVerdict;
  /** Comparison with the dearer car as the alternative. */
  basis: CarFuelResult;
  /** Price-rise scenarios on the same basis, for the range line. */
  runs: Record<ScenarioName, ScenarioRun<CarFuelInput, CarFuelResult>> | null;
  flips: CarFuelFlip[];
  baseName: string;
  altName: string;
  /** Names with "car" where it reads naturally ("Petrol car", "CNG car", "EV"). */
  baseCar?: string;
  altCar?: string;
  /** Shown while the answer still rests on example numbers. */
  exampleNote?: string | null;
}

const other = (side: 'base' | 'alternative') => (side === 'base' ? 'alternative' : 'base');
/** Mid-sentence form of a fuel name: "petrol", but acronyms such as "CNG" and "EV" stay as they are. */
const inline = (name: string) => (name === name.toUpperCase() ? name : name.toLowerCase());

/** The short answer, shared by the verdict card, the mobile result bar and saved scenarios. */
export function verdictHeadline(
  locale: Locale,
  verdict: CarFuelVerdict,
  names: Names,
  years: number,
  /** basis.netAtHorizon.withInterest: positive when the dearer car comes out ahead. */
  dearerNet?: number,
): string {
  switch (verdict.kind) {
    case 'payback':
    case 'never':
    case 'resale': {
      if (dearerNet === undefined) {
        return verdict.kind === 'payback'
          ? t(locale, 'verdict.paysBack', {
              alt: names[verdict.payer],
              duration: formatDuration(locale, verdict.months),
            })
          : t(locale, 'verdict.never', { base: names[other(dearerOf(verdict))], years });
      }
      const dearer = dearerOf(verdict);
      return dearerNet > 0
        ? t(locale, 'verdict.plain.saves', {
            winner: names[dearer],
            amount: formatMoney(dearerNet),
            years,
          })
        : t(locale, 'verdict.plain.cheaper', {
            winner: names[other(dearer)],
            amount: formatMoney(-dearerNet),
            years,
          });
    }
    case 'dominant':
      return t(locale, 'verdict.dominant', { winner: names[verdict.winner] });
    case 'tie':
      return t(locale, 'verdict.tie');
  }
}

/** The side that costs more to buy, for verdicts that are about earning that extra back. */
function dearerOf(
  verdict: Extract<CarFuelVerdict, { kind: 'payback' | 'never' | 'resale' }>,
): 'base' | 'alternative' {
  if (verdict.kind === 'payback') return verdict.payer;
  return verdict.kind === 'never' ? other(verdict.winner) : verdict.winner;
}

/** Verdict in plain words, the one thing that would change it, and a few headline figures. */
export default function VerdictCard(props: Props) {
  const { locale, input, result, verdict, basis, runs, flips, baseName, altName } = props;
  const baseCar = props.baseCar ?? baseName;
  const altCar = props.altCar ?? altName;
  const years = input.horizonMonths / 12;
  const names = { base: baseName, alternative: altName };
  const extra = formatMoney(Math.abs(input.extraPrice));

  const headline = verdictHeadline(locale, verdict, names, years, basis.netAtHorizon.withInterest);
  const detail =
    verdict.kind === 'payback'
      ? t(locale, 'verdict.plain.paysBack', {
          dearer: names[verdict.payer],
          extra,
          duration: formatDuration(locale, verdict.months),
          rate: formatPercent(input.interestRate),
        })
      : verdict.kind === 'never' || verdict.kind === 'resale'
        ? `${t(locale, 'verdict.plain.noPayback', { dearer: names[dearerOf(verdict)], extra, years })}${
            verdict.kind === 'resale' ? ` ${t(locale, 'verdict.plain.resaleNote')}` : ''
          }`
        : verdict.kind === 'dominant'
          ? t(locale, 'verdict.dominantDetail')
          : null;

  // The one input most people can act on: how far they drive.
  const kmFlip = flips.find((f) => f.variable === 'monthlyKm');
  const flipLine = kmFlip
    ? t(locale, 'verdict.plain.flipKm', {
        km: t(locale, 'unit.km', { n: formatNumber(Math.round(kmFlip.threshold)) }),
        below: inline(kmFlip.signBelow === -1 ? baseName : altName),
      })
    : null;

  // Range across price-rise scenarios, only when the break-even moves with them.
  const scenarioMonths = runs
    ? (['pessimistic', 'base', 'optimistic'] as const).map(
        (s) => runs[s].output.breakevenWithInterest?.months ?? null,
      )
    : [];
  const reached = scenarioMonths.filter((m): m is number => m !== null);
  const monthsText = (m: number | null) =>
    m === null ? t(locale, 'verdict.notWithin', { years }) : formatDuration(locale, m);
  const range =
    verdict.kind !== 'payback' || reached.length === 0 || new Set(scenarioMonths).size === 1
      ? null
      : t(locale, 'verdict.range', {
          low: monthsText(Math.min(...reached)),
          high: monthsText(reached.length < 3 ? null : Math.max(...reached)),
        });

  const total = result.totalCost;
  const end = input.horizonMonths;

  return (
    <section
      aria-labelledby="verdict-heading"
      id="verdict"
      class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-7"
    >
      <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
      <h2
        id="verdict-heading"
        class="mt-2 font-display text-2xl font-medium tracking-(--tracking-heading) sm:text-3xl"
        aria-live="polite"
      >
        <span key={headline} class="tick block">
          {headline}
        </span>
      </h2>
      {detail && <p class="mt-2 text-ink-muted">{detail}</p>}
      {flipLine && <p class="mt-2 font-medium">{flipLine}</p>}
      {range && <p class="mt-2 text-sm text-ink-muted">{range}</p>}
      {props.exampleNote && (
        <p class="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">
          {props.exampleNote}
        </p>
      )}

      <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
        {total && (
          <>
            <Stat label={t(locale, 'stat.totalCost', { car: baseCar, years })}>
              {formatMoney(total.base[end]!)}
            </Stat>
            <Stat label={t(locale, 'stat.totalCost', { car: altCar, years })}>
              {formatMoney(total.alternative[end]!)}
            </Stat>
          </>
        )}
        <Stat label={t(locale, 'stat.monthlySaving', { alt: altName })}>
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
        {input.resale && (
          <>
            <Stat label={t(locale, 'stat.resaleCar', { car: baseCar, years })}>
              {formatMoney(input.resale.base)}
            </Stat>
            <Stat label={t(locale, 'stat.resaleCar', { car: altCar, years })}>
              {formatMoney(input.resale.alternative)}
            </Stat>
          </>
        )}
      </dl>
      <p class="mt-3 text-xs text-ink-muted">
        {t(locale, input.resale ? 'stat.netHelpResale' : 'stat.netHelp')}
      </p>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-sm text-ink-muted">{label}</dt>
      <dd class="mt-1 font-display text-xl font-medium text-accent-strong num">{children}</dd>
    </div>
  );
}
