import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { smallSavings } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { payoutScaleAt, planReturn, type PlanInput, type PlanResult } from '@/models/planReturn';
import {
  INTEGER_KEYS,
  LUMP_SLOTS,
  PLAN_LIMITS,
  applyShape,
  hasPayout,
  invalidPlanFields,
  lumpKeys,
  planExampleForm,
  planShareSchema,
  shapeKeys,
  toPlanInput,
  type PlanForm,
  type PlanNumberKey,
} from '@/models/planReturnForm';
import CompareBars, { type CompareItem } from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import PlanSteps, {
  Group,
  filledSlots,
  withoutSlot,
  type PlanFieldOpts,
} from '@/components/tool/PlanSteps';
import MarketRiskNote from '@/components/tool/MarketRiskNote';
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

const PPF = smallSavings.ppf.rate;
const PERCENT = new Set<PlanNumberKey>([
  'taxRate',
  'inflation',
  'fundReturn',
  'fdRate',
  'fdTaxRate',
]);
const YEARS = new Set<PlanNumberKey>([
  'payYears',
  'incomeYears',
  'incomeStartYear',
  'lump1Year',
  'lump2Year',
  'lump3Year',
  'lump4Year',
]);
const SLIDER: Partial<Record<PlanNumberKey, { min: number; max: number; step: number }>> = {
  payYears: { min: 1, max: 30, step: 1 },
  incomeYears: { min: 1, max: 40, step: 1 },
};
const STEP_KEYS: PlanNumberKey[] = [
  'premium',
  'payYears',
  'income',
  'incomeStartYear',
  'incomeYears',
  ...Array.from({ length: LUMP_SLOTS }, (_, i) => lumpKeys(i + 1)).flat(),
];

/** The return a year, to one decimal: "6.2%". */
const rate1 = (r: number) => `${(r * 100).toFixed(1)}%`.replace('-', '−');

/** A savings plan judged by what goes in and what comes out: its return a year. */
export default function PlanReturnTool({ locale }: Props) {
  const [form, setForm] = useState<PlanForm>(() => planExampleForm());
  // Bumped when the steps are replaced from outside (a shape, reset, a removed lump sum), so the
  // fields remount with the new values, including empty ones.
  const [rev, setRev] = useState(0);
  const [slots, setSlots] = useState(() => Math.max(1, filledSlots(planExampleForm())));
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof PlanForm>());
  const { assumptions } = useGlobalAssumptions();

  const replace = (next: PlanForm) => {
    setForm(next);
    setSlots(Math.max(1, filledSlots(next)));
    setRev((n) => n + 1);
  };

  const set =
    <K extends keyof PlanForm>(key: K) =>
    (value: PlanForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, planShareSchema);
    const keys = Object.keys(fromUrl) as (keyof PlanForm)[];
    if (keys.length > 0) {
      // A shared link describes the whole plan: steps it leaves out are empty, not the example's.
      const steps = keys.some((k) => (STEP_KEYS as string[]).includes(k));
      const base = steps
        ? {
            ...planExampleForm(),
            ...Object.fromEntries(STEP_KEYS.map((k) => [k, null])),
          }
        : planExampleForm();
      for (const key of steps ? [...STEP_KEYS, ...keys] : keys) pinned.current.add(key);
      replace({ ...base, ...fromUrl } as PlanForm);
    }
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
      const query = encodeShare(pickKeys(form, pinned.current), planShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toPlanInput(form), [form]);
  const r = useMemo(() => (input ? planReturn(input) : null), [input]);

  const exampleKeys = shapeKeys(form.shape);
  const isExample = exampleKeys.some((key) => !pinned.current.has(key));
  const invalid = invalidPlanFields(form);
  const refineKeys: PlanNumberKey[] = ['taxRate', 'inflation', 'fundReturn', 'fdRate', 'fdTaxRate'];
  const refineInvalid = invalid.some((key) => refineKeys.includes(key));
  const stepsInvalid = invalid.some((key) => !refineKeys.includes(key));

  const chooseShape = (shape: PlanForm['shape']) => {
    for (const key of STEP_KEYS) pinned.current.delete(key);
    pinned.current.delete('payFrequency');
    pinned.current.delete('incomeFrequency');
    pinned.current.add('shape');
    replace(applyShape(form, shape));
  };

  const removeSlot = (slot: number) => {
    for (let s = slot; s <= LUMP_SLOTS; s++) for (const key of lumpKeys(s)) pinned.current.add(key);
    setForm(withoutSlot(form, slot));
    setSlots((n) => Math.max(1, n - 1));
    setRev((n) => n + 1);
  };

  const field = (key: PlanNumberKey, opts: PlanFieldOpts = {}) => {
    const percent = PERCENT.has(key);
    return (
      <NumberField
        key={`${key}-${rev}`}
        locale={locale}
        name={key}
        label={opts.label ?? t(locale, `plan.in.${key}` as MessageKey)}
        unit={percent ? '%' : YEARS.has(key) ? t(locale, 'input.horizonYears.unit') : '₹'}
        note={opts.note ?? t(locale, `plan.note.${key}` as MessageKey)}
        value={form[key]}
        onChange={(v) => set(key)(v)}
        example={exampleKeys.includes(key) && !pinned.current.has(key)}
        {...PLAN_LIMITS[key]}
        percent={percent}
        integer={INTEGER_KEYS.has(key)}
        optional={opts.optional}
        flagged={opts.flagged}
        slider={SLIDER[key]}
        layout="row"
      />
    );
  };

  const per = (freq: 'monthly' | 'yearly') => t(locale, `plan.per.${freq}` as MessageKey);
  const headline =
    r?.annualReturn != null
      ? t(locale, r.annualReturn < 0 ? 'plan.headlineLoss' : 'plan.headline', {
          rate: rate1(Math.abs(r.annualReturn)),
        })
      : '';

  const scales = useMemo(() => {
    if (!r || !input) return null;
    const fdNet =
      form.fdRate !== null && form.fdTaxRate !== null ? form.fdRate * (1 - form.fdTaxRate) : null;
    return {
      ppf: payoutScaleAt(r, PPF),
      fund: payoutScaleAt(r, input === null ? 0 : (form.fundReturn ?? 0)),
      fd: fdNet === null ? null : payoutScaleAt(r, fdNet),
      fdNet,
    };
  }, [r, input, form.fundReturn, form.fdRate, form.fdTaxRate]);

  // How the return changes if the income runs for fewer or more years (an income for life).
  const byLength = useMemo(() => {
    if (!input || input.income <= 0) return [];
    return [-10, -5, 0, 5, 10]
      .map((d) => input.incomeYears + d)
      .filter((y) => y >= PLAN_LIMITS.incomeYears.min && y <= PLAN_LIMITS.incomeYears.max)
      .map((years) => ({
        years,
        current: years === input.incomeYears,
        rate: planReturn({ ...input, incomeYears: years }).annualReturn,
      }));
  }, [input]);

  const bars: CompareItem[] =
    r && scales
      ? [
          {
            label: t(locale, 'plan.bar.plan'),
            value: r.kept,
            display: formatMoney(r.kept),
            tax: r.tax,
            note:
              r.tax > 0 ? t(locale, 'plan.bar.planNote', { tax: formatMoney(r.tax) }) : undefined,
          },
          ...(scales.ppf !== null
            ? [
                {
                  label: t(locale, 'plan.bar.ppf', { rate: formatPercent(PPF) }),
                  value: r.kept * scales.ppf,
                  display: formatMoney(r.kept * scales.ppf),
                  note: t(locale, 'plan.bar.ppfNote', {
                    max: formatMoney(smallSavings.ppf.maxYearly),
                  }),
                },
              ]
            : []),
          ...(scales.fd !== null && scales.fdNet !== null
            ? [
                {
                  label: t(locale, 'plan.bar.fd', { rate: formatPercent(form.fdRate ?? 0) }),
                  value: r.kept * scales.fd,
                  display: formatMoney(r.kept * scales.fd),
                  note: t(locale, 'plan.bar.fdNote', {
                    tax: formatPercent(form.fdTaxRate ?? 0),
                  }),
                },
              ]
            : []),
          ...(scales.fund !== null
            ? [
                {
                  label: t(locale, 'plan.bar.fund', { rate: formatPercent(form.fundReturn ?? 0) }),
                  value: r.kept * scales.fund,
                  display: formatMoney(r.kept * scales.fund),
                  note: t(locale, 'plan.bar.fundNote'),
                },
              ]
            : []),
        ]
      : [];
  const top = Math.max(...bars.map((b) => b.value));
  for (const b of bars) b.best = b.value === top;

  const lumpTotal = input ? input.lumpSums.reduce((s, l) => s + l.amount, 0) : 0;
  const incomeCount = input && input.income > 0 ? countIncome(input) : 0;
  const working: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'plan.w.paid'),
            formula:
              input.payFrequency === 'once'
                ? t(locale, 'plan.w.paidOnce')
                : t(locale, 'plan.w.paidFormula', {
                    amount: formatINR(input.premium),
                    count: input.payFrequency === 'monthly' ? input.payYears * 12 : input.payYears,
                  }),
            value: formatMoney(r.paid),
          },
          {
            label: t(locale, 'plan.w.received'),
            formula: t(locale, 'plan.w.receivedFormula', {
              income: formatINR(input.income),
              count: incomeCount,
              lumps: formatMoney(lumpTotal),
            }),
            value: formatMoney(r.received),
          },
          {
            label: t(locale, 'plan.w.tax'),
            formula: t(locale, 'plan.w.taxFormula', { rate: formatPercent(input.taxRate) }),
            value: `−${formatMoney(r.tax)}`,
          },
          { label: t(locale, 'plan.w.kept'), value: formatMoney(r.kept) },
          {
            label: t(locale, 'plan.w.return'),
            formula: t(locale, 'plan.w.returnFormula'),
            value: r.annualReturn === null ? '–' : formatPercent(r.annualReturn),
            strong: true,
          },
          {
            label: t(locale, 'plan.w.real'),
            formula: t(locale, 'plan.w.realFormula', { inflation: formatPercent(input.inflation) }),
            value: r.realReturn === null ? '–' : formatPercent(r.realReturn),
          },
        ]
      : [];

  const netByMonth = useMemo(() => {
    if (!r) return [];
    let net = 0;
    return r.flows.map((f) => (net += f));
  }, [r]);

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="plan-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="plan-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                replace({ ...planExampleForm(), inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'plan.scope')}</p>

          <PlanSteps
            locale={locale}
            form={form}
            idPrefix="plan"
            rev={rev}
            slots={slots}
            onShape={chooseShape}
            onPayFrequency={(f) => set('payFrequency')(f)}
            onIncomeFrequency={(f) => set('incomeFrequency')(f)}
            onAddSlot={() => setSlots((n) => n + 1)}
            onRemoveSlot={removeSlot}
            field={field}
          />

          <Refine
            locale={locale}
            storageKey="dw.refine.plan"
            hint={t(locale, 'plan.summary', {
              tax: formatPercent(form.taxRate ?? 0),
              inflation: formatPercent(form.inflation ?? 0),
              fund: formatPercent(form.fundReturn ?? 0),
            })}
            forceOpen={refineInvalid && !stepsInvalid}
          >
            <Group title={t(locale, 'plan.group.compare')}>
              {field('taxRate')}
              {field('inflation')}
              {field('fundReturn', { flagged: true })}
            </Group>
            <Group title={t(locale, 'plan.group.fd')}>
              {field('fdRate', { optional: true })}
              {field('fdTaxRate', { optional: form.fdRate === null })}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input && r.annualReturn !== null ? (
            <section
              id="verdict"
              aria-labelledby="plan-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="plan-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, r.tax > 0 ? 'plan.subTax' : 'plan.sub', {
                  paid: formatMoney(r.paid),
                  received: formatMoney(r.received),
                  tax: formatMoney(r.tax),
                  years: Math.ceil(r.months / 12),
                })}
              </p>
              {scales?.ppf != null && (
                <p class="mt-2 font-medium">
                  {input.income > 0
                    ? t(locale, 'plan.ppfIncome', {
                        rate: formatPercent(PPF),
                        amount: formatINR(input.income * (1 - input.taxRate) * scales.ppf),
                        plan: formatINR(input.income * (1 - input.taxRate)),
                        per: per(input.incomeFrequency),
                      })
                    : t(locale, 'plan.ppfTotal', {
                        rate: formatPercent(PPF),
                        amount: formatMoney(r.kept * scales.ppf),
                        plan: formatMoney(r.kept),
                      })}
                </p>
              )}
              <p class="mt-2 text-ink-muted">
                {t(locale, 'plan.real', {
                  inflation: formatPercent(input.inflation),
                  real: rate1(r.realReturn ?? 0),
                })}
                {r.firstIncomeToday !== null &&
                  r.firstIncomeMonth !== null &&
                  r.firstIncomeMonth > 12 &&
                  ` ${t(locale, 'plan.today', {
                    income: formatINR(input.income * (1 - input.taxRate)),
                    per: per(input.incomeFrequency),
                    year: Math.ceil(r.firstIncomeMonth / 12),
                    today: formatINR(r.firstIncomeToday),
                  })}`}
              </p>
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'plan.exampleNote')}
                  inputsId="plan-inputs-heading"
                />
              )}
              <Timeline locale={locale} input={input} result={r} />
              <CompareBars caption={t(locale, 'plan.compare')} items={bars} />
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'plan.coverNote')}</p>
              <MarketRiskNote locale={locale} kind="savings" />
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, hasPayout(form) ? 'plan.needInputs' : 'plan.needPayout')}</p>
              {invalid.length > 0 && (
                <p class="mt-2 text-sm">{t(locale, 'solar.stillMissing', { n: invalid.length })}</p>
              )}
            </div>
          )}
          {shareHref && r && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="plan-return"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'plan.w.paid'), value: formatMoney(r.paid) },
                    { label: t(locale, 'plan.w.received'), value: formatMoney(r.received) },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            {byLength.length > 0 ? (
              <section aria-labelledby="plan-length">
                <h2 id="plan-length" class="font-display text-2xl font-medium">
                  {t(locale, 'plan.length.heading')}
                </h2>
                <p class="mt-1 text-sm text-ink-muted">{t(locale, 'plan.length.intro')}</p>
                <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
                  {byLength.map((row) => (
                    <li
                      key={row.years}
                      class="flex items-baseline justify-between gap-4 py-2.5"
                      aria-current={row.current ? 'true' : undefined}
                    >
                      <span class={row.current ? 'font-medium text-ink' : 'text-ink-muted'}>
                        {t(locale, row.current ? 'plan.length.current' : 'plan.length.row', {
                          years: row.years,
                        })}
                      </span>
                      <span
                        class={`num ${row.current ? 'font-semibold text-accent-strong' : 'font-medium'}`}
                      >
                        {row.rate === null ? '–' : rate1(row.rate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section aria-labelledby="plan-rates">
                <h2 id="plan-rates" class="font-display text-2xl font-medium">
                  {t(locale, 'plan.rates.heading')}
                </h2>
                <p class="mt-1 text-sm text-ink-muted">{t(locale, 'plan.rates.intro')}</p>
                <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
                  {[0.04, 0.06, PPF, 0.08, 0.1].map((rate) => {
                    const scale = payoutScaleAt(r, rate);
                    return (
                      <li key={rate} class="flex items-baseline justify-between gap-4 py-2.5">
                        <span class="text-ink-muted">
                          {t(locale, 'plan.rates.row', { rate: formatPercent(rate) })}
                        </span>
                        <span class="font-medium num">
                          {scale === null ? '–' : formatMoney(r.kept * scale)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <NonMoneyChecklist
              locale={locale}
              items={[1, 2, 3].map((n) => t(locale, `plan.checklist.${n}` as MessageKey))}
            />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="max-w-xl">
                <WorkingBlock title={t(locale, 'plan.w.title')} rows={working} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'plan.chart.heading')}
              hint={t(locale, 'plan.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'plan.chart.title')}
                netWithInterest={netByMonth}
                breakevenWithInterest={null}
                labels={{ main: t(locale, 'plan.chart.net') }}
              />
              <div class="mt-6 max-w-2xl overflow-x-auto">
                <table class="w-full min-w-80 text-left text-sm">
                  <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                  <thead>
                    <tr class="border-b border-line-strong">
                      <th scope="col" class="py-2 pr-3 font-medium">
                        {t(locale, 'plotVs.table.year')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'plan.table.paid')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'plan.table.received')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'plan.table.net')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.years.map((row) => (
                      <tr
                        key={row.year}
                        class={`border-b border-line ${row.year === r.paybackYear ? 'bg-accent-soft' : ''}`}
                      >
                        <th scope="row" class="py-2 pr-3 font-normal num">
                          {row.year}
                        </th>
                        <td class="py-2 pr-3 text-right num">
                          {row.paid > 0 ? formatMoney(row.paid) : '–'}
                        </td>
                        <td class="py-2 pr-3 text-right num">
                          {row.received > 0 ? formatMoney(row.received) : '–'}
                        </td>
                        <td class="py-2 pr-3 text-right font-medium num">
                          {formatMoney(row.netToDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p class="mt-2 text-sm text-ink-muted">
                  {r.paybackYear === null
                    ? t(locale, 'plan.tableNoPayback')
                    : t(locale, 'plan.tableNote', { year: r.paybackYear })}
                </p>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-plan-return.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'plan.col.paid'),
                    values: r.paidByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'plan.col.kept'),
                    values: r.keptByMonth.slice(1),
                    kind: 'money',
                  },
                  { label: t(locale, 'plan.col.net'), values: netByMonth.slice(1), kind: 'money' },
                ]}
              />
              <p class="mt-2 text-sm text-ink-muted">{t(locale, 'plan.monthNote')}</p>
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}

function countIncome(input: PlanInput): number {
  return input.incomeFrequency === 'monthly' ? input.incomeYears * 12 : input.incomeYears;
}

/** Two bars across the years: when premiums are paid, and when the plan pays out. */
function Timeline({
  locale,
  input,
  result,
}: {
  locale: Locale;
  input: PlanInput;
  result: PlanResult;
}) {
  const total = Math.max(1, Math.ceil(result.months / 12));
  const pct = (years: number) => `${Math.min(100, (years / total) * 100)}%`;
  const payYears = input.payFrequency === 'once' ? 0 : input.payYears;
  const incomeStart = input.incomeStartYear - 1;
  const lumps = input.lumpSums.filter((l) => l.amount > 0);
  const track = 'relative h-3 rounded-full bg-line';
  return (
    <figure class="mt-4 border-t border-line pt-4">
      <figcaption class="text-sm text-ink-muted">{t(locale, 'plan.timeline.title')}</figcaption>
      <div class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm">
        <span class="text-ink-muted">{t(locale, 'plan.timeline.pay')}</span>
        <div class={track} aria-hidden="true">
          {payYears > 0 ? (
            <span
              class="absolute inset-y-0 left-0 rounded-full bg-ink-muted"
              style={{ width: pct(payYears) }}
            />
          ) : (
            <span class="absolute inset-y-0 left-0 w-1.5 rounded-full bg-ink-muted" />
          )}
        </div>
        <span class="text-ink-muted">{t(locale, 'plan.timeline.get')}</span>
        <div class={track} aria-hidden="true">
          {input.income > 0 && (
            <span
              class="absolute inset-y-0 rounded-full bg-accent"
              style={{ left: pct(incomeStart), width: pct(input.incomeYears) }}
            />
          )}
          {lumps.map((l) => (
            <span
              key={`${l.year}-${l.amount}`}
              class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-surface"
              style={{ left: pct(l.year) }}
            />
          ))}
        </div>
        <span />
        <div class="flex justify-between text-xs text-ink-muted num">
          <span>{t(locale, 'plan.timeline.today')}</span>
          <span>{t(locale, 'plan.timeline.year', { n: total })}</span>
        </div>
      </div>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {input.income > 0 && (
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2 w-4 rounded-full bg-accent" aria-hidden="true" />
            {t(locale, 'plan.timeline.income')}
          </span>
        )}
        {lumps.length > 0 && (
          <span class="inline-flex items-center gap-1.5">
            <span
              class="size-3 rounded-full border-2 border-accent bg-surface"
              aria-hidden="true"
            />
            {t(locale, 'plan.timeline.lump')}
          </span>
        )}
      </p>
    </figure>
  );
}
