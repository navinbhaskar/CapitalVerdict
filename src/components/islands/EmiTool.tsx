import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { emiAt, emiPlan } from '@/models/emi';
import {
  EMI_EXAMPLE_KEYS,
  EMI_LIMITS,
  emiExampleForm,
  emiShareSchema,
  invalidEmiFields,
  toEmiInput,
  type EmiForm,
} from '@/models/emiForm';
import CompareBars, { type CompareItem } from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable from '@/components/tool/MonthlyTable';

interface Props {
  locale: Locale;
}

const QUICK: (keyof EmiForm)[] = ['amount', 'years'];
const PERCENT = new Set<keyof EmiForm>(['annualRate', 'inflation']);
const SLIDER: Partial<Record<keyof EmiForm, { min: number; max: number; step: number }>> = {
  amount: { min: 100_000, max: 20_000_000, step: 50_000 },
  years: { min: 1, max: 30, step: 1 },
};
/** Rates either side of the visitor's, for "what would change it". */
const RATE_STEPS = [-0.01, 0, 0.01, 0.02];
const TENURES = [10, 15, 20, 25, 30];

/** A loan's EMI, where it goes, and what a yearly prepayment does. */
export default function EmiTool({ locale }: Props) {
  const [form, setForm] = useState<EmiForm>(emiExampleForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof EmiForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof EmiForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, emiShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof EmiForm)[]) pinned.current.add(key);
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
      const query = encodeShare(pickKeys(form, pinned.current), emiShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toEmiInput(form), [form]);
  const r = useMemo(() => (input ? emiPlan(input) : null), [input]);
  const rateUp = input ? emiAt(input.amount, input.annualRate + 0.01, input.years) : null;

  const missing = invalidEmiFields(form);
  const quickInvalid = missing.filter((key) => QUICK.includes(key));
  const refineInvalid = missing.some((key) => !QUICK.includes(key) && key !== 'annualRate');
  const isExample = EMI_EXAMPLE_KEYS.some((key) => !pinned.current.has(key));

  const field = (key: keyof EmiForm, opts: { flagged?: boolean; optional?: boolean } = {}) => {
    const percent = PERCENT.has(key);
    return (
      <NumberField
        locale={locale}
        name={key}
        label={t(locale, `emi.in.${key}` as MessageKey)}
        unit={percent ? '%' : key === 'years' ? t(locale, 'input.horizonYears.unit') : '₹'}
        note={t(locale, `emi.note.${key}` as MessageKey)}
        value={form[key]}
        onChange={set(key)}
        example={EMI_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
        {...EMI_LIMITS[key]}
        percent={percent}
        integer={key === 'years'}
        optional={opts.optional}
        flagged={opts.flagged}
        slider={SLIDER[key]}
        layout="row"
      />
    );
  };

  const headline = r ? t(locale, 'emi.headline', { emi: formatINR(r.emi) }) : '';
  const prepaid = r?.withoutPrepayment ?? null;

  const bars: CompareItem[] =
    r && input
      ? [
          {
            label: t(locale, 'emi.bar.borrowed'),
            value: input.amount,
            display: formatMoney(input.amount),
          },
          {
            label: t(locale, 'emi.bar.interest'),
            value: r.totalInterest,
            display: formatMoney(r.totalInterest),
            note: t(locale, 'emi.bar.interestNote', {
              share: formatPercent(Number((r.totalInterest / r.totalPaid).toFixed(3))),
            }),
            // Brass only when there is something better to show: the interest a prepayment saves.
            best: prepaid !== null,
          },
          ...(prepaid
            ? [
                {
                  label: t(locale, 'emi.bar.interestWithout'),
                  value: prepaid.totalInterest,
                  display: formatMoney(prepaid.totalInterest),
                },
              ]
            : []),
        ]
      : [];

  const working: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'emi.w.rate'),
            formula: t(locale, 'emi.w.rateFormula', { rate: formatPercent(input.annualRate) }),
            value: `${Number(((input.annualRate / 12) * 100).toFixed(4))}%`,
          },
          {
            label: t(locale, 'emi.w.emi'),
            formula: t(locale, 'emi.w.emiFormula', {
              amount: formatINR(input.amount),
              n: input.years * 12,
            }),
            value: formatINR(r.emi),
            strong: true,
          },
          {
            label: t(locale, 'emi.w.firstInterest'),
            formula: t(locale, 'emi.w.firstInterestFormula', { amount: formatINR(input.amount) }),
            value: formatINR(r.schedule.rows[0]!.interest),
          },
          ...(prepaid
            ? [
                {
                  label: t(locale, 'emi.w.prepaid'),
                  value: formatMoney(r.schedule.rows.reduce((s, row) => s + row.prepayment, 0)),
                },
              ]
            : []),
          { label: t(locale, 'emi.w.interest'), value: formatMoney(r.totalInterest) },
          { label: t(locale, 'emi.w.total'), value: formatMoney(r.totalPaid), strong: true },
          {
            label: t(locale, 'emi.w.today'),
            formula: t(locale, 'emi.w.todayFormula', {
              rate: formatPercent(input.inflation),
              months: r.months,
            }),
            value: formatINR(r.lastEmiToday),
          },
        ]
      : [];

  const balanceByMonth =
    r && input ? [input.amount, ...r.schedule.rows.map((row) => row.closing)] : [];
  const interestByMonth = useMemo(() => {
    if (!r) return [];
    let sum = 0;
    return [0, ...r.schedule.rows.map((row) => (sum += row.interest))];
  }, [r]);

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="emi-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="emi-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({ ...emiExampleForm(), inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'emi.scope')}</p>

          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {QUICK.map((key) => field(key))}
          </Tier>

          <Tier tone="check" title={t(locale, 'tier.check')} hint={t(locale, 'emi.checkHint')}>
            {field('annualRate', { flagged: true })}
          </Tier>

          <Refine
            locale={locale}
            storageKey="dw.refine.emi"
            hint={t(locale, 'emi.summary', {
              prepay: form.yearlyPrepayment
                ? formatINR(form.yearlyPrepayment)
                : t(locale, 'emi.summaryNone'),
              inflation: formatPercent(form.inflation ?? 0),
            })}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'emi.group.more')}>
              {field('yearlyPrepayment', { optional: true })}
              {field('inflation')}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input && rateUp ? (
            <section
              id="verdict"
              aria-labelledby="emi-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="emi-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'emi.sub', {
                  duration: formatDuration(locale, r.months),
                  total: formatMoney(r.totalPaid),
                  amount: formatMoney(input.amount),
                  interest: formatMoney(r.totalInterest),
                })}
              </p>
              <p class="mt-2 text-ink-muted">
                {t(
                  locale,
                  r.crossoverYear !== null && r.crossoverYear > 1 ? 'emi.split' : 'emi.splitShort',
                  {
                    share: formatPercent(Number(r.firstInterestShare.toFixed(3))),
                    years: (r.crossoverYear ?? 1) - 1,
                  },
                )}
              </p>
              {prepaid && (
                <p class="mt-2 font-medium">
                  {t(locale, 'emi.prepay', {
                    amount: formatINR(input.yearlyPrepayment),
                    duration: formatDuration(locale, r.months),
                    saved: formatMoney(prepaid.totalInterest - r.totalInterest),
                  })}
                </p>
              )}
              <p class="mt-2 font-medium">
                {t(locale, 'emi.rateUp', {
                  emi: formatINR(rateUp.emi),
                  diff: formatINR(rateUp.emi - r.emi),
                })}
              </p>
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'emi.exampleNote')}
                  inputsId="emi-inputs-heading"
                />
              )}
              <CompareBars caption={t(locale, 'emi.compare')} items={bars} />
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'emi.floatingNote')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'emi.needInputs')}</p>
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
            tool="emi"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'emi.in.amount'), value: formatMoney(input.amount) },
                    {
                      label: t(locale, 'emi.in.annualRate'),
                      value: formatPercent(input.annualRate),
                    },
                    { label: t(locale, 'emi.in.years'), value: String(input.years) },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <section aria-labelledby="emi-change">
              <h2 id="emi-change" class="font-display text-2xl font-medium">
                {t(locale, 'emi.change.heading')}
              </h2>
              <p class="mt-1 text-sm text-ink-muted">{t(locale, 'emi.change.intro')}</p>
              <ChangeTable
                caption={t(locale, 'emi.change.rateCaption', { years: input.years })}
                head={t(locale, 'emi.change.rate')}
                rows={RATE_STEPS.map((d) => input.annualRate + d)
                  .filter((rate) => rate > 0 && rate <= EMI_LIMITS.annualRate.max)
                  .map((rate) => ({
                    key: String(rate),
                    label: formatPercent(Number(rate.toFixed(4))),
                    current: Math.abs(rate - input.annualRate) < 1e-9,
                    ...emiAt(input.amount, rate, input.years),
                  }))}
                locale={locale}
              />
              <ChangeTable
                caption={t(locale, 'emi.change.tenureCaption', {
                  rate: formatPercent(input.annualRate),
                })}
                head={t(locale, 'emi.change.tenure')}
                rows={[...new Set([...TENURES, input.years])]
                  .sort((a, b) => a - b)
                  .map((years) => ({
                    key: String(years),
                    label: t(locale, 'duration.years', { n: years }),
                    current: years === input.years,
                    ...emiAt(input.amount, input.annualRate, years),
                  }))}
                locale={locale}
              />
            </section>
            <NonMoneyChecklist
              locale={locale}
              items={[1, 2, 3].map((n) => t(locale, `emi.checklist.${n}` as MessageKey))}
            />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="max-w-xl">
                <WorkingBlock title={t(locale, 'emi.w.title')} rows={working} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'emi.chart.heading')}
              hint={t(locale, 'emi.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'emi.chart.title')}
                netWithInterest={balanceByMonth}
                netNoInterest={interestByMonth}
                breakevenWithInterest={null}
                labels={{
                  main: t(locale, 'emi.chart.balance'),
                  secondary: t(locale, 'emi.chart.interest'),
                }}
              />
              <div class="mt-6 max-w-3xl overflow-x-auto">
                <table class="w-full min-w-96 text-left text-sm">
                  <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                  <thead>
                    <tr class="border-b border-line-strong">
                      <th scope="col" class="py-2 pr-3 font-medium">
                        {t(locale, 'plotVs.table.year')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'emi.table.interest')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'emi.table.principal')}
                      </th>
                      {prepaid && (
                        <th scope="col" class="py-2 pr-3 text-right font-medium">
                          {t(locale, 'emi.table.prepayment')}
                        </th>
                      )}
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'emi.table.balance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.years.map((row) => (
                      <tr
                        key={row.year}
                        class={`border-b border-line ${row.year === r.crossoverYear ? 'bg-accent-soft' : ''}`}
                      >
                        <th scope="row" class="py-2 pr-3 font-normal num">
                          {row.year}
                        </th>
                        <td class="py-2 pr-3 text-right num">{formatMoney(row.interest)}</td>
                        <td class="py-2 pr-3 text-right num">{formatMoney(row.principal)}</td>
                        {prepaid && (
                          <td class="py-2 pr-3 text-right num">
                            {row.prepayment > 0 ? formatMoney(row.prepayment) : '–'}
                          </td>
                        )}
                        <td class="py-2 pr-3 text-right font-medium num">
                          {formatMoney(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.crossoverYear !== null && (
                  <p class="mt-2 text-sm text-ink-muted">
                    {t(locale, 'emi.tableNote', { year: r.crossoverYear })}
                  </p>
                )}
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-emi.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'emi.col.emi'),
                    values: r.schedule.rows.map((row) => row.emi),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'emi.table.interest'),
                    values: r.schedule.rows.map((row) => row.interest),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'emi.table.principal'),
                    values: r.schedule.rows.map((row) => row.principal),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'emi.table.prepayment'),
                    values: r.schedule.rows.map((row) => row.prepayment),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'emi.table.balance'),
                    values: r.schedule.rows.map((row) => row.closing),
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

/** EMI and total interest at a few rates or tenures; the visitor's own row in brass. */
function ChangeTable({
  locale,
  caption,
  head,
  rows,
}: {
  locale: Locale;
  caption: string;
  head: string;
  rows: { key: string; label: string; current: boolean; emi: number; totalInterest: number }[];
}) {
  return (
    <table class="mt-4 w-full text-left text-sm">
      <caption class="pb-1.5 text-left text-sm text-ink-muted">{caption}</caption>
      <thead>
        <tr class="border-b border-line-strong">
          <th scope="col" class="py-2 pr-3 font-medium">
            {head}
          </th>
          <th scope="col" class="py-2 pr-3 text-right font-medium">
            {t(locale, 'emi.change.emi')}
          </th>
          <th scope="col" class="py-2 text-right font-medium">
            {t(locale, 'emi.change.interest')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.key}
            class={`border-b border-line ${row.current ? 'font-medium text-accent-strong' : ''}`}
            aria-current={row.current ? 'true' : undefined}
          >
            <th scope="row" class="py-2 pr-3 font-normal num">
              {row.current ? t(locale, 'emi.change.yours', { value: row.label }) : row.label}
            </th>
            <td class="py-2 pr-3 text-right num">{formatINR(row.emi)}</td>
            <td class="py-2 text-right num">{formatMoney(row.totalInterest)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
