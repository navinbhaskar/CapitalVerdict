import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, verifiedSolarValue, verifiedTariff } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { solarFlips, solarPayback, solarScenarios, type SolarVariable } from '@/models/solar';
import {
  SOLAR_LIMITS,
  SOLAR_EXAMPLE_FORM,
  SOLAR_EXAMPLE_KEYS,
  invalidSolarFields,
  solarShareSchema,
  toSolarInput,
  type SolarForm,
} from '@/models/solarForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable, { type MonthlyColumn } from '@/components/tool/MonthlyTable';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';
import { useIdleValue } from '@/lib/useIdleValue';
import { formatDuration } from '@/lib/duration';

interface Props {
  locale: Locale;
}

const RISE_RATES = defaults.scenarioVariables.energyPriceRise.values;
const SLAB_TARIFF = verifiedTariff();
const CHECKLIST: MessageKey[] = [
  'solar.checklist.1',
  'solar.checklist.2',
  'solar.checklist.3',
  'solar.checklist.4',
  'solar.checklist.5',
];

export default function SolarTool({ locale }: Props) {
  const [form, setForm] = useState<SolarForm>(SOLAR_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof SolarForm>());

  const set = (key: keyof SolarForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, solarShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof SolarForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), solarShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toSolarInput(form, SLAB_TARIFF), [form]);
  const result = useMemo(() => (input ? solarPayback(input) : null), [input]);
  // Scenarios and the "what would flip it" sweeps can follow a moment after the answer.
  const extras = useIdleValue(() => {
    if (!input) return null;
    const runs = solarScenarios(input, RISE_RATES);
    const all = (['pessimistic', 'base', 'optimistic'] as const).map(
      (s) => runs[s].output.cumulativeNet,
    );
    return {
      runs,
      flips: solarFlips(input),
      bandLow: all[0]!.map((_, m) => Math.min(...all.map((s) => s[m]!))),
      bandHigh: all[0]!.map((_, m) => Math.max(...all.map((s) => s[m]!))),
    };
  }, [input]);
  const computed = result && {
    result,
    runs: extras?.runs ?? null,
    flips: extras?.flips ?? [],
    bandLow: extras?.bandLow,
    bandHigh: extras?.bandHigh,
  };

  const years = form.horizonYears ?? 25;
  const missing = invalidSolarFields(form, SLAB_TARIFF !== null);
  const QUICK: (keyof SolarForm)[] = [
    'systemKW',
    'grossCost',
    'subsidy',
    'monthlyConsumptionKWh',
    'sanctionedLoadKW',
    'averageRate',
    'generationPerKWPerDay',
  ];
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const unverified = (key: Parameters<typeof verifiedSolarValue>[0]) =>
    verifiedSolarValue(key) === null;

  const field = (
    key: keyof SolarForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      optional?: boolean;
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
      example={SOLAR_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...SOLAR_LIMITS[key]}
      {...extra}
      layout={extra.layout ?? 'row'}
    />
  );

  const r = computed?.result;
  const first = r &&
    input && {
      generation: r.generation[0]!,
      imported: Math.max(input.monthlyConsumptionKWh - r.generation[0]!, 0),
      exported: r.exportedKWh[0]!,
    };

  const costRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'solar.w.gross'), value: formatINR(input.grossCost) },
          { label: t(locale, 'solar.w.subsidy'), value: `−${formatINR(input.subsidy)}` },
          {
            label: t(locale, 'solar.w.netCost'),
            formula: `${formatINR(input.grossCost)} − ${formatINR(input.subsidy)}`,
            value: formatINR(r.netCost),
            strong: true,
          },
          ...(input.inverter
            ? [
                {
                  label: t(locale, 'solar.w.inverter', { year: input.inverter.year }),
                  value: formatINR(input.inverter.cost),
                },
              ]
            : []),
        ]
      : [];

  const monthRows: WorkingRow[] =
    r && input && first
      ? [
          {
            label: t(locale, 'solar.w.generation'),
            formula: `${formatNumber(input.systemKW, 2)} kW × ${formatNumber(input.generationPerKWPerDay, 2)} × 365 ÷ 12`,
            value: t(locale, 'unit.kWh', { n: formatNumber(first.generation) }),
          },
          {
            label: t(locale, 'solar.w.consumption'),
            value: t(locale, 'unit.kWh', { n: formatNumber(input.monthlyConsumptionKWh) }),
          },
          {
            label: t(locale, 'solar.w.imported'),
            value: t(locale, 'unit.kWh', { n: formatNumber(first.imported) }),
          },
          {
            label: t(locale, 'solar.w.exported'),
            value: t(locale, 'unit.kWh', { n: formatNumber(first.exported) }),
          },
          { label: t(locale, 'solar.w.billWithout'), value: formatINR(r.billWithout[0]!) },
          { label: t(locale, 'solar.w.billWith'), value: formatINR(r.billWith[0]!) },
          {
            label: t(locale, 'solar.w.saving'),
            formula: `${formatINR(r.billWithout[0]!)} − ${formatINR(r.billWith[0]!)}`,
            value: formatINR(r.saving[0]!),
            strong: true,
          },
        ]
      : [];

  const flipLines: FlipLine[] =
    computed && input
      ? computed.flips.map((flip) => {
          const side = flip.signBelow === -1 ? 'below' : 'above';
          const fmt = formatSolarValue(locale, flip.variable);
          return {
            text: t(locale, `solar.flip.${flip.variable}.${side}` as MessageKey, {
              years,
              value: fmt(flip.threshold),
            }),
            current: fmt(
              flip.variable === 'netCost'
                ? computed.result.netCost
                : (input[flip.variable] as number),
            ),
          };
        })
      : [];

  const columns: MonthlyColumn[] = r
    ? [
        { label: t(locale, 'solar.col.generation'), kind: 'count', values: r.generation },
        { label: t(locale, 'solar.col.exported'), kind: 'count', values: r.exportedKWh },
        { label: t(locale, 'solar.col.billWithout'), kind: 'money', values: r.billWithout },
        { label: t(locale, 'solar.col.billWith'), kind: 'money', values: r.billWith },
        { label: t(locale, 'solar.col.saving'), kind: 'money', values: r.saving },
        { label: t(locale, 'solar.col.net'), kind: 'money', values: r.cumulativeNet.slice(1) },
      ]
    : [];

  const headline = r
    ? r.payback
      ? t(locale, 'solar.verdict.payback', { duration: formatDuration(locale, r.payback.months) })
      : t(locale, 'solar.verdict.never', { years })
    : '';

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="solar-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="solar-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(SOLAR_EXAMPLE_FORM);
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'inputs.quickLegend')}</p>

          <Group title={t(locale, 'solar.group.essentials')}>
            {field('systemKW', 'solar.in.systemKW', 'kW', t(locale, 'solar.note.systemKW'))}
            {field('grossCost', 'solar.in.grossCost', '₹', t(locale, 'solar.note.grossCost'))}
            {field('subsidy', 'solar.in.subsidy', '₹', t(locale, 'solar.note.subsidy'), {
              optional: true,
              flagged: unverified('subsidy'),
            })}
            {field(
              'monthlyConsumptionKWh',
              'solar.in.consumption',
              'kWh',
              t(locale, 'solar.note.consumption'),
            )}
            {SLAB_TARIFF
              ? field('sanctionedLoadKW', 'solar.in.load', 'kW', t(locale, 'solar.note.load'))
              : field(
                  'averageRate',
                  'solar.in.averageRate',
                  '₹/kWh',
                  t(locale, 'solar.note.averageRate'),
                )}
            {field(
              'generationPerKWPerDay',
              'solar.in.generation',
              'kWh',
              t(locale, 'solar.note.generation'),
              { flagged: unverified('generationPerKWPerDay') },
            )}
          </Group>

          <Refine
            locale={locale}
            storageKey="dw.refine.solar"
            hint={t(locale, 'solar.refineHint')}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'solar.group.bill')}>
              {!SLAB_TARIFF &&
                field(
                  'fixedCharge',
                  'solar.in.fixedCharge',
                  '₹',
                  t(locale, 'solar.note.fixedCharge'),
                  {
                    optional: true,
                  },
                )}
              {field(
                'exportRatePerKWh',
                'solar.in.exportRate',
                '₹/kWh',
                t(locale, 'solar.note.exportRate'),
                {
                  optional: true,
                  flagged: unverified('exportRatePerKWh'),
                },
              )}
              {field(
                'degradationPerYear',
                'solar.in.degradation',
                '%',
                t(locale, 'solar.note.degradation'),
                {
                  percent: true,
                  flagged: unverified('degradationPerYear'),
                },
              )}
            </Group>

            <Group title={t(locale, 'inputs.group.optional')} columns>
              {field(
                'tariffRisePerYear',
                'solar.in.tariffRise',
                '%',
                t(locale, 'solar.note.tariffRise'),
                {
                  percent: true,
                  layout: 'stack',
                },
              )}
              {field(
                'horizonYears',
                'solar.in.horizon',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'solar.note.horizon'),
                { integer: true, layout: 'stack' },
              )}
              {field(
                'inverterYear',
                'solar.in.inverterYear',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'solar.note.inverter'),
                { integer: true, optional: true, layout: 'stack' },
              )}
              {field(
                'inverterCost',
                'solar.in.inverterCost',
                '₹',
                t(locale, 'solar.note.inverterCost'),
                {
                  optional: true,
                  layout: 'stack',
                },
              )}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {computed && r && input ? (
            <section
              id="verdict"
              aria-labelledby="solar-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="solar-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {r.payback
                  ? t(locale, 'solar.verdict.paybackDetail', {
                      years,
                      net: formatMoney(r.netAtHorizon),
                    })
                  : t(locale, 'solar.verdict.neverDetail', {
                      years,
                      saved: formatMoney(r.netAtHorizon + r.netCost + (input.inverter?.cost ?? 0)),
                      cost: formatMoney(r.netCost + (input.inverter?.cost ?? 0)),
                    })}
              </p>
              {(() => {
                // The gain falls one rupee for every rupee the system costs, so it reaches zero at
                // net cost + gain.
                const breakEvenCost = r.netCost + r.netAtHorizon;
                if (!(breakEvenCost > 0)) return null;
                return (
                  <p class="mt-2 font-medium">
                    {t(locale, 'solar.flip.netCost.above', {
                      years,
                      value: formatSolarValue(locale, 'netCost')(breakEvenCost),
                    })}
                  </p>
                );
              })()}
              {SOLAR_EXAMPLE_KEYS.some((k) => !pinned.current.has(k)) && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'solar.exampleNote')}
                  inputsId="solar-inputs-heading"
                />
              )}
              {(() => {
                const cost = r.netCost + (input.inverter?.cost ?? 0);
                const saved = r.saving.reduce((a, b) => a + b, 0);
                return (
                  <CompareBars
                    caption={t(locale, 'compare.solar', { years })}
                    items={[
                      {
                        label: t(locale, 'compare.solar.saved'),
                        value: saved,
                        display: formatMoney(saved),
                        best: saved >= cost,
                      },
                      {
                        label: t(locale, 'compare.solar.cost'),
                        value: cost,
                        display: formatMoney(cost),
                      },
                    ]}
                  />
                );
              })()}
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'solar.stat.firstYear')}>
                  {formatMoney(r.firstYearSaving)}
                </Stat>
                <Stat label={t(locale, 'solar.stat.net', { years })}>
                  <span class={r.netAtHorizon < 0 ? 'text-danger' : ''}>
                    {formatMoney(r.netAtHorizon)}
                  </span>
                </Stat>
                <Stat label={t(locale, 'solar.stat.irr')}>
                  {r.irr === null ? '—' : formatPercent(r.irr)}
                </Stat>
                <Stat label={t(locale, 'solar.stat.coverage')}>
                  {formatPercent(
                    r.generation.slice(0, 12).reduce((a, b) => a + b, 0) /
                      (input.monthlyConsumptionKWh * 12),
                  )}
                </Stat>
              </dl>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'solar.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'solar.needInputs')}</p>
              <p class="mt-2 text-sm">{t(locale, 'solar.stillMissing', { n: missing.length })}</p>
            </div>
          )}
          {shareHref && computed && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="solar"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    {
                      label: t(locale, 'solar.in.systemKW'),
                      value: `${formatNumber(input.systemKW, 1)} kW`,
                    },
                    { label: t(locale, 'solar.stat.netCost'), value: formatMoney(r.netCost) },
                    {
                      label: t(locale, 'solar.stat.firstYear'),
                      value: formatMoney(r.firstYearSaving),
                    },
                    {
                      label: t(locale, 'solar.stat.net', { years }),
                      value: formatMoney(r.netAtHorizon),
                    },
                    {
                      label: t(locale, 'solar.stat.irr'),
                      value: r.irr === null ? '—' : formatPercent(r.irr),
                    },
                  ]
                : null
            }
          />
        </div>
      </div>

      {computed && r && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <SensitivityList locale={locale} lines={flipLines} />
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="grid gap-4 lg:grid-cols-2">
                <WorkingBlock title={t(locale, 'solar.w.costTitle')} rows={costRows} />
                <WorkingBlock title={t(locale, 'solar.w.monthTitle')} rows={monthRows}>
                  {t(locale, 'solar.w.monthNote')}
                </WorkingBlock>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.chart')} hint={t(locale, 'detail.chartHint')}>
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <NetPositionChart
                  locale={locale}
                  title={t(locale, 'solar.chart.title')}
                  netWithInterest={r.cumulativeNet}
                  bandLow={computed.bandLow}
                  bandHigh={computed.bandHigh}
                  breakevenWithInterest={r.payback?.months ?? null}
                  labels={{
                    main: t(locale, 'solar.chart.main'),
                    band: t(locale, 'solar.chart.band'),
                  }}
                />
                <section aria-labelledby="solar-scenarios">
                  <h3 id="solar-scenarios" class="font-display text-xl font-medium">
                    {t(locale, 'scenario.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {(['pessimistic', 'base', 'optimistic'] as const).map((name) => {
                      if (!computed.runs) return null;
                      const run = computed.runs[name];
                      const pb = run.output.payback;
                      return (
                        <li key={name} class="rounded-xl border border-line p-4">
                          <div class="flex items-baseline justify-between gap-3">
                            <span class="font-medium">
                              {t(locale, 'solar.scenario.rise', {
                                rate: formatPercent(run.input.tariffRisePerYear),
                              })}
                            </span>
                            <span class="font-semibold num">
                              {pb
                                ? formatDuration(locale, pb.months)
                                : t(locale, 'verdict.notWithin', { years })}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                columns={columns}
                highlight={r.payback && r.payback.months > 0 ? [r.payback.months] : []}
                csvFilename="capitalverdict-rooftop-solar.csv"
              />
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}

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

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-sm text-ink-muted">{label}</dt>
      <dd class="mt-1 font-display text-lg font-medium text-accent-strong num">{children}</dd>
    </div>
  );
}

function formatSolarValue(locale: Locale, variable: SolarVariable): (v: number) => string {
  switch (variable) {
    case 'generationPerKWPerDay':
      return (v) => t(locale, 'unit.kWh', { n: formatNumber(v, 2) });
    case 'tariffRisePerYear':
      return (v) => formatPercent(v);
    case 'netCost':
      return (v) => formatMoney(v);
  }
}
