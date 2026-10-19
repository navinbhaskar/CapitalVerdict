import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, fuelPrices, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { formatNumber, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import {
  carFuelFlips,
  carFuelScenarios,
  compareCarFuel,
  type CarFuelResult,
  type CarFuelVariable,
} from '@/models/carFuel';
import {
  CAR_FUEL_EXAMPLE_FORM,
  CAR_FUEL_LIMITS,
  carFuelShareSchema,
  toCarFuelInput,
  type CarFuelForm,
} from '@/models/carFuelForm';
import NumberField from '@/components/tool/NumberField';
import VerdictCard from '@/components/tool/VerdictCard';
import CarFuelWorking from '@/components/tool/CarFuelWorking';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable, { type MonthlyColumn } from '@/components/tool/MonthlyTable';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';

interface Props {
  locale: Locale;
}

const RISE_RATES = defaults.scenarioVariables.energyPriceRise.values;
const CHECKLIST: MessageKey[] = [
  'checklist.carFuel.1',
  'checklist.carFuel.2',
  'checklist.carFuel.3',
  'checklist.carFuel.4',
];

/** Net position by month: cumulative saving minus the extra price (flat or with interest). */
const netSeries = (r: CarFuelResult, extra: number[] | number) =>
  r.cumulativeSaving.map((v, m) => v - (typeof extra === 'number' ? extra : extra[m]!));

export default function CarFuelTool({ locale }: Props) {
  const [form, setForm] = useState<CarFuelForm>(CAR_FUEL_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  /** Mobile only: a floating summary while the verdict is still below the fold. */
  const [showBar, setShowBar] = useState(false);
  /** Fields the user (or a shared link) has set; global assumptions never overwrite these. */
  const pinned = useRef(new Set<keyof CarFuelForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof CarFuelForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Restore a shared scenario from the URL.
  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, carFuelShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof CarFuelForm)[]) pinned.current.add(key);
    setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Fill unpinned fields from the global assumptions panel.
  const cityPrices = verifiedFuelPrices(assumptions.city);
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      const next = { ...f };
      if (!pinned.current.has('interestRate')) next.interestRate = assumptions.carLoanRate;
      if (cityPrices && !pinned.current.has('petrolPrice')) next.petrolPrice = cityPrices.petrol;
      if (cityPrices && !pinned.current.has('cngPrice')) next.cngPrice = cityPrices.cng;
      return next;
    });
  }, [ready, assumptions.carLoanRate, cityPrices?.petrol, cityPrices?.cng]);

  // Keep the URL in step so the address bar is always a shareable link.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(form, carFuelShareSchema);
      const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', url);
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  useEffect(() => {
    const verdict = document.getElementById('verdict-anchor');
    const wide = window.matchMedia('(min-width: 64rem)');
    if (!verdict || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setShowBar(!wide.matches && !entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    io.observe(verdict);
    return () => io.disconnect();
  }, []);

  const input = useMemo(() => toCarFuelInput(form), [form]);
  const computed = useMemo(() => {
    if (!input) return null;
    const result = compareCarFuel(input);
    const runs = carFuelScenarios(input, RISE_RATES);
    const scenarioNets = (['pessimistic', 'base', 'optimistic'] as const).map((s) =>
      netSeries(runs[s].output, runs[s].output.extraPriceWithInterest),
    );
    return {
      result,
      runs,
      flips: carFuelFlips(input),
      netWithInterest: netSeries(result, result.extraPriceWithInterest),
      netNoInterest: netSeries(result, input.extraPrice),
      bandLow: scenarioNets[0]!.map((_, m) => Math.min(...scenarioNets.map((s) => s[m]!))),
      bandHigh: scenarioNets[0]!.map((_, m) => Math.max(...scenarioNets.map((s) => s[m]!))),
    };
  }, [input]);

  const petrol = t(locale, 'fuel.petrol');
  const cng = t(locale, 'fuel.cng');

  const reset = () => {
    pinned.current.clear();
    setForm({
      ...CAR_FUEL_EXAMPLE_FORM,
      interestRate: assumptions.carLoanRate,
      ...(cityPrices ? { petrolPrice: cityPrices.petrol, cngPrice: cityPrices.cng } : {}),
    });
  };

  const city = fuelPrices.cities.find((c) => c.id === assumptions.city);
  const priceNote = (fuel: 'petrol' | 'cng') =>
    city && cityPrices && !pinned.current.has(fuel === 'petrol' ? 'petrolPrice' : 'cngPrice')
      ? t(locale, 'note.fuelPriceCity', {
          city: t(locale, `city.${city.id}` as MessageKey),
          date: city[fuel].effectiveDate,
        })
      : t(locale, 'note.fuelPriceExample');

  const field = (
    key: keyof CarFuelForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      layout?: 'row' | 'stack';
    } = {},
  ) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, label)}
      unit={unit}
      note={note}
      value={form[key]}
      onChange={set(key)}
      {...CAR_FUEL_LIMITS[key]}
      {...extra}
      layout={extra.layout ?? 'row'}
    />
  );

  const flipLines: FlipLine[] =
    computed && input
      ? computed.flips.map((flip) => {
          const side = flip.signBelow === -1 ? 'below' : 'above';
          const fmt = formatFlipValue(locale, flip.variable);
          return {
            text: t(locale, `flip.${flip.variable}.${side}` as MessageKey, {
              base: petrol,
              value: fmt(flip.threshold),
            }),
            current: fmt(currentValue(input, flip.variable)),
          };
        })
      : [];

  const result = computed?.result;
  const monthlyColumns: MonthlyColumn[] =
    computed && result && input
      ? [
          {
            label: t(locale, 'monthly.col.km'),
            kind: 'count',
            values: result.monthlyCost.base.map((_, i) => (i + 1) * input.monthlyKm),
          },
          {
            label: t(locale, 'monthly.col.petrolPrice'),
            kind: 'price',
            values: result.monthlyPrice.base,
          },
          {
            label: t(locale, 'monthly.col.cngPrice'),
            kind: 'price',
            values: result.monthlyPrice.alternative,
          },
          {
            label: t(locale, 'monthly.col.petrolCost'),
            kind: 'money',
            values: result.monthlyCost.base,
          },
          {
            label: t(locale, 'monthly.col.cngCost'),
            kind: 'money',
            values: result.monthlyCost.alternative,
          },
          {
            label: t(locale, 'monthly.col.saving'),
            kind: 'money',
            values: result.monthlyCost.base.map((c, i) => c - result.monthlyCost.alternative[i]!),
          },
          {
            label: t(locale, 'monthly.col.cumSaving'),
            kind: 'money',
            values: result.cumulativeSaving.slice(1),
          },
          {
            label: t(locale, 'monthly.col.extra'),
            kind: 'money',
            values: result.extraPriceWithInterest.slice(1),
          },
          {
            label: t(locale, 'monthly.col.netNoInt'),
            kind: 'money',
            values: computed.netNoInterest.slice(1),
          },
          {
            label: t(locale, 'monthly.col.netInt'),
            kind: 'money',
            values: computed.netWithInterest.slice(1),
          },
        ]
      : [];

  return (
    <div>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="inputs-heading" class="font-display text-xl font-semibold">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={reset}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'inputs.legend')}</p>
          {assumptions.city && !cityPrices && (
            <p class="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              {t(locale, 'carFuel.cityPriceUnverified', {
                city: t(locale, `city.${assumptions.city}` as MessageKey),
              })}
            </p>
          )}

          <Group title={t(locale, 'inputs.group.prices')}>
            {field(
              'petrolPrice',
              'input.petrolPrice',
              t(locale, 'input.petrolPrice.unit'),
              priceNote('petrol'),
            )}
            {field(
              'cngPrice',
              'input.cngPrice',
              t(locale, 'input.cngPrice.unit'),
              priceNote('cng'),
            )}
          </Group>
          <Group title={t(locale, 'inputs.group.cars')}>
            {field(
              'petrolMileage',
              'input.petrolMileage',
              t(locale, 'input.petrolMileage.unit'),
              t(locale, 'note.mileage'),
              { flagged: true },
            )}
            {field(
              'cngMileage',
              'input.cngMileage',
              t(locale, 'input.cngMileage.unit'),
              t(locale, 'note.mileage'),
              { flagged: true },
            )}
            {field(
              'extraPrice',
              'input.extraPrice',
              t(locale, 'input.extraPrice.unit'),
              t(locale, 'note.extraPrice'),
              { flagged: true },
            )}
          </Group>
          <Group title={t(locale, 'inputs.group.usage')}>
            {field(
              'monthlyKm',
              'input.monthlyKm',
              t(locale, 'input.monthlyKm.unit'),
              t(locale, 'note.monthlyKm'),
            )}
            {field('interestRate', 'input.interestRate', '%', t(locale, 'note.interestRate'), {
              percent: true,
            })}
          </Group>
          <Group title={t(locale, 'inputs.group.optional')} columns>
            {field('petrolPriceRise', 'input.petrolPriceRise', '%', t(locale, 'note.priceRise'), {
              percent: true,
              layout: 'stack',
            })}
            {field('cngPriceRise', 'input.cngPriceRise', '%', t(locale, 'note.priceRise'), {
              percent: true,
              layout: 'stack',
            })}
            {field(
              'cngUpkeep',
              'input.cngUpkeep',
              t(locale, 'input.upkeep.unit'),
              t(locale, 'note.cngUpkeep'),
              { layout: 'stack' },
            )}
            {field(
              'petrolUpkeep',
              'input.petrolUpkeep',
              t(locale, 'input.upkeep.unit'),
              t(locale, 'note.petrolUpkeep'),
              { layout: 'stack' },
            )}
            {field(
              'horizonYears',
              'input.horizonYears',
              t(locale, 'input.horizonYears.unit'),
              t(locale, 'note.horizon'),
              { integer: true, layout: 'stack' },
            )}
          </Group>
        </section>

        <div id="verdict-anchor" class="lg:sticky lg:top-20">
          {computed && input ? (
            <VerdictCard
              locale={locale}
              input={input}
              result={computed.result}
              runs={computed.runs}
              baseName={petrol}
              altName={cng}
            />
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              {t(locale, 'carFuel.incomplete')}
            </div>
          )}
          {shareHref && computed && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} />
            </div>
          )}
        </div>
      </div>

      {computed && input && result && (
        <>
          <div class="mt-10 border-t border-line pt-6">
            <CarFuelWorking locale={locale} input={input} result={result} />
          </div>

          <div class="mt-10 grid gap-6 border-t border-line pt-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
            <NetPositionChart
              locale={locale}
              title={t(locale, 'chart.netTitle')}
              netWithInterest={computed.netWithInterest}
              netNoInterest={computed.netNoInterest}
              bandLow={computed.bandLow}
              bandHigh={computed.bandHigh}
              breakevenWithInterest={result.breakevenWithInterest?.months ?? null}
              breakevenNoInterest={result.breakevenNoInterest?.months ?? null}
            />
            <section aria-labelledby="scenarios-heading">
              <h2 id="scenarios-heading" class="font-display text-xl font-semibold">
                {t(locale, 'scenario.heading')}
              </h2>
              <ul class="mt-4 space-y-3" role="list">
                {(['pessimistic', 'base', 'optimistic'] as const).map((name) => {
                  const run = computed.runs[name];
                  const months = run.output.breakevenWithInterest?.months;
                  return (
                    <li key={name} class="rounded-xl border border-line p-4">
                      <div class="flex items-baseline justify-between gap-3">
                        <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                        <span class="font-semibold num">
                          {months === undefined
                            ? t(locale, 'verdict.notWithin', { years: input.horizonMonths / 12 })
                            : t(locale, 'unit.months', { n: months })}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-ink-muted">
                        {t(locale, 'scenario.priceRise', {
                          rate: formatPercent(run.input.alternative.annualPriceRise),
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div class="mt-10 border-t border-line pt-6">
            <MonthlyTable
              locale={locale}
              columns={monthlyColumns}
              highlight={[
                result.breakevenNoInterest?.months,
                result.breakevenWithInterest?.months,
              ].filter((m): m is number => typeof m === 'number' && m > 0)}
              csvFilename="decidewise-cng-vs-petrol.csv"
            />
          </div>

          <div class="mt-10 grid gap-8 border-t border-line pt-6 lg:grid-cols-2">
            <SensitivityList locale={locale} lines={flipLines} />
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>
        </>
      )}

      {computed && showBar && (
        <div class="stagger fixed inset-x-3 bottom-3 z-30 lg:hidden">
          <div class="flex items-center justify-between gap-3 rounded-xl py-2 pr-2 pl-4 shadow-float glass">
            <p class="font-display font-semibold">
              {computed.result.breakevenWithInterest
                ? t(locale, 'verdict.paysBack', {
                    alt: cng,
                    months: computed.result.breakevenWithInterest.months,
                  })
                : t(locale, 'verdict.never', { base: petrol, years: input!.horizonMonths / 12 })}
            </p>
            <a href="#verdict" class="btn btn-primary min-h-11 shrink-0 px-4 text-sm">
              {t(locale, 'carFuel.resultBar.cta')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** `columns`: short optional fields sit two to a row (label above) instead of one table row each. */
function Group({
  title,
  children,
  columns = false,
}: {
  title: string;
  children: ComponentChildren;
  columns?: boolean;
}) {
  return (
    <fieldset class="mt-4">
      <legend class="w-full border-b border-line-strong pb-1.5 font-display text-base font-semibold">
        {title}
      </legend>
      <div class={columns ? 'grid gap-x-4 gap-y-3 pt-3 sm:grid-cols-2' : 'divide-y divide-line'}>
        {children}
      </div>
    </fieldset>
  );
}

function formatFlipValue(locale: Locale, variable: CarFuelVariable): (v: number) => string {
  switch (variable) {
    case 'monthlyKm':
      return (v) => t(locale, 'unit.km', { n: formatNumber(v) });
    case 'baseEnergyPrice':
      return (v) => t(locale, 'unit.perLitre', { n: formatNumber(v, 2) });
    case 'alternativeEnergyPrice':
      return (v) => t(locale, 'unit.perKg', { n: formatNumber(v, 2) });
    case 'alternativeMileage':
      return (v) => t(locale, 'unit.kmPerKg', { n: formatNumber(v, 1) });
  }
}

function currentValue(input: NonNullable<ReturnType<typeof toCarFuelInput>>, v: CarFuelVariable) {
  switch (v) {
    case 'monthlyKm':
      return input.monthlyKm;
    case 'baseEnergyPrice':
      return input.base.energyPrice;
    case 'alternativeEnergyPrice':
      return input.alternative.energyPrice;
    case 'alternativeMileage':
      return input.alternative.mileage;
  }
}
