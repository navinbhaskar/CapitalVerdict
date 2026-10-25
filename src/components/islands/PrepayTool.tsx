import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { prepayFlips, prepayOrInvest, type PrepayMode, type PrepayVariable } from '@/models/prepay';
import {
  PREPAY_EXAMPLE_FORM,
  PREPAY_EXAMPLE_KEYS,
  PREPAY_LIMITS,
  invalidPrepayFields,
  prepayShareSchema,
  toPrepayInput,
  type PrepayForm,
  type PrepayNumberField,
} from '@/models/prepayForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import EquityTaxNote from '@/components/tool/EquityTaxNote';
import MarketRiskNote from '@/components/tool/MarketRiskNote';
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
  'prepay.checklist.1',
  'prepay.checklist.2',
  'prepay.checklist.3',
  'prepay.checklist.4',
];
/** Returns either side of the visitor's, for "at other returns". */
const RETURN_STEPS = [-0.02, 0, 0.02];
const QUICK: PrepayNumberField[] = [
  'outstanding',
  'yearsLeft',
  'lumpSum',
  'loanRate',
  'investmentReturn',
];

export default function PrepayTool({ locale }: Props) {
  const [form, setForm] = useState<PrepayForm>(PREPAY_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof PrepayForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: PrepayNumberField) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const setMode = (mode: PrepayMode) => {
    pinned.current.add('mode');
    setForm((f) => ({ ...f, mode }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, prepayShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof PrepayForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Global assumptions fill unpinned fields: home-loan rate and inflation.
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      const loanRate =
        !pinned.current.has('loanRate') && assumptions.homeLoanRate !== null
          ? assumptions.homeLoanRate
          : f.loanRate;
      const inflation = !pinned.current.has('inflation') ? assumptions.inflation : f.inflation;
      // Only a real change re-runs the sums.
      return loanRate === f.loanRate && inflation === f.inflation
        ? f
        : { ...f, loanRate, inflation };
    });
  }, [ready, assumptions.homeLoanRate, assumptions.inflation]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), prepayShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toPrepayInput(form), [form]);
  const r = useMemo(() => (input ? prepayOrInvest(input) : null), [input]);
  // The verdict's own line needs only the return flip, so it paints with the answer.
  const keyFlips = useMemo(() => (input ? prepayFlips(input, ['investmentReturn']) : []), [input]);
  // The other sweeps and returns can follow a moment after the answer.
  const extras = useIdleValue(() => {
    if (!input) return null;
    return {
      flips: prepayFlips(input),
      atReturns: RETURN_STEPS.map((step) => input.investmentReturn + step)
        .filter((ret) => ret >= 0)
        .map((ret) => ({
          ret,
          difference: prepayOrInvest({ ...input, investmentReturn: ret }).atEnd.difference,
        })),
    };
  }, [input]);
  const flips = extras?.flips ?? keyFlips;
  const returnFlip = flips.find((f) => f.variable === 'investmentReturn');

  const years = form.yearsLeft ?? 20;
  const missing = invalidPrepayFields(form);
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const prepayWins = r ? r.atEnd.difference >= 0 : false;
  const isExample = PREPAY_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));

  const field = (
    key: PrepayNumberField,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      optional?: boolean;
      layout?: 'row' | 'stack';
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
      example={
        PREPAY_EXAMPLE_KEYS.includes(key) &&
        !pinned.current.has(key) &&
        !(key === 'loanRate' && assumptions.homeLoanRate !== null)
      }
      {...PREPAY_LIMITS[key]}
      {...extra}
      layout={extra.layout ?? 'row'}
    />
  );

  const headline = r
    ? prepayWins
      ? t(locale, 'prepay.verdict.prepay', { amount: formatMoney(r.atEnd.difference), years })
      : t(locale, 'prepay.verdict.invest', { amount: formatMoney(-r.atEnd.difference), years })
    : '';

  const loanRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'prepay.w.emi'),
            formula: t(locale, 'prepay.w.emiFormula', {
              loan: formatINR(input.outstanding),
              rate: formatPercent(input.loanRate),
              years: input.yearsLeft,
            }),
            value: formatINR(r.emi),
          },
          ...(input.lumpSum > 0
            ? [
                {
                  label: t(locale, 'prepay.w.lumpIn'),
                  formula:
                    input.prepaymentCharge > 0
                      ? `${formatINR(input.lumpSum)} ÷ (1 + ${formatPercent(input.prepaymentCharge)})`
                      : undefined,
                  value: formatINR(
                    Math.min(input.lumpSum / (1 + input.prepaymentCharge), input.outstanding),
                  ),
                },
              ]
            : []),
          input.mode === 'reduceEmi'
            ? {
                label: t(locale, 'prepay.w.newEmi'),
                value: formatINR(r.emiAfterLump),
                strong: true,
              }
            : {
                label: t(locale, 'prepay.w.loanEnds'),
                value:
                  r.prepay.paidOffMonth === 0
                    ? t(locale, 'prepay.stat.clearedToday')
                    : formatDuration(locale, r.prepay.paidOffMonth),
                strong: true,
              },
          { label: t(locale, 'prepay.w.interestInvest'), value: formatMoney(r.invest.interest) },
          { label: t(locale, 'prepay.w.interestPrepay'), value: formatMoney(r.prepay.interest) },
          {
            label: t(locale, 'prepay.w.interestSaved'),
            value: formatMoney(r.interestSaved),
            strong: true,
          },
        ]
      : [];

  const monthRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'prepay.w.bothSpend'), value: formatINR(r.emi) },
          input.mode === 'reduceEmi'
            ? {
                label: t(locale, 'prepay.w.prepayMonth'),
                formula: `${formatINR(r.emi)} − ${formatINR(r.emiAfterLump)}`,
                value: formatINR(r.emi - r.emiAfterLump),
              }
            : {
                label: t(locale, 'prepay.w.prepayAfter'),
                formula: t(locale, 'prepay.w.prepayAfterFormula', {
                  time: formatDuration(locale, r.prepay.paidOffMonth),
                }),
                value: formatINR(r.emi),
              },
          {
            label: t(locale, 'prepay.w.investStart'),
            value: formatINR(input.lumpSum),
          },
          ...(input.interestTaxRate > 0
            ? [
                {
                  label: t(locale, 'prepay.w.taxRule'),
                  formula: t(locale, 'prepay.w.taxFormula', {
                    cap: formatINR(input.interestDeductionCap),
                    rate: formatPercent(input.interestTaxRate),
                  }),
                  value: '',
                },
              ]
            : []),
        ]
      : [];

  const endRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'prepay.w.prepayPot'),
            value: formatMoney(r.atEnd.prepay),
            strong: true,
          },
          ...(input.interestTaxRate > 0
            ? [{ label: t(locale, 'prepay.w.taxPrepay'), value: formatMoney(r.prepay.taxSaved) }]
            : []),
          {
            label: t(locale, 'prepay.w.investPot'),
            value: formatMoney(r.atEnd.invest),
            strong: true,
          },
          ...(input.interestTaxRate > 0
            ? [{ label: t(locale, 'prepay.w.taxInvest'), value: formatMoney(r.invest.taxSaved) }]
            : []),
          ...(r.chargesPaid > 0
            ? [{ label: t(locale, 'prepay.w.charges'), value: formatMoney(r.chargesPaid) }]
            : []),
          {
            label: t(locale, 'prepay.w.gap'),
            formula: `${formatMoney(r.atEnd.prepay)} − ${formatMoney(r.atEnd.invest)}`,
            value: formatMoney(r.atEnd.difference),
            strong: true,
          },
        ]
      : [];

  const flipLines: FlipLine[] = input
    ? flips.map((flip) => {
        // Who wins once the input goes above the threshold.
        const winner = flip.signBelow === 1 ? 'invest' : 'prepay';
        return {
          text: t(locale, `prepay.flip.${flip.variable}.${winner}` as MessageKey, {
            years,
            value: formatPercent(flip.threshold),
          }),
          current: formatPercent(input[flip.variable as PrepayVariable]),
        };
      })
    : [];

  const columns: MonthlyColumn[] = r
    ? [
        { label: t(locale, 'prepay.col.loanPrepay'), kind: 'money', values: r.prepay.balance },
        { label: t(locale, 'prepay.col.loanInvest'), kind: 'money', values: r.invest.balance },
        { label: t(locale, 'prepay.col.potPrepay'), kind: 'money', values: r.prepay.investments },
        { label: t(locale, 'prepay.col.potInvest'), kind: 'money', values: r.invest.investments },
        { label: t(locale, 'prepay.col.difference'), kind: 'money', values: r.difference.slice(1) },
      ]
    : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="pp-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="pp-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(PREPAY_EXAMPLE_FORM);
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {field(
              'outstanding',
              'prepay.in.outstanding',
              '₹',
              t(locale, 'prepay.note.outstanding'),
            )}
            {field(
              'yearsLeft',
              'prepay.in.yearsLeft',
              t(locale, 'input.horizonYears.unit'),
              t(locale, 'prepay.note.yearsLeft'),
              { integer: true },
            )}
            {field('lumpSum', 'prepay.in.lumpSum', '₹', t(locale, 'prepay.note.lumpSum'), {
              optional: true,
              slider: { min: 0, max: 20_00_000, step: 25_000 },
            })}
          </Tier>

          <Tier tone="check" title={t(locale, 'tier.check')} hint={t(locale, 'tier.checkHint')}>
            {field(
              'loanRate',
              'prepay.in.loanRate',
              t(locale, 'assumptions.perYear'),
              t(locale, 'prepay.note.loanRate'),
              {
                percent: true,
                flagged: assumptions.homeLoanRate === null && form.loanRate === null,
              },
            )}
            {field(
              'investmentReturn',
              'prepay.in.investmentReturn',
              '%',
              t(locale, 'prepay.note.investmentReturn'),
              { percent: true, flagged: true },
            )}
          </Tier>
          <MarketRiskNote locale={locale} kind="savings" />
          <EquityTaxNote locale={locale} context="afterTax" />

          <div class="mt-4">
            <p class="text-sm font-medium" id="pp-mode">
              {t(locale, 'prepay.mode.label')}
            </p>
            <div
              role="radiogroup"
              aria-labelledby="pp-mode"
              class="mt-2 grid max-w-sm grid-cols-2 gap-1 rounded-md bg-surface p-1"
            >
              {(['reduceTenure', 'reduceEmi'] as const).map((mode) => (
                <label
                  key={mode}
                  class="flex min-h-10 cursor-pointer items-center justify-center rounded-sm px-2 text-center text-sm font-medium text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart has-[:checked]:bg-raised has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-strong"
                >
                  <input
                    type="radio"
                    name="pp-mode"
                    value={mode}
                    checked={form.mode === mode}
                    onChange={() => setMode(mode)}
                    class="sr-only"
                  />
                  {t(locale, `prepay.mode.${mode}` as MessageKey)}
                </label>
              ))}
            </div>
            <p class="mt-1.5 text-sm text-ink-muted">
              {t(locale, `prepay.mode.${form.mode}.note` as MessageKey)}
            </p>
          </div>

          <Refine
            locale={locale}
            storageKey="dw.refine.prepay"
            hint={t(locale, 'prepay.summary', { inflation: formatPercent(form.inflation ?? 0) })}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'prepay.group.more')}>
              {field(
                'yearlyAmount',
                'prepay.in.yearlyAmount',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'prepay.note.yearlyAmount'),
                { optional: true },
              )}
              {field(
                'prepaymentCharge',
                'prepay.in.prepaymentCharge',
                '%',
                t(locale, 'prepay.note.prepaymentCharge'),
                { percent: true, optional: true },
              )}
            </Group>

            <Group title={t(locale, 'prepay.group.tax')}>
              {field(
                'interestTaxRate',
                'prepay.in.interestTaxRate',
                '%',
                t(locale, 'prepay.note.interestTaxRate'),
                { percent: true, optional: true },
              )}
              {field(
                'interestDeductionCap',
                'prepay.in.interestDeductionCap',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'prepay.note.interestDeductionCap'),
                { optional: !((form.interestTaxRate ?? 0) > 0) },
              )}
            </Group>

            <Group title={t(locale, 'prepay.group.economy')}>
              {field('inflation', 'prepay.in.inflation', '%', t(locale, 'prepay.note.inflation'), {
                percent: true,
              })}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="pp-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="pp-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'prepay.verdict.today', {
                  amount: formatMoney(Math.abs(r.atEnd.differenceToday)),
                })}
              </p>
              {returnFlip && (
                <p class="mt-2 font-medium">
                  {t(
                    locale,
                    returnFlip.signBelow === 1
                      ? 'prepay.verdict.flipInvest'
                      : 'prepay.verdict.flipPrepay',
                    { value: formatPercent(returnFlip.threshold) },
                  )}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'prepay.exampleNote')}
                  inputsId="pp-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'compare.invested', { years })}
                items={[
                  {
                    label: t(locale, 'prepay.side.prepay'),
                    value: r.atEnd.prepay,
                    display: formatMoney(r.atEnd.prepay),
                    best: prepayWins,
                  },
                  {
                    label: t(locale, 'prepay.side.invest'),
                    value: r.atEnd.invest,
                    display: formatMoney(r.atEnd.invest),
                    best: !prepayWins,
                  },
                ]}
              />
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'prepay.stat.interestSaved')}>
                  {formatMoney(r.interestSaved)}
                </Stat>
                {input.mode === 'reduceTenure' ? (
                  <Stat label={t(locale, 'prepay.stat.loanEnds')}>
                    {r.prepay.paidOffMonth === 0
                      ? t(locale, 'prepay.stat.clearedToday')
                      : t(locale, 'prepay.stat.earlier', {
                          time: formatDuration(locale, r.monthsSaved),
                        })}
                  </Stat>
                ) : (
                  <Stat label={t(locale, 'prepay.stat.newEmi')}>{formatMoney(r.emiAfterLump)}</Stat>
                )}
                <Stat label={t(locale, 'prepay.stat.breakEvenReturn')}>
                  {returnFlip ? formatPercent(returnFlip.threshold) : '—'}
                </Stat>
                <Stat label={t(locale, 'prepay.stat.emi')}>{formatMoney(r.emi)}</Stat>
              </dl>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'prepay.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'prepay.needInputs')}</p>
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
            tool="prepay"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    {
                      label: t(locale, 'prepay.in.outstanding'),
                      value: formatMoney(input.outstanding),
                    },
                    {
                      label: t(locale, 'prepay.in.loanRate'),
                      value: formatPercent(input.loanRate),
                    },
                    { label: t(locale, 'prepay.in.lumpSum'), value: formatMoney(input.lumpSum) },
                    {
                      label: t(locale, 'prepay.in.investmentReturn'),
                      value: formatPercent(input.investmentReturn),
                    },
                    {
                      label: t(locale, 'prepay.stat.interestSaved'),
                      value: formatMoney(r.interestSaved),
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
                <WorkingBlock title={t(locale, 'prepay.w.loanTitle')} rows={loanRows} />
                <WorkingBlock title={t(locale, 'prepay.w.monthTitle')} rows={monthRows}>
                  {t(locale, 'prepay.w.monthNote')}
                </WorkingBlock>
                <WorkingBlock title={t(locale, 'prepay.w.endTitle', { years })} rows={endRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'detail.chartReturns')}
              hint={t(locale, 'detail.chartReturnsHint')}
            >
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <NetPositionChart
                  locale={locale}
                  title={t(locale, 'prepay.chart.title')}
                  netWithInterest={r.difference}
                  breakevenWithInterest={null}
                  labels={{ main: t(locale, 'prepay.chart.main') }}
                />
                <section aria-labelledby="pp-returns">
                  <h3 id="pp-returns" class="font-display text-xl font-medium">
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
                              ? t(locale, 'prepay.returns.prepay', {
                                  amount: formatMoney(difference),
                                })
                              : t(locale, 'prepay.returns.invest', {
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
                highlight={
                  input.mode === 'reduceTenure' && r.prepay.paidOffMonth > 0
                    ? [r.prepay.paidOffMonth]
                    : []
                }
                csvFilename="capitalverdict-prepay-or-invest.csv"
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
