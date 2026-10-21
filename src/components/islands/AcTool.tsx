import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { acFlips, acPayback, type AcVariable } from '@/models/ac';
import {
  AC_EXAMPLE_FORM,
  AC_EXAMPLE_KEYS,
  AC_LIMITS,
  acShareSchema,
  invalidAcFields,
  toAcInput,
  type AcForm,
} from '@/models/acForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
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

interface Props {
  locale: Locale;
}

const RISE = defaults.scenarioVariables.energyPriceRise.values;
const SCENARIOS = ['pessimistic', 'base', 'optimistic'] as const;
const CHECKLIST: MessageKey[] = [
  'ac.checklist.1',
  'ac.checklist.2',
  'ac.checklist.3',
  'ac.checklist.4',
];
const QUICK: (keyof AcForm)[] = [
  'basicPrice',
  'basicUnits',
  'efficientPrice',
  'efficientUnits',
  'pricePerUnit',
  'usage',
];

export default function AcTool({ locale }: Props) {
  const [form, setForm] = useState<AcForm>(AC_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof AcForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof AcForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, acShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof AcForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // The interest on the extra price follows the car-loan rate in Assumptions, as in the car tool.
  useEffect(() => {
    if (!ready || pinned.current.has('interestRate')) return;
    setForm((f) =>
      f.interestRate === assumptions.carLoanRate
        ? f
        : { ...f, interestRate: assumptions.carLoanRate },
    );
  }, [ready, assumptions.carLoanRate]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), acShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toAcInput(form), [form]);
  const r = useMemo(() => (input ? acPayback(input) : null), [input]);
  // The verdict's own line needs only the usage flip, so it paints with the answer.
  const keyFlips = useMemo(() => (input ? acFlips(input, ['usage']) : []), [input]);
  const extras = useIdleValue(() => {
    if (!input) return null;
    const runs = SCENARIOS.map((name) => ({
      name,
      rise: RISE[name],
      result: acPayback({ ...input, tariffRise: RISE[name] }),
    }));
    return {
      flips: acFlips(input),
      runs,
      bandLow: runs[0]!.result.net.map((_, m) => Math.min(...runs.map((s) => s.result.net[m]!))),
      bandHigh: runs[0]!.result.net.map((_, m) => Math.max(...runs.map((s) => s.result.net[m]!))),
    };
  }, [input]);
  const flips = extras?.flips ?? keyFlips;
  const usageFlip = flips.find((f) => f.variable === 'usage');

  const years = form.years ?? 10;
  const missing = invalidAcFields(form);
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const isExample = AC_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));

  const field = (
    key: keyof AcForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      slider?: { min: number; max: number; step: number };
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
      example={AC_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...AC_LIMITS[key]}
      {...extra}
      layout="row"
    />
  );

  let headline = '';
  if (r) {
    if (r.extraPrice <= 0) {
      headline = t(locale, r.unitsSavedYearly > 0 ? 'ac.verdict.noExtra' : 'ac.verdict.same');
    } else if (r.unitsSavedYearly <= 0) {
      headline = t(locale, 'ac.verdict.noSaving');
    } else if (r.breakevenWithInterest) {
      headline = t(locale, 'ac.verdict.payback', {
        time: formatDuration(locale, r.breakevenWithInterest.months),
      });
    } else {
      headline = t(locale, 'ac.verdict.never', { years });
    }
  }

  const savingRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'ac.w.extra'),
            formula: `${formatINR(input.efficientPrice)} − ${formatINR(input.basicPrice)}`,
            value: formatINR(r.extraPrice),
          },
          {
            label: t(locale, 'ac.w.units'),
            formula: `(${formatNumber(input.basicUnits)} − ${formatNumber(input.efficientUnits)}) × ${formatPercent(input.usage)}`,
            value: t(locale, 'ac.unitsValue', { n: formatNumber(Math.round(r.unitsSavedYearly)) }),
          },
          {
            label: t(locale, 'ac.w.firstYear'),
            formula: `${formatNumber(Math.round(r.unitsSavedYearly))} × ₹${formatNumber(input.pricePerUnit)}`,
            value: formatINR(r.firstYearSaving),
            strong: true,
          },
          {
            label: t(locale, 'ac.w.monthly'),
            formula: `${formatINR(r.firstYearSaving)} ÷ 12`,
            value: formatINR(r.firstYearSaving / 12),
          },
        ]
      : [];

  const paybackRows: WorkingRow[] =
    r && input && r.extraPrice > 0
      ? [
          {
            label: t(locale, 'ac.w.simple'),
            formula: t(locale, 'ac.w.simpleFormula'),
            value: r.breakevenNoInterest
              ? formatDuration(locale, r.breakevenNoInterest.months)
              : t(locale, 'ac.w.notWithin', { years }),
          },
          {
            label: t(locale, 'ac.w.withInterest'),
            formula: t(locale, 'ac.w.withInterestFormula', {
              extra: formatINR(r.extraPrice),
              rate: formatPercent(input.interestRate),
            }),
            value: r.breakevenWithInterest
              ? formatDuration(locale, r.breakevenWithInterest.months)
              : t(locale, 'ac.w.notWithin', { years }),
            strong: true,
          },
        ]
      : [];

  const endRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'ac.w.totalSaving'), value: formatMoney(r.totalSaving) },
          {
            label: t(locale, 'ac.w.extraWithInterest'),
            value: `−${formatMoney(r.extraWithInterest[r.months]!)}`,
          },
          { label: t(locale, 'ac.w.net'), value: formatMoney(r.netGain), strong: true },
        ]
      : [];

  const flipLines: FlipLine[] = input
    ? flips.map((flip) => {
        const fmt =
          flip.variable === 'usage'
            ? formatPercent
            : flip.variable === 'pricePerUnit'
              ? (v: number) => `₹${v.toFixed(2)}`
              : (v: number) => formatMoney(v);
        return {
          text: t(locale, `ac.flip.${flip.variable}` as MessageKey, {
            years,
            value: fmt(flip.threshold),
          }),
          current: fmt(input[flip.variable as AcVariable]),
        };
      })
    : [];

  const columns: MonthlyColumn[] = r
    ? [
        { label: t(locale, 'ac.col.saving'), kind: 'money', values: r.monthlySaving },
        {
          label: t(locale, 'ac.col.cumulative'),
          kind: 'money',
          values: r.cumulativeSaving.slice(1),
        },
        {
          label: t(locale, 'ac.col.extra'),
          kind: 'money',
          values: r.extraWithInterest.slice(1),
        },
        { label: t(locale, 'ac.col.net'), kind: 'money', values: r.net.slice(1) },
      ]
    : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="ac-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ac-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({ ...AC_EXAMPLE_FORM, interestRate: assumptions.carLoanRate });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {field('basicPrice', 'ac.in.basicPrice', '₹', t(locale, 'ac.note.basicPrice'))}
            {field(
              'basicUnits',
              'ac.in.basicUnits',
              t(locale, 'ac.unit.unitsYear'),
              t(locale, 'ac.note.units'),
            )}
            {field(
              'efficientPrice',
              'ac.in.efficientPrice',
              '₹',
              t(locale, 'ac.note.efficientPrice'),
            )}
            {field(
              'efficientUnits',
              'ac.in.efficientUnits',
              t(locale, 'ac.unit.unitsYear'),
              t(locale, 'ac.note.units'),
            )}
          </Tier>

          <Tier tone="check" title={t(locale, 'tier.check')} hint={t(locale, 'tier.checkHint')}>
            {field(
              'pricePerUnit',
              'ac.in.pricePerUnit',
              t(locale, 'ac.unit.perUnit'),
              t(locale, 'ac.note.pricePerUnit'),
              {
                flagged: true,
              },
            )}
            {field('usage', 'ac.in.usage', '%', t(locale, 'ac.note.usage'), {
              percent: true,
              flagged: true,
              slider: { min: 0.25, max: 2, step: 0.05 },
            })}
          </Tier>

          <Refine
            locale={locale}
            storageKey="dw.refine.ac"
            hint={t(locale, 'ac.summary', {
              rise: formatPercent(form.tariffRise ?? 0),
              rate: formatPercent(form.interestRate ?? 0),
              years,
            })}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'ac.group.money')}>
              {field('tariffRise', 'ac.in.tariffRise', '%', t(locale, 'ac.note.tariffRise'), {
                percent: true,
              })}
              {field(
                'interestRate',
                'ac.in.interestRate',
                t(locale, 'assumptions.perYear'),
                t(locale, 'ac.note.interestRate'),
                { percent: true },
              )}
              {field(
                'years',
                'ac.in.years',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'ac.note.years'),
                { integer: true },
              )}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="ac-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="ac-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, r.netGain >= 0 ? 'ac.verdict.ahead' : 'ac.verdict.behind', {
                  amount: formatMoney(Math.abs(r.netGain)),
                  years,
                })}
              </p>
              {usageFlip && r.extraPrice > 0 && (
                <p class="mt-2 font-medium">
                  {t(locale, 'ac.verdict.flipUsage', { value: formatPercent(usageFlip.threshold) })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'ac.exampleNote')}
                  inputsId="ac-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'compare.ac', { years })}
                items={[
                  {
                    label: t(locale, 'compare.ac.saved'),
                    value: r.totalSaving,
                    display: formatMoney(r.totalSaving),
                    best: r.netGain >= 0,
                  },
                  {
                    label: t(locale, 'compare.ac.cost'),
                    value: r.extraWithInterest[r.months]!,
                    display: formatMoney(r.extraWithInterest[r.months]!),
                  },
                ]}
              />
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'ac.stat.extra')}>{formatMoney(r.extraPrice)}</Stat>
                <Stat label={t(locale, 'ac.stat.saving')}>{formatMoney(r.firstYearSaving)}</Stat>
                <Stat label={t(locale, 'ac.stat.simple')}>
                  {r.breakevenNoInterest
                    ? formatDuration(locale, r.breakevenNoInterest.months)
                    : '—'}
                </Stat>
                <Stat label={t(locale, 'ac.stat.units')}>
                  {t(locale, 'ac.unitsValue', {
                    n: formatNumber(Math.round(r.unitsSavedYearly)),
                  })}
                </Stat>
              </dl>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'ac.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'ac.needInputs')}</p>
              <p class="mt-2 text-sm">{t(locale, 'solar.stillMissing', { n: missing.length })}</p>
            </div>
          )}
          {shareHref && r && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="ac"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'ac.stat.extra'), value: formatMoney(r.extraPrice) },
                    { label: t(locale, 'ac.stat.saving'), value: formatMoney(r.firstYearSaving) },
                    { label: t(locale, 'ac.in.usage'), value: formatPercent(input.usage) },
                    {
                      label: t(locale, 'ac.in.pricePerUnit'),
                      value: `₹${formatNumber(input.pricePerUnit)}`,
                    },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <SensitivityList locale={locale} lines={flipLines} />
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="grid gap-4 lg:grid-cols-3">
                <WorkingBlock title={t(locale, 'ac.w.savingTitle')} rows={savingRows} />
                {paybackRows.length > 0 && (
                  <WorkingBlock title={t(locale, 'ac.w.paybackTitle')} rows={paybackRows}>
                    {t(locale, 'ac.w.paybackNote')}
                  </WorkingBlock>
                )}
                <WorkingBlock title={t(locale, 'ac.w.endTitle', { years })} rows={endRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'detail.chart')}
              hint={t(locale, 'detail.chartHint')}
            >
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <NetPositionChart
                  locale={locale}
                  title={t(locale, 'ac.chart.title')}
                  netWithInterest={r.net}
                  netNoInterest={r.cumulativeSaving.map((s) => s - r.extraPrice)}
                  bandLow={extras?.bandLow}
                  bandHigh={extras?.bandHigh}
                  breakevenWithInterest={r.breakevenWithInterest?.months ?? null}
                  breakevenNoInterest={r.breakevenNoInterest?.months ?? null}
                />
                <section aria-labelledby="ac-scenarios">
                  <h3 id="ac-scenarios" class="font-display text-xl font-medium">
                    {t(locale, 'scenario.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {extras?.runs.map(({ name, rise, result }) => (
                      <li key={name} class="rounded-xl border border-line p-4">
                        <div class="flex items-baseline justify-between gap-3">
                          <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                          <span
                            class={`font-semibold num ${result.netGain < 0 ? 'text-danger' : ''}`}
                          >
                            {formatMoney(result.netGain)}
                          </span>
                        </div>
                        <p class="mt-1 text-sm text-ink-muted">
                          {t(locale, 'ac.scenario.rise', { value: formatPercent(rise) })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                columns={columns}
                highlight={r.breakevenWithInterest ? [r.breakevenWithInterest.months] : []}
                csvFilename="capitalverdict-ac-payback.csv"
              />
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <fieldset class="mt-4">
      <legend class="w-full border-b border-line-strong pb-1.5 font-display text-lg font-medium">
        {title}
      </legend>
      <div class="divide-y divide-line">{children}</div>
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
