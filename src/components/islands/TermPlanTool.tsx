import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { smallSavings } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { planReturn } from '@/models/planReturn';
import { LUMP_SLOTS, hasPayout, lumpKeys, type PlanNumberKey } from '@/models/planReturnForm';
import { termVsPlan } from '@/models/termVsPlan';
import {
  TERM_INTEGER_KEYS,
  TERM_LIMITS,
  applyTermShape,
  invalidTermFields,
  termExampleForm,
  termShapeKeys,
  termShareSchema,
  toTermInput,
  type TermForm,
  type TermNumberKey,
} from '@/models/termVsPlanForm';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
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
import PlanSteps, {
  Group,
  filledSlots,
  withoutSlot,
  type PlanFieldOpts,
} from '@/components/tool/PlanSteps';

interface Props {
  locale: Locale;
}

const PPF = smallSavings.ppf.rate;
const PERCENT = new Set<TermNumberKey>(['taxRate', 'inflation', 'investReturn']);
const YEARS = new Set<TermNumberKey>([
  'payYears',
  'incomeYears',
  'incomeStartYear',
  'lump1Year',
  'lump2Year',
  'lump3Year',
  'lump4Year',
  'coverYears',
]);
const SLIDER: Partial<Record<TermNumberKey, { min: number; max: number; step: number }>> = {
  payYears: { min: 1, max: 30, step: 1 },
  incomeYears: { min: 1, max: 40, step: 1 },
  coverYears: { min: 5, max: 40, step: 1 },
};
const STEP_KEYS: TermNumberKey[] = [
  'premium',
  'payYears',
  'income',
  'incomeStartYear',
  'incomeYears',
  ...(Array.from({ length: LUMP_SLOTS }, (_, i) => lumpKeys(i + 1)).flat() as TermNumberKey[]),
];
/** Returns to try the comparison at, besides the visitor's own. */
const RATES = [0.04, 0.06, PPF, 0.08, 0.1];

/** "6.2%" to one decimal. */
const rate1 = (r: number) => `${(r * 100).toFixed(1)}%`.replace('-', '−');

/** A plan with life cover against a term plan for the same cover plus investing the rest. */
export default function TermPlanTool({ locale }: Props) {
  const [form, setForm] = useState<TermForm>(() => termExampleForm());
  const [rev, setRev] = useState(0);
  const [slots, setSlots] = useState(() => Math.max(1, filledSlots(termExampleForm())));
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof TermForm>());
  const { assumptions } = useGlobalAssumptions();

  const replace = (next: TermForm) => {
    setForm(next);
    setSlots(Math.max(1, filledSlots(next)));
    setRev((n) => n + 1);
  };

  const set =
    <K extends keyof TermForm>(key: K) =>
    (value: TermForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, termShareSchema);
    const keys = Object.keys(fromUrl) as (keyof TermForm)[];
    if (keys.length > 0) {
      // A shared link describes the whole plan: steps it leaves out are empty, not the example's.
      const steps = keys.some((k) => (STEP_KEYS as string[]).includes(k));
      const base = steps
        ? { ...termExampleForm(), ...Object.fromEntries(STEP_KEYS.map((k) => [k, null])) }
        : termExampleForm();
      for (const key of steps ? [...STEP_KEYS, ...keys] : keys) pinned.current.add(key);
      replace({ ...base, ...fromUrl } as TermForm);
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
      const query = encodeShare(pickKeys(form, pinned.current), termShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toTermInput(form), [form]);
  const plan = useMemo(() => (input ? planReturn(input.plan) : null), [input]);
  const r = useMemo(
    () =>
      input && plan
        ? termVsPlan({
            plan,
            coverYears: input.coverYears,
            termPremium: input.termPremium,
            investReturn: input.investReturn,
            inflation: input.plan.inflation,
          })
        : null,
    [input, plan],
  );

  const exampleKeys = termShapeKeys(form.shape);
  const isExample = exampleKeys.some((key) => !pinned.current.has(key));
  const invalid = invalidTermFields(form);
  const refineKeys: TermNumberKey[] = ['taxRate', 'inflation'];
  const refineInvalid = invalid.some((key) => refineKeys.includes(key));
  const stepsInvalid = invalid.some((key) => !refineKeys.includes(key));

  const chooseShape = (shape: TermForm['shape']) => {
    for (const key of [...STEP_KEYS, 'cover', 'coverYears'] as const) pinned.current.delete(key);
    pinned.current.delete('payFrequency');
    pinned.current.delete('incomeFrequency');
    pinned.current.add('shape');
    replace(applyTermShape(form, shape));
  };

  const removeSlot = (slot: number) => {
    for (let s = slot; s <= LUMP_SLOTS; s++) for (const key of lumpKeys(s)) pinned.current.add(key);
    setForm(withoutSlot(form, slot));
    setSlots((n) => Math.max(1, n - 1));
    setRev((n) => n + 1);
  };

  const field = (key: TermNumberKey, opts: PlanFieldOpts = {}) => {
    const percent = PERCENT.has(key);
    const own = key in OWN_PREFIX;
    return (
      <NumberField
        key={`${key}-${rev}`}
        locale={locale}
        name={key}
        label={opts.label ?? t(locale, `${own ? 'term' : 'plan'}.in.${key}` as MessageKey)}
        unit={percent ? '%' : YEARS.has(key) ? t(locale, 'input.horizonYears.unit') : '₹'}
        note={opts.note ?? t(locale, `${own ? 'term' : 'plan'}.note.${key}` as MessageKey)}
        value={form[key]}
        onChange={(v) => set(key)(v)}
        example={exampleKeys.includes(key) && !pinned.current.has(key)}
        {...TERM_LIMITS[key]}
        percent={percent}
        integer={TERM_INTEGER_KEYS.has(key)}
        optional={opts.optional}
        flagged={opts.flagged}
        slider={SLIDER[key]}
        layout="row"
      />
    );
  };

  const coverYears = input?.coverYears ?? 0;
  const termPremium = input?.termPremium ?? null;
  const investReturn = input?.investReturn ?? 0;
  const ahead = r ? r.leftover >= 0 : false;

  let headline = '';
  if (r && input) {
    if (termPremium === null) {
      headline =
        r.maxTermPremium === null
          ? t(locale, 'term.headline.planAlways', { rate: formatPercent(investReturn) })
          : t(locale, 'term.headline.max', { amount: formatINR(r.maxTermPremium) });
    } else {
      headline = t(locale, ahead ? 'term.headline.termWins' : 'term.headline.planWins', {
        amount: formatMoney(Math.abs(r.leftover)),
      });
    }
  }

  // The comparison at a few other returns, with the visitor's term premium if there is one.
  const byRate = useMemo(() => {
    if (!input || !plan) return [];
    const rates = [...new Set([...RATES, input.investReturn])].sort((a, b) => a - b);
    return rates.map((rate) => {
      const x = termVsPlan({
        plan,
        coverYears: input.coverYears,
        termPremium: input.termPremium,
        investReturn: rate,
        inflation: input.plan.inflation,
      });
      return {
        rate,
        current: rate === input.investReturn,
        value: input.termPremium === null ? x.maxTermPremium : x.leftover,
      };
    });
  }, [input, plan]);

  const working: WorkingRow[] =
    r && plan && input
      ? [
          { label: t(locale, 'term.w.paid'), value: formatMoney(plan.paid) },
          {
            label: t(locale, 'term.w.term'),
            formula:
              termPremium === null
                ? t(locale, 'term.w.termNone')
                : t(locale, 'term.w.termFormula', {
                    amount: formatINR(termPremium),
                    years: coverYears,
                  }),
            value: `−${formatMoney(r.termPaid)}`,
          },
          {
            label: t(locale, 'term.w.kept'),
            formula: t(locale, 'term.w.keptFormula', { rate: formatPercent(input.plan.taxRate) }),
            value: `−${formatMoney(plan.kept)}`,
          },
          {
            label: t(locale, 'term.w.growth'),
            formula: t(locale, 'term.w.growthFormula', { rate: formatPercent(investReturn) }),
            value: formatMoney(r.leftover - plan.paid + r.termPaid + plan.kept),
          },
          {
            label: t(locale, 'term.w.leftover'),
            formula: t(locale, 'term.w.leftoverFormula'),
            value: formatMoney(r.leftover),
            strong: true,
          },
          ...(r.maxTermPremium !== null
            ? [
                {
                  label: t(locale, 'term.w.max'),
                  formula: t(locale, 'term.w.maxFormula'),
                  value: formatMoney(r.maxTermPremium),
                },
              ]
            : []),
          {
            label: t(locale, 'term.w.tie'),
            formula: t(locale, 'term.w.tieFormula'),
            value: r.breakEvenReturn === null ? '–' : formatPercent(r.breakEvenReturn),
          },
        ]
      : [];

  const shortBeforeEnd = r && r.shortMonth !== null && r.shortMonth < r.months;

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="term-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="term-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                replace({ ...termExampleForm(), inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'term.scope')}</p>

          <PlanSteps
            locale={locale}
            form={form}
            idPrefix="term"
            rev={rev}
            slots={slots}
            onShape={chooseShape}
            onPayFrequency={(f) => set('payFrequency')(f)}
            onIncomeFrequency={(f) => set('incomeFrequency')(f)}
            onAddSlot={() => setSlots((n) => n + 1)}
            onRemoveSlot={removeSlot}
            field={(key: PlanNumberKey, opts) => field(key as TermNumberKey, opts)}
          />

          <Tier
            tone="yours"
            title={t(locale, 'term.step.cover')}
            hint={t(locale, 'term.step.coverHint')}
          >
            {field('cover')}
            {field('coverYears')}
            {field('termPremium', { optional: true })}
            {field('investReturn', {
              flagged: true,
              note: t(locale, 'term.note.investReturn', {
                rate: formatPercent(PPF),
                max: formatMoney(smallSavings.ppf.maxYearly),
              }),
            })}
          </Tier>

          <Refine
            locale={locale}
            storageKey="dw.refine.term"
            hint={t(locale, 'term.summary', {
              tax: formatPercent(form.taxRate ?? 0),
              inflation: formatPercent(form.inflation ?? 0),
            })}
            forceOpen={refineInvalid && !stepsInvalid}
          >
            <Group title={t(locale, 'term.group.plan')}>
              {field('taxRate')}
              {field('inflation')}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && plan && input ? (
            <section
              id="verdict"
              aria-labelledby="term-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="term-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'term.sub', {
                  paid: formatMoney(plan.paid),
                  kept: formatMoney(plan.kept),
                  cover: formatMoney(input.cover),
                  years: coverYears,
                  rate: formatPercent(investReturn),
                })}
              </p>
              {termPremium === null ? (
                <p class="mt-2 font-medium">{t(locale, 'term.getQuote')}</p>
              ) : (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'term.today', {
                    amount: formatMoney(Math.abs(r.leftoverToday)),
                    inflation: formatPercent(input.plan.inflation),
                  })}
                </p>
              )}
              {r.breakEvenReturn !== null && (
                <p class={`mt-2 ${termPremium === null ? 'text-ink-muted' : 'font-medium'}`}>
                  {t(locale, termPremium === null ? 'term.tiePlan' : 'term.tie', {
                    rate: rate1(r.breakEvenReturn),
                  })}
                </p>
              )}
              {shortBeforeEnd && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'term.short', { year: Math.max(1, Math.ceil(r.shortMonth! / 12)) })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'term.exampleNote')}
                  inputsId="term-inputs-heading"
                />
              )}
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'term.coverNote')}</p>
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
            tool="term-plan"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && plan
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'term.w.paid'), value: formatMoney(plan.paid) },
                    {
                      label: t(locale, 'term.in.termPremium'),
                      value: termPremium === null ? '–' : formatMoney(termPremium),
                    },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && plan && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <section aria-labelledby="term-rates">
              <h2 id="term-rates" class="font-display text-2xl font-medium">
                {t(locale, 'term.rates.heading')}
              </h2>
              <p class="mt-1 text-sm text-ink-muted">
                {t(locale, termPremium === null ? 'term.rates.introMax' : 'term.rates.intro')}
              </p>
              <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
                {byRate.map((row) => (
                  <li
                    key={row.rate}
                    class="flex items-baseline justify-between gap-4 py-2.5"
                    aria-current={row.current ? 'true' : undefined}
                  >
                    <span class={row.current ? 'font-medium text-ink' : 'text-ink-muted'}>
                      {t(locale, row.current ? 'term.rates.current' : 'term.rates.row', {
                        rate: formatPercent(row.rate),
                      })}
                    </span>
                    <span
                      class={`num ${row.current ? 'font-semibold text-accent-strong' : 'font-medium'}`}
                    >
                      {rateValue(locale, row.value, termPremium === null)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <NonMoneyChecklist
              locale={locale}
              items={[1, 2, 3, 4].map((n) => t(locale, `term.checklist.${n}` as MessageKey))}
            />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="max-w-xl">
                <WorkingBlock title={t(locale, 'term.w.title')} rows={working} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'term.chart.heading')}
              hint={t(locale, 'term.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'term.chart.title')}
                netWithInterest={r.balanceByMonth}
                breakevenWithInterest={null}
                labels={{ main: t(locale, 'term.chart.balance') }}
              />
              <div class="mt-6 max-w-2xl overflow-x-auto">
                <table class="w-full min-w-96 text-left text-sm">
                  <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                  <thead>
                    <tr class="border-b border-line-strong">
                      <th scope="col" class="py-2 pr-3 font-medium">
                        {t(locale, 'plotVs.table.year')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'term.table.in')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'term.table.term')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'term.table.out')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'term.table.balance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.years.map((row) => (
                      <tr key={row.year} class="border-b border-line">
                        <th scope="row" class="py-2 pr-3 font-normal num">
                          {row.year}
                        </th>
                        <td class="py-2 pr-3 text-right num">
                          {row.invested > 0 ? formatMoney(row.invested) : '–'}
                        </td>
                        <td class="py-2 pr-3 text-right num">
                          {row.term > 0 ? formatMoney(row.term) : '–'}
                        </td>
                        <td class="py-2 pr-3 text-right num">
                          {row.taken > 0 ? formatMoney(row.taken) : '–'}
                        </td>
                        <td class="py-2 pr-3 text-right font-medium num">
                          {formatMoney(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p class="mt-2 text-sm text-ink-muted">{t(locale, 'term.tableNote')}</p>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-term-plus-investing.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'term.col.in'),
                    values: padTo(plan.paidByMonth, r.months).slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'term.col.term'),
                    values: r.termByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'term.col.out'),
                    values: padTo(plan.keptByMonth, r.months).slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'term.col.balance'),
                    values: r.balanceByMonth.slice(1),
                    kind: 'money',
                  },
                ]}
              />
              <p class="mt-2 text-sm text-ink-muted">{t(locale, 'term.monthNote')}</p>
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}

/** Fields whose label and note live under `term.` rather than the plan calculator's `plan.`. */
const OWN_PREFIX: Partial<Record<TermNumberKey, true>> = {
  cover: true,
  coverYears: true,
  termPremium: true,
  investReturn: true,
};

/** A month-by-month series stretched to the comparison's length with zeros. */
function padTo(values: number[], months: number): number[] {
  return Array.from({ length: months + 1 }, (_, i) => values[i] ?? 0);
}

function rateValue(locale: Locale, value: number | null, isMax: boolean): string {
  if (value === null) return t(locale, 'term.rates.none');
  if (isMax) return t(locale, 'term.rates.perYear', { amount: formatMoney(value) });
  return value >= 0
    ? t(locale, 'term.rates.ahead', { amount: formatMoney(value) })
    : t(locale, 'term.rates.behind', { amount: formatMoney(-value) });
}
