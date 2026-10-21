import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { carLoanFlips, cashOrLoan, type CarLoanVariable } from '@/models/carLoan';
import {
  CAR_LOAN_EXAMPLE_FORM,
  CAR_LOAN_EXAMPLE_KEYS,
  CAR_LOAN_LIMITS,
  carLoanShareSchema,
  invalidCarLoanFields,
  toCarLoanInput,
  type CarLoanForm,
} from '@/models/carLoanForm';
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

interface Props {
  locale: Locale;
}

const CHECKLIST: MessageKey[] = [
  'carLoan.checklist.1',
  'carLoan.checklist.2',
  'carLoan.checklist.3',
  'carLoan.checklist.4',
];
/** Returns either side of the visitor's, for "at other returns". */
const RETURN_STEPS = [-0.02, 0, 0.02];
const QUICK: (keyof CarLoanForm)[] = ['carPrice', 'loanRate', 'investmentReturn'];

export default function CarLoanTool({ locale }: Props) {
  const [form, setForm] = useState<CarLoanForm>(CAR_LOAN_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof CarLoanForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof CarLoanForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, carLoanShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof CarLoanForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Global assumptions fill unpinned fields: car-loan rate and inflation.
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      const loanRate = !pinned.current.has('loanRate') ? assumptions.carLoanRate : f.loanRate;
      const inflation = !pinned.current.has('inflation') ? assumptions.inflation : f.inflation;
      // Only a real change re-runs the sums.
      return loanRate === f.loanRate && inflation === f.inflation
        ? f
        : { ...f, loanRate, inflation };
    });
  }, [ready, assumptions.carLoanRate, assumptions.inflation]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), carLoanShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toCarLoanInput(form), [form]);
  const r = useMemo(() => (input ? cashOrLoan(input) : null), [input]);
  // The verdict's own line needs only the return flip, so it paints with the answer.
  const keyFlips = useMemo(() => (input ? carLoanFlips(input, ['investmentReturn']) : []), [input]);
  const extras = useIdleValue(() => {
    if (!input) return null;
    return {
      flips: carLoanFlips(input),
      atReturns: RETURN_STEPS.map((step) => input.investmentReturn + step)
        .filter((ret) => ret >= 0)
        .map((ret) => ({
          ret,
          difference: cashOrLoan({ ...input, investmentReturn: ret }).atEnd.difference,
        })),
    };
  }, [input]);
  const flips = extras?.flips ?? keyFlips;
  const returnFlip = flips.find((f) => f.variable === 'investmentReturn');

  const years = form.loanYears ?? 5;
  const missing = invalidCarLoanFields(form);
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const cashWins = r ? r.atEnd.difference >= 0 : false;
  const isExample = CAR_LOAN_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));

  const field = (
    key: keyof CarLoanForm,
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
      example={CAR_LOAN_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...CAR_LOAN_LIMITS[key]}
      {...extra}
      layout="row"
    />
  );

  const headline = r
    ? cashWins
      ? t(locale, 'carLoan.verdict.cash', { amount: formatMoney(r.atEnd.difference), years })
      : t(locale, 'carLoan.verdict.loan', { amount: formatMoney(-r.atEnd.difference), years })
    : '';

  const todayRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'carLoan.w.price'), value: formatINR(input.carPrice) },
          {
            label: t(locale, 'carLoan.w.downPayment'),
            formula: `${formatINR(input.carPrice)} × ${formatPercent(input.downPayment)}`,
            value: formatINR(input.carPrice * input.downPayment),
          },
          { label: t(locale, 'carLoan.w.loan'), value: formatINR(r.loanAmount) },
          { label: t(locale, 'carLoan.w.fee'), value: formatINR(input.processingFee) },
          {
            label: t(locale, 'carLoan.w.loanInvests'),
            formula: `${formatINR(r.loanAmount)} − ${formatINR(input.processingFee)}`,
            value: formatINR(r.loanBuyerStart),
            strong: true,
          },
          { label: t(locale, 'carLoan.w.cashInvests'), value: formatINR(0), strong: true },
        ]
      : [];

  const monthRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'carLoan.w.emi'),
            formula: t(locale, 'carLoan.w.emiFormula', {
              loan: formatINR(r.loanAmount),
              rate: formatPercent(input.loanRate),
              years: input.loanYears,
            }),
            value: formatINR(r.emi),
          },
          { label: t(locale, 'carLoan.w.cashMonth'), value: formatINR(r.emi), strong: true },
          {
            label: t(locale, 'carLoan.w.interest'),
            formula: `${formatINR(r.emi)} × ${r.months} − ${formatINR(r.loanAmount)}`,
            value: formatMoney(r.totalInterest),
          },
        ]
      : [];

  const endRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'carLoan.w.cashPot'),
            value: formatMoney(r.atEnd.cash),
            strong: true,
          },
          {
            label: t(locale, 'carLoan.w.loanPot'),
            formula: `${formatINR(r.loanBuyerStart)} × (1 + ${formatPercent(input.investmentReturn)})^${years}`,
            value: formatMoney(r.atEnd.loan),
            strong: true,
          },
          {
            label: t(locale, 'carLoan.w.gap'),
            formula: `${formatMoney(r.atEnd.cash)} − ${formatMoney(r.atEnd.loan)}`,
            value: formatMoney(r.atEnd.difference),
            strong: true,
          },
        ]
      : [];

  const flipLines: FlipLine[] = input
    ? flips.map((flip) => {
        // Who wins once the input goes above the threshold.
        const winner = flip.signBelow === 1 ? 'loan' : 'cash';
        return {
          text: t(locale, `carLoan.flip.${flip.variable}.${winner}` as MessageKey, {
            value: formatPercent(flip.threshold),
          }),
          current: formatPercent(input[flip.variable as CarLoanVariable]),
        };
      })
    : [];

  const columns: MonthlyColumn[] = r
    ? [
        { label: t(locale, 'carLoan.col.cashPot'), kind: 'money', values: r.cashPot },
        { label: t(locale, 'carLoan.col.loanPot'), kind: 'money', values: r.loanPot },
        {
          label: t(locale, 'carLoan.col.difference'),
          kind: 'money',
          values: r.difference.slice(1),
        },
      ]
    : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="cl-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="cl-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({
                  ...CAR_LOAN_EXAMPLE_FORM,
                  loanRate: assumptions.carLoanRate,
                  inflation: assumptions.inflation,
                });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'inputs.quickLegend')}</p>

          <Group title={t(locale, 'carLoan.group.essentials')}>
            {field('carPrice', 'carLoan.in.carPrice', '₹', t(locale, 'carLoan.note.carPrice'), {
              slider: { min: 3_00_000, max: 40_00_000, step: 25_000 },
            })}
            {field(
              'loanRate',
              'carLoan.in.loanRate',
              t(locale, 'assumptions.perYear'),
              t(locale, 'carLoan.note.loanRate'),
              { percent: true },
            )}
            {field(
              'investmentReturn',
              'carLoan.in.investmentReturn',
              '%',
              t(locale, 'carLoan.note.investmentReturn'),
              { percent: true, flagged: true },
            )}
          </Group>

          <Refine
            locale={locale}
            storageKey="dw.refine.carLoan"
            hint={t(locale, 'carLoan.refineHint')}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'carLoan.group.loan')}>
              {field(
                'downPayment',
                'carLoan.in.downPayment',
                '%',
                t(locale, 'carLoan.note.downPayment'),
                { percent: true },
              )}
              {field(
                'loanYears',
                'carLoan.in.loanYears',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'carLoan.note.loanYears'),
                { integer: true },
              )}
              {field(
                'processingFee',
                'carLoan.in.processingFee',
                '₹',
                t(locale, 'carLoan.note.processingFee'),
                { optional: true },
              )}
            </Group>
            <Group title={t(locale, 'carLoan.group.economy')}>
              {field(
                'inflation',
                'carLoan.in.inflation',
                '%',
                t(locale, 'carLoan.note.inflation'),
                {
                  percent: true,
                },
              )}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="cl-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="cl-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'carLoan.verdict.today', {
                  amount: formatMoney(Math.abs(r.atEnd.differenceToday)),
                })}
              </p>
              {returnFlip && (
                <p class="mt-2 font-medium">
                  {t(locale, 'carLoan.verdict.flip', {
                    value: formatPercent(returnFlip.threshold),
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'carLoan.exampleNote')}
                  inputsId="cl-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'compare.invested', { years })}
                items={[
                  {
                    label: t(locale, 'carLoan.side.cash'),
                    value: r.atEnd.cash,
                    display: formatMoney(r.atEnd.cash),
                    best: cashWins,
                  },
                  {
                    label: t(locale, 'carLoan.side.loan'),
                    value: r.atEnd.loan,
                    display: formatMoney(r.atEnd.loan),
                    best: !cashWins,
                  },
                ]}
              />
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'carLoan.stat.emi')}>{formatMoney(r.emi)}</Stat>
                <Stat label={t(locale, 'carLoan.w.loan')}>{formatMoney(r.loanAmount)}</Stat>
                <Stat label={t(locale, 'carLoan.stat.interest')}>
                  {formatMoney(r.totalInterest)}
                </Stat>
                <Stat label={t(locale, 'carLoan.stat.trueCost')}>
                  {returnFlip ? formatPercent(returnFlip.threshold) : '—'}
                </Stat>
              </dl>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'carLoan.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'carLoan.needInputs')}</p>
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
            tool="carLoan"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'carLoan.in.carPrice'), value: formatMoney(input.carPrice) },
                    {
                      label: t(locale, 'carLoan.in.loanRate'),
                      value: formatPercent(input.loanRate),
                    },
                    {
                      label: t(locale, 'carLoan.in.investmentReturn'),
                      value: formatPercent(input.investmentReturn),
                    },
                    { label: t(locale, 'carLoan.stat.emi'), value: formatMoney(r.emi) },
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
                <WorkingBlock title={t(locale, 'carLoan.w.todayTitle')} rows={todayRows} />
                <WorkingBlock title={t(locale, 'carLoan.w.monthTitle')} rows={monthRows}>
                  {t(locale, 'carLoan.w.monthNote')}
                </WorkingBlock>
                <WorkingBlock title={t(locale, 'carLoan.w.endTitle', { years })} rows={endRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              title={t(locale, 'detail.chartReturns')}
              hint={t(locale, 'detail.chartReturnsHint')}
            >
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <NetPositionChart
                  locale={locale}
                  title={t(locale, 'carLoan.chart.title')}
                  netWithInterest={r.difference}
                  breakevenWithInterest={null}
                  labels={{ main: t(locale, 'carLoan.chart.main') }}
                />
                <section aria-labelledby="cl-returns">
                  <h3 id="cl-returns" class="font-display text-xl font-medium">
                    {t(locale, 'returns.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {extras?.atReturns.map(({ ret, difference }) => (
                      <li key={ret} class="rounded-xl border border-line p-4">
                        <div class="flex items-baseline justify-between gap-3">
                          <span class="font-medium whitespace-nowrap">
                            {t(locale, 'returns.at', { value: formatPercent(ret) })}
                          </span>
                          <span class="text-right font-semibold num">
                            {difference >= 0
                              ? t(locale, 'carLoan.returns.cash', {
                                  amount: formatMoney(difference),
                                })
                              : t(locale, 'carLoan.returns.loan', {
                                  amount: formatMoney(-difference),
                                })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p class="mt-3 text-xs text-ink-muted">{t(locale, 'returns.note')}</p>
                </section>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                columns={columns}
                highlight={[]}
                csvFilename="capitalverdict-cash-or-car-loan.csv"
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
