import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, incomeTax, verifiedStampDuty } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { plotVs, plotVsFlips, type PlotOption } from '@/models/plotVs';
import {
  PLOT_VS_EXAMPLE_FORM,
  PLOT_VS_EXAMPLE_KEYS,
  PLOT_VS_LIMITS,
  invalidPlotVsFields,
  plotVsShareSchema,
  toPlotVsInput,
  type PlotVsForm,
} from '@/models/plotVsForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
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

const OPTIONS: PlotOption[] = ['plot', 'fd', 'fund'];
const GROWTH = defaults.scenarioVariables.propertyAppreciation.values;
const CHECKLIST: MessageKey[] = [
  'plotVs.checklist.1',
  'plotVs.checklist.2',
  'plotVs.checklist.3',
  'plotVs.checklist.4',
];
const QUICK: (keyof PlotVsForm)[] = [
  'plotPrice',
  'stampDuty',
  'plotGrowth',
  'fdRate',
  'taxRate',
  'fundReturn',
  'years',
];

export default function PlotVsTool({ locale }: Props) {
  const [form, setForm] = useState<PlotVsForm>(PLOT_VS_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof PlotVsForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof PlotVsForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, plotVsShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof PlotVsForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Inflation follows the global assumptions unless the visitor set it here.
  useEffect(() => {
    if (!ready || pinned.current.has('inflation')) return;
    setForm((f) =>
      f.inflation === assumptions.inflation ? f : { ...f, inflation: assumptions.inflation },
    );
  }, [ready, assumptions.inflation]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), plotVsShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toPlotVsInput(form), [form]);
  const r = useMemo(() => (input ? plotVs(input, incomeTax) : null), [input]);
  const extras = useIdleValue(() => {
    if (!input) return null;
    return {
      flips: plotVsFlips(input, incomeTax),
      runs: (['pessimistic', 'base', 'optimistic'] as const).map((name) => ({
        name,
        growth: GROWTH[name],
        result: plotVs({ ...input, plotGrowth: GROWTH[name] }, incomeTax),
      })),
    };
  }, [input]);
  const plotFlip = extras?.flips.find((f) => f.variable === 'plotGrowth');

  const years = form.years ?? 10;
  const missing = invalidPlotVsFields(form);
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const isExample = PLOT_VS_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const optionName = (o: PlotOption) => t(locale, `plotVs.option.${o}` as MessageKey);

  const field = (
    key: keyof PlotVsForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      optional?: boolean;
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
      example={PLOT_VS_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...PLOT_VS_LIMITS[key]}
      {...extra}
      layout="row"
    />
  );

  const headline = r
    ? t(locale, `plotVs.verdict.${r.best}` as MessageKey, {
        amount: formatMoney(r.lead),
        years,
      })
    : '';

  const plotRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'plotVs.w.cash'),
            formula: `${formatINR(input.plotPrice)} × (1 + ${formatPercent(input.stampDuty)}) + ${formatINR(input.otherBuyCosts)}`,
            value: formatINR(r.cash),
          },
          {
            label: t(locale, 'plotVs.w.sale'),
            formula: `${formatINR(input.plotPrice)} × (1 + ${formatPercent(input.plotGrowth)})^${years}`,
            value: formatMoney(r.plot.salePrice),
          },
          { label: t(locale, 'plotVs.w.selling'), value: `−${formatMoney(r.plot.sellingCosts)}` },
          {
            label: t(locale, 'plotVs.w.cgTax'),
            formula: t(locale, 'plotVs.w.cgFormula', {
              gain: formatMoney(Math.max(0, r.plot.gain)),
            }),
            value: `−${formatMoney(r.plot.tax)}`,
          },
          { label: t(locale, 'plotVs.w.upkeep'), value: `−${formatMoney(r.plot.upkeep)}` },
          { label: t(locale, 'plotVs.w.kept'), value: formatMoney(r.plot.net), strong: true },
        ]
      : [];

  const fdRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'plotVs.w.invested'), value: formatINR(r.cash) },
          {
            label: t(locale, 'plotVs.w.fdNetRate'),
            formula: `${formatPercent(input.fdRate)} × (1 − ${formatPercent(input.taxRate)})`,
            value: formatPercent(r.fd.yearlyReturn),
          },
          { label: t(locale, 'plotVs.w.fdTax'), value: `−${formatMoney(r.fd.tax)}` },
          { label: t(locale, 'plotVs.w.kept'), value: formatMoney(r.fd.net), strong: true },
        ]
      : [];

  const fundRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'plotVs.w.invested'), value: formatINR(r.cash) },
          {
            label: t(locale, 'plotVs.w.fundValue'),
            formula: `${formatINR(r.cash)} × (1 + ${formatPercent(input.fundReturn)})^${years}`,
            value: formatMoney(r.fund.value),
          },
          {
            label: t(locale, 'plotVs.w.cgTax'),
            formula: t(locale, 'plotVs.w.fundFormula', {
              gain: formatMoney(Math.max(0, r.fund.gain)),
              exempt: formatINR(incomeTax.capitalGains.equityLongTermExemption),
            }),
            value: `−${formatMoney(r.fund.tax)}`,
          },
          { label: t(locale, 'plotVs.w.kept'), value: formatMoney(r.fund.net), strong: true },
        ]
      : [];

  const flipLines: FlipLine[] =
    input && extras
      ? extras.flips.map((flip) => ({
          text: t(locale, `plotVs.flip.${flip.variable}` as MessageKey, {
            years,
            value: formatPercent(flip.threshold),
          }),
          current: formatPercent(input[flip.variable]),
        }))
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="pv-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="pv-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({ ...PLOT_VS_EXAMPLE_FORM, inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'plotVs.scope')}</p>

          <Group title={t(locale, 'plotVs.group.plot')}>
            {field('plotPrice', 'plotVs.in.plotPrice', '₹', t(locale, 'plotVs.note.plotPrice'), {
              slider: { min: 2_00_000, max: 1_00_00_000, step: 50_000 },
            })}
            {field('stampDuty', 'plotVs.in.stampDuty', '%', t(locale, 'plotVs.note.stampDuty'), {
              percent: true,
              flagged: verifiedStampDuty() === null,
            })}
            {field('plotGrowth', 'plotVs.in.plotGrowth', '%', t(locale, 'plotVs.note.plotGrowth'), {
              percent: true,
              flagged: true,
            })}
          </Group>
          <Group title={t(locale, 'plotVs.group.others')}>
            {field('fdRate', 'plotVs.in.fdRate', '%', t(locale, 'plotVs.note.fdRate'), {
              percent: true,
            })}
            {field('taxRate', 'plotVs.in.taxRate', '%', t(locale, 'plotVs.note.taxRate'), {
              percent: true,
            })}
            {field('fundReturn', 'plotVs.in.fundReturn', '%', t(locale, 'plotVs.note.fundReturn'), {
              percent: true,
              flagged: true,
            })}
            {field(
              'years',
              'plotVs.in.years',
              t(locale, 'input.horizonYears.unit'),
              t(locale, 'plotVs.note.years'),
              { integer: true },
            )}
          </Group>

          <Refine
            locale={locale}
            storageKey="dw.refine.plotVs"
            hint={t(locale, 'plotVs.refineHint')}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'plotVs.group.plotCosts')}>
              {field(
                'otherBuyCosts',
                'plotVs.in.otherBuyCosts',
                '₹',
                t(locale, 'plotVs.note.otherBuyCosts'),
                { optional: true },
              )}
              {field(
                'yearlyCost',
                'plotVs.in.yearlyCost',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'plotVs.note.yearlyCost'),
                { optional: true },
              )}
              {field(
                'sellingCost',
                'plotVs.in.sellingCost',
                '%',
                t(locale, 'plotVs.note.sellingCost'),
                { percent: true },
              )}
            </Group>
            <Group title={t(locale, 'plotVs.group.economy')}>
              {field('inflation', 'plotVs.in.inflation', '%', t(locale, 'plotVs.note.inflation'), {
                percent: true,
              })}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="pv-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="pv-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, `plotVs.verdict.today.${r.best}` as MessageKey, {
                  amount: formatMoney(r.bestToday),
                })}
              </p>
              {plotFlip && r.best !== 'plot' && (
                <p class="mt-2 font-medium">
                  {t(locale, 'plotVs.verdict.plotNeeds', {
                    value: formatPercent(plotFlip.threshold),
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'plotVs.exampleNote')}
                  inputsId="pv-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'plotVs.compare', { years })}
                items={OPTIONS.map((o) => ({
                  label: optionName(o),
                  value: r[o].net,
                  display: formatMoney(r[o].net),
                  best: r.best === o,
                }))}
              />
              <dl class="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-line pt-4">
                {OPTIONS.map((o) => (
                  <Stat key={o} label={t(locale, `plotVs.stat.return.${o}` as MessageKey)}>
                    {formatPercent(r[o].yearlyReturn)}
                  </Stat>
                ))}
              </dl>
              <p class="mt-3 text-xs text-ink-muted">
                {t(locale, 'plotVs.stat.note', { cash: formatMoney(r.cash) })}
              </p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'plotVs.needInputs')}</p>
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
            tool="plotVs"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    {
                      label: t(locale, 'plotVs.in.plotPrice'),
                      value: formatMoney(input.plotPrice),
                    },
                    {
                      label: t(locale, 'plotVs.in.plotGrowth'),
                      value: formatPercent(input.plotGrowth),
                    },
                    ...OPTIONS.map((o) => ({ label: optionName(o), value: formatMoney(r[o].net) })),
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
                <WorkingBlock title={optionName('plot')} rows={plotRows} />
                <WorkingBlock title={optionName('fd')} rows={fdRows} />
                <WorkingBlock title={optionName('fund')} rows={fundRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'plotVs.table.title')}
              hint={t(locale, 'plotVs.table.hint')}
            >
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <div class="overflow-x-auto">
                  <table class="w-full min-w-80 text-left text-sm">
                    <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                    <thead>
                      <tr class="border-b border-line-strong">
                        <th scope="col" class="py-2 pr-3 font-medium">
                          {t(locale, 'plotVs.table.year')}
                        </th>
                        {OPTIONS.map((o) => (
                          <th key={o} scope="col" class="py-2 pr-3 text-right font-medium">
                            {optionName(o)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.plot.byYear.map((_, y) =>
                        y === 0 ? null : (
                          <tr key={y} class="border-b border-line">
                            <th scope="row" class="py-2 pr-3 font-normal num">
                              {y}
                            </th>
                            {OPTIONS.map((o) => {
                              const v = r[o].byYear[y]!;
                              const top = Math.max(...OPTIONS.map((x) => r[x].byYear[y]!));
                              return (
                                <td
                                  key={o}
                                  class={`py-2 pr-3 text-right num ${v === top ? 'font-semibold text-accent-strong' : ''}`}
                                >
                                  {formatMoney(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  <p class="mt-2 text-sm text-ink-muted">{t(locale, 'plotVs.table.note')}</p>
                </div>
                <section aria-labelledby="pv-scenarios">
                  <h3 id="pv-scenarios" class="font-display text-xl font-medium">
                    {t(locale, 'plotVs.scenario.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {extras?.runs.map(({ name, growth, result }) => (
                      <li key={name} class="rounded-xl border border-line p-4">
                        <div class="flex items-baseline justify-between gap-3">
                          <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                          <span class="font-semibold num">{formatMoney(result.plot.net)}</span>
                        </div>
                        <p class="mt-1 text-sm text-ink-muted">
                          {t(locale, 'plotVs.scenario.growth', { value: formatPercent(growth) })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
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
