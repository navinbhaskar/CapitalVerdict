import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, fuelPrices, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatNumber, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import {
  carFuelFlips,
  carFuelScenarios,
  carFuelVerdict,
  compareCarFuel,
  swapOptions,
  type CarFuelResult,
  type CarFuelVariable,
} from '@/models/carFuel';
import {
  CAR_FUEL_EXAMPLE_FORM,
  CAR_FUEL_LIMITS,
  carFuelShareSchema,
  altCarPriceField,
  extraPriceOf,
  onlyPricesMissing,
  toCarFuelInput,
  type AltKind,
  type CarFuelForm,
  type NumericField,
} from '@/models/carFuelForm';
import NumberField from '@/components/tool/NumberField';
import VerdictCard, { verdictHeadline } from '@/components/tool/VerdictCard';
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
const CHECKLIST: Record<AltKind, MessageKey[]> = {
  cng: ['checklist.carFuel.1', 'checklist.carFuel.2', 'checklist.carFuel.3', 'checklist.carFuel.4'],
  ev: ['checklist.ev.1', 'checklist.ev.2', 'checklist.ev.3', 'checklist.ev.4', 'checklist.ev.5'],
};

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
  const setAlt = (alt: AltKind) => setForm((f) => ({ ...f, alt }));
  const { assumptions } = useGlobalAssumptions();

  const set = (key: NumericField) => (value: number | null) => {
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
  const extraPrice = extraPriceOf(form);
  const computed = useMemo(() => {
    if (!input) return null;
    const result = compareCarFuel(input);
    // The headline is asked of whichever car costs more to buy; scenarios use the same basis.
    const { verdict, basis, swapped } = carFuelVerdict(input);
    const runs = carFuelScenarios(swapped ? swapOptions(input) : input, RISE_RATES);
    const scenarioNets = (['pessimistic', 'base', 'optimistic'] as const).map((s) =>
      netSeries(runs[s].output, runs[s].output.extraPriceWithInterest),
    );
    return {
      result,
      verdict,
      basis,
      runs,
      flips: carFuelFlips(input),
      netWithInterest: netSeries(result, result.extraPriceWithInterest),
      netNoInterest: netSeries(result, input.extraPrice),
      bandLow: scenarioNets[0]!.map((_, m) => Math.min(...scenarioNets.map((s) => s[m]!))),
      bandHigh: scenarioNets[0]!.map((_, m) => Math.max(...scenarioNets.map((s) => s[m]!))),
    };
  }, [input]);

  const petrol = t(locale, 'fuel.petrol');
  const altKind = form.alt;
  const altName = t(locale, altKind === 'cng' ? 'fuel.cng' : 'fuel.ev');
  // Kept as `cng` below: the alternative's display name, whichever it is.
  const cng = altName;
  const altFuel = altKind === 'cng' ? altName : t(locale, 'fuel.charging');
  const altCar = t(locale, altKind === 'cng' ? 'fuel.cngCar' : 'fuel.evCar');
  const altPriceUnit = altKind === 'cng' ? 'unit.perKg' : 'unit.perKWh';
  const altMileageUnit = altKind === 'cng' ? 'unit.kmPerKg' : 'unit.kmPerKWh';

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
    key: NumericField,
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
          const fmt = formatFlipValue(locale, flip.variable, altPriceUnit, altMileageUnit);
          return {
            text: t(locale, `flip.${flip.variable}.${side}` as MessageKey, {
              base: petrol,
              alt: altName,
              altCar,
              altFuel,
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
            label: t(locale, 'monthly.col.altPrice', {
              alt: altName,
              unit: altKind === 'cng' ? '₹/kg' : '₹/kWh',
            }),
            kind: 'price',
            values: result.monthlyPrice.alternative,
          },
          {
            label: t(locale, 'monthly.col.petrolCost'),
            kind: 'money',
            values: result.monthlyCost.base,
          },
          {
            label: t(locale, 'monthly.col.altCost', { alt: altName }),
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
          ...(result.totalCost
            ? [
                {
                  label: t(locale, 'monthly.col.petrolTotal'),
                  kind: 'money' as const,
                  values: result.totalCost.base.slice(1),
                },
                {
                  label: t(locale, 'monthly.col.altTotal', { alt: altName }),
                  kind: 'money' as const,
                  values: result.totalCost.alternative.slice(1),
                },
              ]
            : []),
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

          <div class="mt-4">
            <p class="text-sm font-medium" id="compare-with">
              {t(locale, 'carFuel.compareWith')}
            </p>
            <div
              role="radiogroup"
              aria-labelledby="compare-with"
              class="mt-2 grid max-w-xs grid-cols-2 gap-1 rounded-md bg-surface p-1"
            >
              {(['cng', 'ev'] as const).map((kind) => (
                <label
                  key={kind}
                  class="flex min-h-10 cursor-pointer items-center justify-center rounded-sm text-sm font-medium text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart has-[:checked]:bg-raised has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-strong"
                >
                  <input
                    type="radio"
                    name="compare-with"
                    value={kind}
                    checked={altKind === kind}
                    onChange={() => setAlt(kind)}
                    class="sr-only"
                  />
                  {t(locale, kind === 'cng' ? 'fuel.cng' : 'fuel.ev')}
                </label>
              ))}
            </div>
          </div>

          <Group
            title={t(locale, altKind === 'cng' ? 'inputs.group.prices' : 'inputs.group.pricesEv')}
          >
            {field(
              'petrolPrice',
              'input.petrolPrice',
              t(locale, 'input.petrolPrice.unit'),
              priceNote('petrol'),
            )}
            {altKind === 'cng' ? (
              field(
                'cngPrice',
                'input.cngPrice',
                t(locale, 'input.cngPrice.unit'),
                priceNote('cng'),
              )
            ) : (
              <>
                {field('homeRate', 'input.homeRate', '₹/kWh', t(locale, 'note.homeRate'))}
                {field(
                  'homeChargingShare',
                  'input.homeChargingShare',
                  '%',
                  t(locale, 'note.homeChargingShare'),
                  { percent: true },
                )}
                {form.homeChargingShare !== 1 &&
                  field('publicRate', 'input.publicRate', '₹/kWh', t(locale, 'note.publicRate'))}
              </>
            )}
          </Group>
          <Group title={t(locale, 'inputs.group.cars')}>
            {field(
              'petrolCarPrice',
              'input.petrolCarPrice',
              t(locale, 'input.carPrice.unit'),
              t(locale, 'note.carPrice'),
            )}
            {field(
              altCarPriceField(altKind),
              altKind === 'cng' ? 'input.cngCarPrice' : 'input.evCarPrice',
              t(locale, 'input.carPrice.unit'),
              t(locale, 'note.carPrice'),
            )}
            <div class="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
              <div>
                <p class="text-sm font-medium">{t(locale, 'input.extraPrice', { altCar })}</p>
                <p class="mt-0.5 text-xs text-ink-muted">
                  {t(locale, 'note.extraPriceDerived', { altCar })}
                </p>
              </div>
              <p class="px-3 text-base font-semibold num" aria-live="polite">
                {extraPrice === null ? '—' : formatINR(extraPrice)}
              </p>
            </div>
            {field(
              'petrolMileage',
              'input.petrolMileage',
              t(locale, 'input.petrolMileage.unit'),
              t(locale, 'note.mileage'),
              { flagged: true },
            )}
            {altKind === 'cng'
              ? field(
                  'cngMileage',
                  'input.cngMileage',
                  t(locale, 'input.cngMileage.unit'),
                  t(locale, 'note.mileage'),
                  { flagged: true },
                )
              : field(
                  'evEfficiency',
                  'input.evEfficiency',
                  t(locale, 'input.evEfficiency.unit'),
                  t(locale, 'note.evEfficiency'),
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
            {altKind === 'cng'
              ? field('cngPriceRise', 'input.cngPriceRise', '%', t(locale, 'note.priceRise'), {
                  percent: true,
                  layout: 'stack',
                })
              : field('evPriceRise', 'input.evPriceRise', '%', t(locale, 'note.priceRise'), {
                  percent: true,
                  layout: 'stack',
                })}
            {altKind === 'cng'
              ? field(
                  'cngUpkeep',
                  'input.cngUpkeep',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.cngUpkeep'),
                  { layout: 'stack' },
                )
              : field(
                  'evUpkeep',
                  'input.evUpkeep',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.evUpkeep'),
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
              verdict={computed.verdict}
              basis={computed.basis}
              runs={computed.runs}
              baseName={petrol}
              altName={cng}
              baseCar={t(locale, 'fuel.petrolCar')}
              altCar={altCar}
            />
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              {onlyPricesMissing(form)
                ? t(locale, 'carFuel.needPrices')
                : t(locale, 'carFuel.incomplete')}
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
            <CarFuelWorking
              locale={locale}
              input={input}
              result={result}
              altName={altName}
              altKind={altKind}
              evBlend={
                altKind === 'ev'
                  ? {
                      homeShare: form.homeChargingShare!,
                      homeRate: form.homeRate!,
                      publicRate: form.publicRate,
                    }
                  : undefined
              }
            />
          </div>

          <div class="mt-10 grid gap-6 border-t border-line pt-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
            <NetPositionChart
              locale={locale}
              title={t(locale, 'chart.netTitle', { alt: altName })}
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
            <NonMoneyChecklist
              key={altKind}
              locale={locale}
              items={CHECKLIST[altKind].map((k) => t(locale, k))}
            />
          </div>
        </>
      )}

      {computed && showBar && (
        <div class="stagger fixed inset-x-3 bottom-3 z-30 lg:hidden">
          <div class="flex items-center justify-between gap-3 rounded-xl py-2 pr-2 pl-4 shadow-float glass">
            <p class="font-display font-semibold">
              {verdictHeadline(
                locale,
                computed.verdict,
                { base: petrol, alternative: cng },
                input!.horizonMonths / 12,
              )}
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

function formatFlipValue(
  locale: Locale,
  variable: CarFuelVariable,
  priceUnit: 'unit.perKg' | 'unit.perKWh',
  mileageUnit: 'unit.kmPerKg' | 'unit.kmPerKWh',
): (v: number) => string {
  switch (variable) {
    case 'monthlyKm':
      return (v) => t(locale, 'unit.km', { n: formatNumber(v) });
    case 'baseEnergyPrice':
      return (v) => t(locale, 'unit.perLitre', { n: formatNumber(v, 2) });
    case 'alternativeEnergyPrice':
      return (v) => t(locale, priceUnit, { n: formatNumber(v, 2) });
    case 'alternativeMileage':
      return (v) => t(locale, mileageUnit, { n: formatNumber(v, 1) });
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
