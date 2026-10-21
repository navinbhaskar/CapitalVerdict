import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, fuelPrices, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import {
  carFuelFlips,
  carFuelScenarios,
  carFuelVerdict,
  compareCarFuel,
  compareCarSet,
  swapOptions,
  type CarFuelInput,
  type CarFuelResult,
  type CarFuelVariable,
} from '@/models/carFuel';
import {
  CAR_FUEL_EXAMPLE_KEYS,
  CAR_FUEL_START_FORM,
  CAR_FUEL_LIMITS,
  carFuelShareSchema,
  carPriceFields,
  extraPriceOf,
  invalidFields,
  onlyPricesMissing,
  toCarFuelInput,
  type AltKind,
  type CarFuelForm,
  type FormAlt,
  type NumericField,
} from '@/models/carFuelForm';
import ResultBar from '@/components/tool/ResultBar';
import NumberField from '@/components/tool/NumberField';
import VerdictCard, { verdictHeadline } from '@/components/tool/VerdictCard';
import CarSetCard from '@/components/tool/CarSetCard';
import CarFuelWorking from '@/components/tool/CarFuelWorking';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable, { type MonthlyColumn } from '@/components/tool/MonthlyTable';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';
import { formatDuration } from '@/lib/duration';
import { useIdleValue } from '@/lib/useIdleValue';

interface Props {
  locale: Locale;
}

const RISE_RATES = defaults.scenarioVariables.energyPriceRise.values;
/** Prices shown until the visitor picks a city: the city whose prices are verified. */
const DEFAULT_PRICE_CITY = 'lucknow';
const CHECKLIST: Record<AltKind, MessageKey[]> = {
  cng: ['checklist.carFuel.1', 'checklist.carFuel.2', 'checklist.carFuel.3', 'checklist.carFuel.4'],
  ev: ['checklist.ev.1', 'checklist.ev.2', 'checklist.ev.3', 'checklist.ev.4', 'checklist.ev.5'],
};

/** Fields asked up front in quick mode; everything else is under "Refine". */
const QUICK: NumericField[] = [
  'monthlyKm',
  'petrolCarPrice',
  'cngCarPrice',
  'evCarPrice',
  'evEfficiency',
  'homeRate',
  'homeChargingShare',
  'publicRate',
];

/** Net position by month: cumulative saving minus the extra price (flat or with interest). */
const netSeries = (r: CarFuelResult, extra: number[] | number) =>
  r.cumulativeSaving.map((v, m) => v - (typeof extra === 'number' ? extra : extra[m]!));

export default function CarFuelTool({ locale }: Props) {
  const [form, setForm] = useState<CarFuelForm>(CAR_FUEL_START_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  /** Mobile only: a floating summary while the verdict is still below the fold. */
  /** Fields the user (or a shared link) has set; global assumptions never overwrite these. */
  const pinned = useRef(new Set<keyof CarFuelForm>());
  const setAlt = (alt: FormAlt) => setForm((f) => ({ ...f, alt }));
  const { assumptions } = useGlobalAssumptions();

  const set = (key: NumericField) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Restore a shared scenario from the URL.
  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, carFuelShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof CarFuelForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Fill unpinned fields from the global assumptions panel.
  const priceCity = assumptions.city ?? DEFAULT_PRICE_CITY;
  const cityPrices = verifiedFuelPrices(priceCity);
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      const next = { ...f };
      if (!pinned.current.has('interestRate')) next.interestRate = assumptions.carLoanRate;
      if (cityPrices && !pinned.current.has('petrolPrice')) next.petrolPrice = cityPrices.petrol;
      if (cityPrices && !pinned.current.has('cngPrice')) next.cngPrice = cityPrices.cng;
      const same =
        next.interestRate === f.interestRate &&
        next.petrolPrice === f.petrolPrice &&
        next.cngPrice === f.cngPrice;
      return same ? f : next;
    });
  }, [ready, assumptions.carLoanRate, cityPrices?.petrol, cityPrices?.cng]);

  // Keep the URL in step so the address bar is always a shareable link.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, ['alt', ...pinned.current]), carFuelShareSchema);
      const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', url);
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const all = form.alt === 'all';
  const showCng = form.alt !== 'ev';
  const showEv = form.alt !== 'cng';
  const kinds: AltKind[] = all ? ['cng', 'ev'] : [form.alt as AltKind];

  /** One petrol pair per alternative shown; null until the form is complete. */
  const pairs = useMemo(() => {
    const out: Partial<Record<AltKind, CarFuelInput>> = {};
    for (const kind of kinds) {
      const input = toCarFuelInput(form, kind);
      if (!input) return null;
      out[kind] = input;
    }
    return out;
  }, [form]);

  // One alternative: verdict, scenarios and break-even, as before.
  const input = !all && pairs ? pairs[form.alt as AltKind]! : null;
  const core = useMemo(() => {
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
      // The verdict's own line needs only the distance flip, so it paints with the answer.
      kmFlips: carFuelFlips(input, ['monthlyKm']),
      netWithInterest: netSeries(result, result.extraPriceWithInterest),
      netNoInterest: netSeries(result, input.extraPrice),
      bandLow: scenarioNets[0]!.map((_, m) => Math.min(...scenarioNets.map((s) => s[m]!))),
      bandHigh: scenarioNets[0]!.map((_, m) => Math.max(...scenarioNets.map((s) => s[m]!))),
    };
  }, [input]);
  // Scenarios and the "what would flip it" sweeps can follow a moment after the answer.
  const fullFlips = useIdleValue(() => (input ? carFuelFlips(input) : null), [input]);
  const computed = core && { ...core, flips: fullFlips ?? core.kmFlips };

  // All three: total cost of each car and each alternative against petrol.
  const setComputed = useMemo(() => {
    if (!all || !pairs?.cng || !pairs.ev) return null;
    const set = compareCarSet('petrol', { cng: pairs.cng, ev: pairs.ev });
    return {
      set,
      net: {
        cng: netSeries(set.pairs.cng!.result, set.pairs.cng!.result.extraPriceWithInterest),
        ev: netSeries(set.pairs.ev!.result, set.pairs.ev!.result.extraPriceWithInterest),
      },
      flips: { cng: carFuelFlips(pairs.cng), ev: carFuelFlips(pairs.ev) },
    };
  }, [all, pairs]);

  const hasResult = computed !== null || setComputed !== null;
  const petrol = t(locale, 'fuel.petrol');
  const fuelName = (kind: AltKind) => t(locale, kind === 'cng' ? 'fuel.cng' : 'fuel.ev');
  const carName = (kind: AltKind) => t(locale, kind === 'cng' ? 'fuel.cngCar' : 'fuel.evCar');
  const names = {
    petrol: { fuel: petrol, car: t(locale, 'fuel.petrolCar') },
    cng: { fuel: fuelName('cng'), car: carName('cng') },
    ev: { fuel: fuelName('ev'), car: carName('ev') },
  };
  const singleKind: AltKind = all ? 'cng' : (form.alt as AltKind);
  const altName = fuelName(singleKind);
  const altCar = carName(singleKind);
  const horizonYears = form.horizonYears ?? 10;

  const reset = () => {
    pinned.current.clear();
    setForm({
      ...CAR_FUEL_START_FORM,
      alt: form.alt,
      interestRate: assumptions.carLoanRate,
      ...(cityPrices ? { petrolPrice: cityPrices.petrol, cngPrice: cityPrices.cng } : {}),
    });
  };

  const city = fuelPrices.cities.find((c) => c.id === priceCity);
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
      params?: Record<string, string>;
      slider?: { min: number; max: number; step: number };
    } = {},
  ) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, label, extra.params)}
      unit={unit}
      note={note}
      value={form[key]}
      onChange={set(key)}
      {...CAR_FUEL_LIMITS[key]}
      example={CAR_FUEL_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      slider={extra.slider}
      percent={extra.percent}
      integer={extra.integer}
      flagged={extra.flagged}
      layout={extra.layout ?? 'row'}
    />
  );

  const extraRow = (kind: AltKind) => {
    const extra = extraPriceOf(form, kind);
    return (
      <div
        key={`extra-${kind}`}
        class="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center"
      >
        <div>
          <p class="text-sm font-medium">
            {t(locale, 'input.extraPrice', { altCar: carName(kind) })}
          </p>
          <p class="mt-0.5 text-sm text-ink-muted">
            {t(locale, 'note.extraPriceDerived', { altCar: carName(kind) })}
          </p>
        </div>
        <p class="px-3 text-base font-semibold num" aria-live="polite">
          {extra === null ? '—' : formatINR(extra)}
        </p>
      </div>
    );
  };

  const flipLinesFor = (
    kind: AltKind,
    flipInput: CarFuelInput,
    flips: ReturnType<typeof carFuelFlips>,
  ): FlipLine[] =>
    flips.map((flip) => {
      const side = flip.signBelow === -1 ? 'below' : 'above';
      const fmt = formatFlipValue(
        locale,
        flip.variable,
        kind === 'cng' ? 'unit.perKg' : 'unit.perKWh',
        kind === 'cng' ? 'unit.kmPerKg' : 'unit.kmPerKWh',
      );
      return {
        text: t(locale, `flip.${flip.variable}.${side}` as MessageKey, {
          base: petrol,
          alt: fuelName(kind),
          altCar: carName(kind),
          altFuel: kind === 'cng' ? fuelName('cng') : t(locale, 'fuel.charging'),
          value: fmt(flip.threshold),
        }),
        current: fmt(currentValue(flipInput, flip.variable)),
      };
    });

  const flipLines: FlipLine[] =
    computed && input
      ? flipLinesFor(singleKind, input, computed.flips)
      : setComputed && pairs
        ? [
            ...flipLinesFor('cng', pairs.cng!, setComputed.flips.cng),
            ...flipLinesFor('ev', pairs.ev!, setComputed.flips.ev),
          ]
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
              unit: singleKind === 'cng' ? '₹/kg' : '₹/kWh',
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
      : setComputed && pairs
        ? (() => {
            const cngR = setComputed.set.pairs.cng!.result;
            const evR = setComputed.set.pairs.ev!.result;
            return [
              {
                label: t(locale, 'monthly.col.km'),
                kind: 'count' as const,
                values: cngR.monthlyCost.base.map((_, i) => (i + 1) * pairs.cng!.monthlyKm),
              },
              {
                label: t(locale, 'monthly.col.petrolCost'),
                kind: 'money' as const,
                values: cngR.monthlyCost.base,
              },
              {
                label: t(locale, 'monthly.col.altCost', { alt: fuelName('cng') }),
                kind: 'money' as const,
                values: cngR.monthlyCost.alternative,
              },
              {
                label: t(locale, 'monthly.col.altCost', { alt: fuelName('ev') }),
                kind: 'money' as const,
                values: evR.monthlyCost.alternative,
              },
              ...setComputed.set.entries.map((e) => ({
                label:
                  e.key === 'petrol'
                    ? t(locale, 'monthly.col.petrolTotal')
                    : t(locale, 'monthly.col.altTotal', { alt: fuelName(e.key as AltKind) }),
                kind: 'money' as const,
                values: e.totalCost.slice(1),
              })),
            ];
          })()
        : [];

  const quickInvalid = invalidFields(form).filter((k) => QUICK.includes(k));
  const refineInvalid = invalidFields(form).some((k) => !QUICK.includes(k));
  // While the visitor's own figures are still examples, the answer says so.
  const exampleNote = (['monthlyKm', ...carPriceFields(form.alt)] as NumericField[]).some(
    (k) => !pinned.current.has(k),
  )
    ? t(locale, 'carFuel.exampleNote')
    : null;
  const headline = computed
    ? verdictHeadline(
        locale,
        computed.verdict,
        { base: petrol, alternative: altName },
        input!.horizonMonths / 12,
        computed.basis.netAtHorizon.withInterest,
      )
    : setComputed
      ? t(locale, 'carSet.headline', {
          car: names[setComputed.set.ranking[0] as keyof typeof names].fuel,
          years: horizonYears,
        })
      : '';

  /** Rows saved with a scenario, so saved ones can be compared side by side. */
  const summary = hasResult
    ? [
        { label: t(locale, 'scenarios.row.answer'), value: headline },
        {
          label: t(locale, 'input.monthlyKm'),
          value: t(locale, 'unit.km', { n: formatNumber(form.monthlyKm ?? 0) }),
        },
        ...(setComputed
          ? setComputed.set.entries.map((e) => ({
              label: t(locale, 'stat.totalCost', {
                car: names[e.key as keyof typeof names].car,
                years: horizonYears,
              }),
              value: formatMoney(e.netCost),
            }))
          : result?.totalCost && input
            ? [
                {
                  label: t(locale, 'stat.totalCost', {
                    car: names.petrol.car,
                    years: horizonYears,
                  }),
                  value: formatMoney(result.totalCost.base[input.horizonMonths]!),
                },
                {
                  label: t(locale, 'stat.totalCost', { car: altCar, years: horizonYears }),
                  value: formatMoney(result.totalCost.alternative[input.horizonMonths]!),
                },
              ]
            : []),
        {
          label: t(locale, 'input.interestRate'),
          value: formatPercent(form.interestRate ?? 0),
        },
      ]
    : null;

  return (
    <div>
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="inputs-heading" class="font-display text-2xl font-medium">
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
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'inputs.quickLegend')}</p>
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
              class="mt-2 grid max-w-sm grid-cols-3 gap-1 rounded-md bg-surface p-1"
            >
              {(['cng', 'ev', 'all'] as const).map((kind) => (
                <label
                  key={kind}
                  class="flex min-h-10 cursor-pointer items-center justify-center rounded-sm px-2 text-center text-sm font-medium text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart has-[:checked]:bg-raised has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-strong"
                >
                  <input
                    type="radio"
                    name="compare-with"
                    value={kind}
                    checked={form.alt === kind}
                    onChange={() => setAlt(kind)}
                    class="sr-only"
                  />
                  {t(locale, kind === 'cng' ? 'fuel.cng' : kind === 'ev' ? 'fuel.ev' : 'fuel.all')}
                </label>
              ))}
            </div>
          </div>

          <Group title={t(locale, 'inputs.group.essentials')}>
            {field(
              'monthlyKm',
              'input.monthlyKm',
              t(locale, 'input.monthlyKm.unit'),
              t(locale, 'note.monthlyKm'),
              { slider: { min: 200, max: 5000, step: 100 } },
            )}
            {field(
              'petrolCarPrice',
              'input.petrolCarPrice',
              t(locale, 'input.carPrice.unit'),
              t(locale, 'note.carPrice'),
            )}
            {showCng &&
              field(
                'cngCarPrice',
                'input.cngCarPrice',
                t(locale, 'input.carPrice.unit'),
                t(locale, 'note.carPrice'),
              )}
            {showEv &&
              field(
                'evCarPrice',
                'input.evCarPrice',
                t(locale, 'input.carPrice.unit'),
                t(locale, 'note.carPrice'),
              )}
            {kinds.map(extraRow)}
            {showEv && (
              <>
                {field(
                  'evEfficiency',
                  'input.evEfficiency',
                  t(locale, 'input.evEfficiency.unit'),
                  t(locale, 'note.evEfficiency'),
                  { flagged: true },
                )}
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

          <Refine
            locale={locale}
            storageKey="dw.refine.carFuel"
            hint={t(locale, 'carFuel.refineHint')}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'inputs.group.prices')}>
              {field(
                'petrolPrice',
                'input.petrolPrice',
                t(locale, 'input.petrolPrice.unit'),
                priceNote('petrol'),
              )}
              {showCng &&
                field(
                  'cngPrice',
                  'input.cngPrice',
                  t(locale, 'input.cngPrice.unit'),
                  priceNote('cng'),
                )}
            </Group>
            <Group title={t(locale, 'inputs.group.mileage')}>
              {field(
                'petrolMileage',
                'input.petrolMileage',
                t(locale, 'input.petrolMileage.unit'),
                t(locale, 'note.mileage'),
                { flagged: true },
              )}
              {showCng &&
                field(
                  'cngMileage',
                  'input.cngMileage',
                  t(locale, 'input.cngMileage.unit'),
                  t(locale, 'note.mileage'),
                  { flagged: true },
                )}
            </Group>
            <Group title={t(locale, 'inputs.group.money')}>
              {field('interestRate', 'input.interestRate', '%', t(locale, 'note.interestRate'), {
                percent: true,
              })}
              {field(
                'horizonYears',
                'input.horizonYears',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'note.horizon'),
                { integer: true },
              )}
            </Group>
            <Group title={t(locale, 'inputs.group.optional')} columns>
              {field('petrolPriceRise', 'input.petrolPriceRise', '%', t(locale, 'note.priceRise'), {
                percent: true,
                layout: 'stack',
              })}
              {showCng &&
                field('cngPriceRise', 'input.cngPriceRise', '%', t(locale, 'note.priceRise'), {
                  percent: true,
                  layout: 'stack',
                })}
              {showEv &&
                field('evPriceRise', 'input.evPriceRise', '%', t(locale, 'note.priceRise'), {
                  percent: true,
                  layout: 'stack',
                })}
              {field(
                'petrolUpkeep',
                'input.petrolUpkeep',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'note.petrolUpkeep'),
                { layout: 'stack' },
              )}
              {showCng &&
                field(
                  'cngUpkeep',
                  'input.cngUpkeep',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.cngUpkeep'),
                  { layout: 'stack' },
                )}
              {showEv &&
                field(
                  'evUpkeep',
                  'input.evUpkeep',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.evUpkeep'),
                  { layout: 'stack' },
                )}
            </Group>
            <Group title={t(locale, 'inputs.group.extras')} columns>
              {field(
                'petrolInsurance',
                'input.insurance',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'note.insurance'),
                { layout: 'stack', params: { car: names.petrol.car } },
              )}
              {showCng &&
                field(
                  'cngInsurance',
                  'input.insurance',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.insurance'),
                  { layout: 'stack', params: { car: names.cng.car } },
                )}
              {showEv &&
                field(
                  'evInsurance',
                  'input.insurance',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'note.insurance'),
                  { layout: 'stack', params: { car: names.ev.car } },
                )}
              {field(
                'petrolResale',
                'input.resale',
                '%',
                t(locale, 'note.resale', { years: horizonYears }),
                {
                  percent: true,
                  layout: 'stack',
                  params: { car: names.petrol.car },
                },
              )}
              {showCng &&
                field(
                  'cngResale',
                  'input.resale',
                  '%',
                  t(locale, 'note.resale', { years: horizonYears }),
                  {
                    percent: true,
                    layout: 'stack',
                    params: { car: names.cng.car },
                  },
                )}
              {showEv &&
                field(
                  'evResale',
                  'input.resale',
                  '%',
                  t(locale, 'note.resale', { years: horizonYears }),
                  {
                    percent: true,
                    layout: 'stack',
                    params: { car: names.ev.car },
                  },
                )}
              {showCng && (
                <>
                  {field(
                    'cngOneOffCost',
                    'input.cngOneOffCost',
                    t(locale, 'input.carPrice.unit'),
                    t(locale, 'note.cngOneOff'),
                    { layout: 'stack' },
                  )}
                  {field(
                    'cngOneOffYear',
                    'input.oneOffYear',
                    t(locale, 'input.oneOffYear.unit'),
                    t(locale, 'note.oneOffYear'),
                    { integer: true, layout: 'stack' },
                  )}
                </>
              )}
              {showEv && (
                <>
                  {field(
                    'evOneOffCost',
                    'input.evOneOffCost',
                    t(locale, 'input.carPrice.unit'),
                    t(locale, 'note.evOneOff'),
                    { layout: 'stack' },
                  )}
                  {field(
                    'evOneOffYear',
                    'input.oneOffYear',
                    t(locale, 'input.oneOffYear.unit'),
                    t(locale, 'note.oneOffYear'),
                    { integer: true, layout: 'stack' },
                  )}
                </>
              )}
            </Group>
          </Refine>
        </section>

        <div id="verdict-anchor" class="order-first lg:sticky lg:top-20 lg:order-none">
          {computed && input ? (
            <VerdictCard
              locale={locale}
              input={input}
              result={computed.result}
              verdict={computed.verdict}
              basis={computed.basis}
              runs={computed.runs}
              baseName={petrol}
              altName={altName}
              baseCar={names.petrol.car}
              altCar={altCar}
              flips={computed.kmFlips}
              exampleNote={exampleNote}
            />
          ) : setComputed ? (
            <CarSetCard
              locale={locale}
              set={setComputed.set}
              names={names}
              baseKey="petrol"
              years={horizonYears}
            />
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              {onlyPricesMissing(form)
                ? t(locale, all ? 'carFuel.needPricesAll' : 'carFuel.needPrices')
                : t(locale, 'carFuel.incomplete')}
            </div>
          )}
          {shareHref && hasResult && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="carFuel"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={summary}
          />
        </div>
      </div>

      {hasResult && (
        <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
          <SensitivityList locale={locale} lines={flipLines} />
          <NonMoneyChecklist
            key={form.alt}
            locale={locale}
            items={kinds.flatMap((kind) => CHECKLIST[kind]).map((k) => t(locale, k))}
          />
        </div>
      )}

      {hasResult && (
        <div class="mt-6 border-t border-line">
          <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
            {computed && input && result ? (
              <CarFuelWorking
                locale={locale}
                input={input}
                result={result}
                altName={altName}
                altKind={singleKind}
                evBlend={
                  singleKind === 'ev'
                    ? {
                        homeShare: form.homeChargingShare!,
                        homeRate: form.homeRate!,
                        publicRate: form.publicRate,
                      }
                    : undefined
                }
              />
            ) : (
              setComputed &&
              pairs && (
                <div class="space-y-10">
                  {(['cng', 'ev'] as const).map((kind) => (
                    <CarFuelWorking
                      key={kind}
                      locale={locale}
                      heading={t(locale, 'working.headingFor', { alt: fuelName(kind) })}
                      input={pairs[kind]!}
                      result={setComputed.set.pairs[kind]!.result}
                      altName={fuelName(kind)}
                      altKind={kind}
                      evBlend={
                        kind === 'ev'
                          ? {
                              homeShare: form.homeChargingShare!,
                              homeRate: form.homeRate!,
                              publicRate: form.publicRate,
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )
            )}
          </MoreDetail>

          <MoreDetail title={t(locale, 'detail.chart')} hint={t(locale, 'detail.chartHint')}>
            {computed && input && result ? (
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
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
                  <h3 id="scenarios-heading" class="font-display text-xl font-medium">
                    {t(locale, 'scenario.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {(['pessimistic', 'base', 'optimistic'] as const).map((name) => {
                      const run = computed.runs[name];
                      const months = run.output.breakevenWithInterest?.months;
                      return (
                        <li key={name} class="rounded-xl border border-line p-4">
                          <div class="flex items-baseline justify-between gap-3">
                            <span class="font-medium">
                              {t(locale, 'scenario.priceRise', {
                                rate: formatPercent(run.input.alternative.annualPriceRise),
                              })}
                            </span>
                            <span class="font-semibold num">
                              {months === undefined
                                ? t(locale, 'verdict.notWithin', {
                                    years: input.horizonMonths / 12,
                                  })
                                : formatDuration(locale, months)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            ) : (
              setComputed && (
                <NetPositionChart
                  locale={locale}
                  title={t(locale, 'chart.setTitle')}
                  netWithInterest={setComputed.net.cng}
                  netNoInterest={setComputed.net.ev}
                  breakevenWithInterest={
                    setComputed.set.pairs.cng!.result.breakevenWithInterest?.months ?? null
                  }
                  breakevenNoInterest={
                    setComputed.set.pairs.ev!.result.breakevenWithInterest?.months ?? null
                  }
                  labels={{
                    main: t(locale, 'chart.setLine', { car: names.cng.car }),
                    secondary: t(locale, 'chart.setLine', { car: names.ev.car }),
                  }}
                />
              )
            )}
          </MoreDetail>

          <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
            <MonthlyTable
              locale={locale}
              columns={monthlyColumns}
              highlight={
                result
                  ? [
                      result.breakevenNoInterest?.months,
                      result.breakevenWithInterest?.months,
                    ].filter((m): m is number => typeof m === 'number' && m > 0)
                  : []
              }
              csvFilename={
                all
                  ? 'capitalverdict-petrol-cng-ev.csv'
                  : `capitalverdict-${singleKind}-vs-petrol.csv`
              }
            />
          </MoreDetail>
        </div>
      )}

      {hasResult && <ResultBar locale={locale} headline={headline} anchorId="verdict-anchor" />}
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
      <legend class="w-full border-b border-line-strong pb-1.5 font-display text-lg font-medium">
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

function currentValue(input: CarFuelInput, v: CarFuelVariable) {
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
