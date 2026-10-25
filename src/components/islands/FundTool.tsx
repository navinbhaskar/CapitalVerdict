import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, incomeTax } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { useIdleValue } from '@/lib/useIdleValue';
import { findFlip } from '@/engine/sensitivity';
import { fundPlan, maxWithdrawal, returnToLast, type FundResult } from '@/models/fund';
import {
  FUND_LIMITS,
  fundExampleForm,
  fundExampleKeys,
  fundShareSchema,
  invalidFundFields,
  toFundInput,
  type FundForm,
  type FundMode,
} from '@/models/fundForm';
import CompareBars, { type CompareItem } from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import EquityTaxNote from '@/components/tool/EquityTaxNote';
import MarketRiskNote from '@/components/tool/MarketRiskNote';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable from '@/components/tool/MonthlyTable';

interface Props {
  locale: Locale;
  mode: FundMode;
}

const RETURNS = defaults.scenarioVariables.equityReturnNominal.values;
/** The fields shown above "Filled in for you", per calculator. */
const QUICK: Record<FundMode, (keyof FundForm)[]> = {
  sip: ['monthly', 'years'],
  lumpsum: ['lumpSum', 'years'],
  swp: ['lumpSum', 'withdrawal', 'years'],
};
const SLIDER: Partial<Record<keyof FundForm, { min: number; max: number; step: number }>> = {
  monthly: { min: 500, max: 100_000, step: 500 },
  lumpSum: { min: 10_000, max: 10_000_000, step: 10_000 },
  withdrawal: { min: 1_000, max: 300_000, step: 1_000 },
  years: { min: 1, max: 40, step: 1 },
};
const PERCENT = new Set<keyof FundForm>([
  'stepUp',
  'withdrawalRise',
  'annualReturn',
  'inflation',
  'fdRate',
  'taxRate',
]);

/** The SIP, lumpsum and SWP calculators: one fund model, three questions. */
export default function FundTool({ locale, mode }: Props) {
  const [form, setForm] = useState<FundForm>(() => fundExampleForm(mode));
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof FundForm>());
  const { assumptions } = useGlobalAssumptions();
  const exampleKeys = fundExampleKeys(mode);
  const k = (key: string) => `fund.${mode}.${key}` as MessageKey;

  const set = (key: keyof FundForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, fundShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof FundForm)[]) pinned.current.add(key);
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
      const query = encodeShare(pickKeys(form, pinned.current), fundShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toFundInput(mode, form), [mode, form]);
  const r = useMemo(() => (input ? fundPlan(input, incomeTax) : null), [input]);

  // An FD to compare with (lumpsum only): its interest taxed every year at the visitor's rate.
  const fd =
    mode === 'lumpsum' && input && form.fdRate !== null && form.taxRate !== null
      ? {
          rate: form.fdRate,
          tax: form.taxRate,
          kept: input.lumpSum * Math.pow(1 + form.fdRate * (1 - form.taxRate), input.years),
        }
      : null;

  const extras = useIdleValue(() => {
    if (!input) return null;
    const runs = (['pessimistic', 'base', 'optimistic'] as const).map((name) => ({
      name,
      ret: RETURNS[name],
      result: fundPlan({ ...input, annualReturn: RETURNS[name] }, incomeTax),
    }));
    if (mode === 'swp') {
      return {
        runs,
        max: maxWithdrawal(input, incomeTax),
        flip: returnToLast(input, incomeTax),
      };
    }
    if (fd) {
      const gap = (ret: number) =>
        fundPlan({ ...input, annualReturn: ret }, incomeTax).kept - fd.kept;
      return { runs, max: null, flip: findFlip(gap, { lo: 0, hi: 0.3, steps: 60 }) };
    }
    return { runs, max: null, flip: null };
  }, [input, fd?.kept]);

  const years = form.years ?? 0;
  const missing = invalidFundFields(mode, form);
  const quickInvalid = missing.filter((key) => QUICK[mode].includes(key));
  const refineInvalid = missing.some((key) => !QUICK[mode].includes(key));
  const isExample = exampleKeys.some((key) => !pinned.current.has(key));

  const field = (key: keyof FundForm, flagged = false) => {
    const percent = PERCENT.has(key);
    return (
      <NumberField
        locale={locale}
        name={key}
        label={t(locale, `fund.in.${key}` as MessageKey)}
        unit={percent ? '%' : key === 'years' ? t(locale, 'input.horizonYears.unit') : '₹'}
        note={t(locale, `fund.note.${key}` as MessageKey)}
        value={form[key]}
        onChange={set(key)}
        example={exampleKeys.includes(key) && !pinned.current.has(key)}
        {...FUND_LIMITS[key]}
        percent={percent}
        integer={key === 'years'}
        flagged={flagged}
        slider={SLIDER[key]}
        layout="row"
      />
    );
  };

  const headline = r && input ? headlineFor(locale, mode, r, input, form) : '';

  const bars: CompareItem[] = r
    ? mode === 'swp'
      ? [
          {
            label: t(locale, 'fund.bar.invested'),
            value: r.invested,
            display: formatMoney(r.invested),
          },
          {
            label: t(locale, 'fund.bar.withdrawn'),
            value: r.withdrawn - r.withdrawalTax,
            display: formatMoney(r.withdrawn),
            tax: r.withdrawalTax,
            note: t(locale, 'fund.bar.withdrawnNote', { tax: formatMoney(r.withdrawalTax) }),
            best: true,
          },
          { label: t(locale, 'fund.bar.left'), value: r.value, display: formatMoney(r.value) },
        ]
      : [
          {
            label: t(locale, 'fund.bar.invested'),
            value: r.invested,
            display: formatMoney(r.invested),
          },
          {
            label: t(locale, 'fund.bar.kept'),
            value: r.kept,
            display: formatMoney(r.kept),
            tax: r.sale.tax,
            note: t(locale, 'fund.bar.keptNote', { tax: formatMoney(r.sale.tax) }),
            best: !fd || r.kept >= fd.kept,
          },
          ...(fd
            ? [
                {
                  label: t(locale, 'fund.bar.fd', { rate: formatPercent(fd.rate) }),
                  value: fd.kept,
                  display: formatMoney(fd.kept),
                  note: t(locale, 'fund.bar.fdNote', { tax: formatPercent(fd.tax) }),
                  best: fd.kept > r.kept,
                },
              ]
            : []),
        ]
    : [];

  const working: WorkingRow[] =
    r && input
      ? mode === 'swp'
        ? [
            { label: t(locale, 'fund.w.invested'), value: formatINR(r.invested) },
            {
              label: t(locale, 'fund.w.withdrawn'),
              formula: t(locale, 'fund.w.withdrawnFormula', {
                amount: formatINR(input.withdrawal),
                rise: formatPercent(input.withdrawalRise),
              }),
              value: formatMoney(r.withdrawn),
            },
            {
              label: t(locale, 'fund.w.withdrawalTax'),
              formula: t(locale, 'fund.w.withdrawalTaxFormula'),
              value: `−${formatMoney(r.withdrawalTax)}`,
            },
            {
              label: t(locale, 'fund.w.left'),
              formula: t(locale, 'fund.w.growthFormula', {
                rate: formatPercent(input.annualReturn),
              }),
              value: formatMoney(r.value),
              strong: true,
            },
          ]
        : [
            { label: t(locale, 'fund.w.invested'), value: formatINR(r.invested) },
            {
              label: t(locale, 'fund.w.value'),
              formula: t(locale, 'fund.w.growthFormula', {
                rate: formatPercent(input.annualReturn),
              }),
              value: formatMoney(r.value),
            },
            {
              label: t(locale, 'fund.w.shortTerm'),
              formula: t(locale, 'saving.w.shortTermFormula'),
              value: formatMoney(r.sale.shortTermGain),
            },
            {
              label: t(locale, 'fund.w.longTerm'),
              formula: t(locale, 'saving.w.longTermFormula', {
                exempt: formatINR(incomeTax.capitalGains.equityLongTermExemption),
              }),
              value: formatMoney(r.sale.longTermGain),
            },
            { label: t(locale, 'fund.w.tax'), value: `−${formatMoney(r.sale.tax)}` },
            { label: t(locale, 'fund.w.kept'), value: formatMoney(r.kept), strong: true },
            {
              label: t(locale, 'fund.w.today'),
              formula: t(locale, 'fund.w.todayFormula', {
                rate: formatPercent(input.inflation),
                years: input.years,
              }),
              value: formatMoney(r.keptToday),
            },
          ]
      : [];

  const flipLines: FlipLine[] =
    input && extras?.flip
      ? [
          {
            text:
              mode === 'swp'
                ? t(locale, 'fund.flip.swp', { value: formatPercent(extras.flip.threshold), years })
                : t(locale, 'fund.flip.fd', { value: formatPercent(extras.flip.threshold) }),
            current: formatPercent(input.annualReturn),
          },
        ]
      : [];

  const yearRows = r ? r.byYear.slice(1) : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="fund-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="fund-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({ ...fundExampleForm(mode), inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'fund.scope')}</p>

          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {QUICK[mode].map((key) => field(key))}
          </Tier>

          <Tier tone="check" title={t(locale, 'tier.check')} hint={t(locale, 'fund.checkHint')}>
            {field('annualReturn', true)}
          </Tier>

          <Refine
            locale={locale}
            storageKey={`dw.refine.fund.${mode}`}
            hint={t(locale, k('summary'), {
              stepUp: formatPercent(form.stepUp ?? 0),
              rise: formatPercent(form.withdrawalRise ?? 0),
              inflation: formatPercent(form.inflation ?? 0),
            })}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'fund.group.more')}>
              {mode === 'sip' && field('stepUp')}
              {mode === 'swp' && field('withdrawalRise')}
              {field('inflation')}
            </Group>
            {mode === 'lumpsum' && (
              <Group title={t(locale, 'fund.group.fd')}>
                {field('fdRate')}
                {field('taxRate')}
              </Group>
            )}
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="fund-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="fund-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {mode === 'swp'
                  ? t(locale, 'fund.swp.sub', {
                      withdrawn: formatMoney(r.withdrawn),
                      tax: formatMoney(r.withdrawalTax),
                    })
                  : t(locale, 'fund.sub', {
                      value: formatMoney(r.value),
                      tax: formatMoney(r.sale.tax),
                      invested: formatMoney(r.invested),
                      today: formatMoney(r.keptToday),
                    })}
              </p>
              {mode === 'swp' && extras?.max != null && (
                <p class="mt-2 font-medium">
                  {t(locale, input.withdrawalRise > 0 ? 'fund.swp.maxRising' : 'fund.swp.max', {
                    years: input.years,
                    max: formatINR(extras.max),
                    rise: formatPercent(input.withdrawalRise),
                  })}
                </p>
              )}
              {fd && (
                <p class="mt-2 font-medium">
                  {t(locale, fd.kept > r.kept ? 'fund.lumpsum.fdAhead' : 'fund.lumpsum.fdBehind', {
                    rate: formatPercent(fd.rate),
                    tax: formatPercent(fd.tax),
                    fd: formatMoney(fd.kept),
                    diff: formatMoney(Math.abs(r.kept - fd.kept)),
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, k('exampleNote'))}
                  inputsId="fund-inputs-heading"
                />
              )}
              <CompareBars caption={t(locale, k('compare'), { years })} items={bars} />
              <MarketRiskNote locale={locale} kind="fund" />
              {mode === 'swp' && (
                <p class="mt-3 text-sm text-ink-muted">{t(locale, 'fund.swp.sequence')}</p>
              )}
              <EquityTaxNote locale={locale} context="computed" />
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'fund.compounding')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'fund.needInputs')}</p>
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
            tool={`fund-${mode}`}
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    ...QUICK[mode].map((key) => ({
                      label: t(locale, `fund.in.${key}` as MessageKey),
                      value: key === 'years' ? String(form[key]) : formatMoney(form[key] ?? 0),
                    })),
                    {
                      label: t(locale, 'fund.in.annualReturn'),
                      value: formatPercent(input.annualReturn),
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
            {mode === 'sip' || (mode === 'lumpsum' && !fd) ? (
              <Returns locale={locale} runs={extras?.runs ?? []} mode={mode} />
            ) : (
              <SensitivityList locale={locale} lines={flipLines} />
            )}
            <NonMoneyChecklist
              locale={locale}
              items={[1, 2, 3].map((n) => t(locale, k(`checklist.${n}`)))}
            />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="max-w-xl">
                <WorkingBlock title={t(locale, k('workingTitle'))} rows={working} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'fund.chart.heading')}
              hint={t(locale, k('chartHint'))}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'fund.chart.title')}
                netWithInterest={r.valueByMonth}
                netNoInterest={mode === 'swp' ? r.withdrawnByMonth : r.investedByMonth}
                breakevenWithInterest={null}
                labels={{
                  main: t(locale, 'fund.chart.value'),
                  secondary: t(
                    locale,
                    mode === 'swp' ? 'fund.chart.withdrawn' : 'fund.chart.invested',
                  ),
                }}
              />
              <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <div class="overflow-x-auto">
                  <table class="w-full min-w-80 text-left text-sm">
                    <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                    <thead>
                      <tr class="border-b border-line-strong">
                        <th scope="col" class="py-2 pr-3 font-medium">
                          {t(locale, 'plotVs.table.year')}
                        </th>
                        {mode === 'swp' ? (
                          <>
                            <th scope="col" class="py-2 pr-3 text-right font-medium">
                              {t(locale, 'fund.table.withdrawn')}
                            </th>
                            <th scope="col" class="py-2 pr-3 text-right font-medium">
                              {t(locale, 'fund.table.tax')}
                            </th>
                          </>
                        ) : (
                          <th scope="col" class="py-2 pr-3 text-right font-medium">
                            {t(locale, 'fund.table.invested')}
                          </th>
                        )}
                        <th scope="col" class="py-2 pr-3 text-right font-medium">
                          {t(locale, 'fund.table.value')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearRows.map((row) => (
                        <tr key={row.year} class="border-b border-line">
                          <th scope="row" class="py-2 pr-3 font-normal num">
                            {row.year}
                          </th>
                          {mode === 'swp' ? (
                            <>
                              <td class="py-2 pr-3 text-right num">{formatMoney(row.withdrawn)}</td>
                              <td class="py-2 pr-3 text-right num">{formatMoney(row.tax)}</td>
                            </>
                          ) : (
                            <td class="py-2 pr-3 text-right num">
                              {formatMoney(row.investedToDate)}
                            </td>
                          )}
                          <td class="py-2 pr-3 text-right font-medium num">
                            {formatMoney(row.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p class="mt-2 text-sm text-ink-muted">{t(locale, k('tableNote'))}</p>
                </div>
                {(mode === 'swp' || fd) && (
                  <Returns locale={locale} runs={extras?.runs ?? []} mode={mode} />
                )}
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename={`capitalverdict-${mode}.csv`}
                highlight={r.depletedMonth ? [r.depletedMonth] : []}
                columns={[
                  {
                    label: t(locale, 'fund.chart.invested'),
                    values: r.investedByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'fund.chart.withdrawn'),
                    values: r.withdrawnByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'fund.chart.value'),
                    values: r.valueByMonth.slice(1),
                    kind: 'money',
                  },
                ]}
              />
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}

function headlineFor(
  locale: Locale,
  mode: FundMode,
  r: FundResult,
  input: NonNullable<ReturnType<typeof toFundInput>>,
  form: FundForm,
): string {
  if (mode === 'swp') {
    return r.depletedMonth === null
      ? t(locale, 'fund.swp.lasts', {
          withdrawal: formatINR(input.withdrawal),
          years: input.years,
          left: formatMoney(r.value),
        })
      : t(locale, 'fund.swp.runsOut', {
          withdrawal: formatINR(input.withdrawal),
          duration: formatDuration(locale, r.depletedMonth - 1),
        });
  }
  return t(locale, mode === 'sip' ? 'fund.sip.headline' : 'fund.lumpsum.headline', {
    kept: formatMoney(r.kept),
    years: input.years,
    amount: formatMoney(form.lumpSum ?? 0),
  });
}

/** What you would keep (or have left) at a lower and a higher return. */
function Returns({
  locale,
  runs,
  mode,
}: {
  locale: Locale;
  runs: { name: 'pessimistic' | 'base' | 'optimistic'; ret: number; result: FundResult }[];
  mode: FundMode;
}) {
  return (
    <section aria-labelledby="fund-returns">
      <h2 id="fund-returns" class="font-display text-2xl font-medium">
        {t(locale, 'fund.returns.heading')}
      </h2>
      <p class="mt-1 text-sm text-ink-muted">
        {t(locale, `fund.${mode}.returnsIntro` as MessageKey)}
      </p>
      <ul class="mt-4 space-y-3" role="list">
        {runs.map(({ name, ret, result }) => (
          <li key={name} class="rounded-xl border border-line p-4">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-medium">
                {t(locale, 'fund.returns.at', { value: formatPercent(ret) })}
              </span>
              <span class="font-semibold num">
                {mode === 'swp'
                  ? result.depletedMonth === null
                    ? t(locale, 'fund.returns.left', { amount: formatMoney(result.value) })
                    : t(locale, 'fund.returns.runsOut', {
                        duration: formatDuration(locale, result.depletedMonth - 1),
                      })
                  : formatMoney(result.kept)}
              </span>
            </div>
            <p class="mt-1 text-sm text-ink-muted">{t(locale, `scenario.${name}`)}</p>
          </li>
        ))}
      </ul>
    </section>
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
