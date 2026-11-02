import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { smallSavings } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { ppfCalc, type PpfFrequency } from '@/models/ppf';
import {
  PPF_EXAMPLE_KEYS,
  PPF_RATE_LIMITS,
  PPF_YEARS,
  invalidPpfFields,
  ppfExampleForm,
  ppfLimits,
  ppfShareSchema,
  toPpfInput,
  withFrequency,
  type PpfForm,
} from '@/models/ppfForm';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import MoreDetail from '@/components/tool/MoreDetail';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable from '@/components/tool/MonthlyTable';
import { Segmented } from '@/components/tool/PlanSteps';

interface Props {
  locale: Locale;
}

const PPF = smallSavings.ppf;
const FREQUENCIES: PpfFrequency[] = ['yearly', 'monthly'];
const CHECKLIST = [1, 2, 3].map((n) => `ppf.checklist.${n}` as MessageKey);

function runningTotal(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/** One PPF account: what it grows to, year by year, with the interest credited each March. */
export default function PpfTool({ locale }: Props) {
  const [form, setForm] = useState<PpfForm>(ppfExampleForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof PpfForm>());

  const set =
    <K extends keyof PpfForm>(key: K) =>
    (value: PpfForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  const setFrequency = (frequency: PpfFrequency) => {
    pinned.current.add('frequency');
    setForm((f) => withFrequency(f, frequency));
  };

  useEffect(() => {
    const { frequency, ...fromUrl } = decodeShare(window.location.search, ppfShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof PpfForm)[]) pinned.current.add(key);
    if (frequency) pinned.current.add('frequency');
    setForm((f) => {
      const next = { ...f, ...fromUrl };
      if (!frequency) return next;
      // A link that names a deposit means it as given; otherwise convert the example deposit.
      return fromUrl.deposit === undefined
        ? withFrequency(next, frequency)
        : { ...next, frequency };
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), ppfShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toPpfInput(form), [form]);
  const r = useMemo(() => (input ? ppfCalc(input, PPF) : null), [input]);
  // The same yearly total paid the other way, to show what paying by 5 April is worth.
  const other = useMemo(() => {
    if (!input || !r) return null;
    const monthly = input.frequency === 'yearly';
    const deposit = monthly ? input.deposit / 12 : input.deposit * 12;
    return ppfCalc({ ...input, frequency: monthly ? 'monthly' : 'yearly', deposit }, PPF);
  }, [input, r]);
  const missing = invalidPpfFields(form);
  const isExample = PPF_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const limits = ppfLimits(form.frequency);

  const headline =
    r && input
      ? t(locale, 'ppf.verdict.headline', { amount: formatMoney(r.maturity), years: input.years })
      : '';

  const yearly = input?.frequency === 'yearly';
  const working: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'ppf.w.yearly'),
            formula: yearly ? formatINR(input.deposit) : `${formatINR(input.deposit)} × 12`,
            value: formatINR(r.yearly),
          },
          {
            label: t(locale, 'ppf.w.firstYear'),
            formula: yearly
              ? `${formatINR(input.deposit)} × ${formatPercent(input.rate)}`
              : `${formatINR(input.deposit)} × 78 × ${formatPercent(input.rate)} ÷ 12`,
            value: formatINR(r.byYear[0]!.interest),
          },
          {
            label: t(locale, 'ppf.w.maturity', { years: input.years }),
            formula: yearly
              ? `${formatINR(input.deposit)} × ((1 + ${formatPercent(input.rate)})^${input.years} − 1) ÷ ${formatPercent(input.rate)} × (1 + ${formatPercent(input.rate)})`
              : t(locale, 'ppf.w.maturityMonthly'),
            value: formatINR(r.maturity),
            strong: true,
          },
          {
            label: t(locale, 'ppf.w.deposited'),
            formula: `${formatINR(r.yearly)} × ${input.years}`,
            value: formatINR(r.deposited),
          },
          {
            label: t(locale, 'ppf.w.interest'),
            formula: `${formatINR(r.maturity)} − ${formatINR(r.deposited)}`,
            value: formatINR(r.interest),
          },
        ]
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="ppf-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ppf-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(ppfExampleForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <Tier
            tone="yours"
            title={t(locale, 'ppf.step.deposit')}
            hint={t(locale, 'ppf.step.depositHint')}
          >
            <Segmented
              label={t(locale, 'ppf.in.frequency')}
              name="ppf-frequency"
              options={FREQUENCIES.map((f) => ({
                value: f,
                label: t(locale, `ppf.frequency.${f}` as MessageKey),
              }))}
              value={form.frequency}
              onChange={setFrequency}
            />
            <NumberField
              locale={locale}
              name="deposit"
              label={t(locale, `ppf.in.deposit.${form.frequency}` as MessageKey)}
              unit={t(locale, `ppf.unit.${form.frequency}` as MessageKey)}
              note={t(locale, `ppf.note.deposit.${form.frequency}` as MessageKey, {
                min: formatINR(limits.min),
                max: formatINR(limits.max),
              })}
              value={form.deposit}
              onChange={(v) => set('deposit')(v)}
              example={!pinned.current.has('deposit')}
              {...limits}
              layout="row"
            />
            <Segmented
              label={t(locale, 'ppf.in.years')}
              name="ppf-years"
              options={PPF_YEARS.map((y) => ({
                value: String(y),
                label: t(locale, 'ppf.years', { years: y }),
              }))}
              value={String(input?.years ?? form.years)}
              onChange={(v) => set('years')(Number(v))}
            />
            <NumberField
              locale={locale}
              name="rate"
              label={t(locale, 'ppf.in.rate')}
              unit="%"
              note={t(locale, 'ppf.note.rate', { rate: formatPercent(PPF.rate) })}
              value={form.rate}
              onChange={(v) => set('rate')(v)}
              {...PPF_RATE_LIMITS}
              percent
              layout="row"
            />
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="ppf-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="ppf-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <dl class="mt-4 divide-y divide-line border-y border-line">
                {(
                  [
                    ['ppf.stat.deposited', r.deposited],
                    ['ppf.stat.interest', r.interest],
                    ['ppf.stat.maturity', r.maturity],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} class="flex items-baseline justify-between gap-4 py-2.5">
                    <dt
                      class={
                        key === 'ppf.stat.maturity' ? 'font-medium text-ink' : 'text-ink-muted'
                      }
                    >
                      {t(locale, key)}
                    </dt>
                    <dd
                      class={`num ${key === 'ppf.stat.maturity' ? 'font-display text-lg font-medium text-accent' : 'font-medium'}`}
                    >
                      {formatINR(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'ppf.taxFree')}</p>
              {other && (
                <p class="mt-2 text-sm text-ink-muted">
                  {input.frequency === 'yearly'
                    ? t(locale, 'ppf.timing.yearly', {
                        monthly: formatINR(r.yearly / 12),
                        gap: formatMoney(r.maturity - other.maturity),
                      })
                    : t(locale, 'ppf.timing.monthly', {
                        yearly: formatINR(r.yearly),
                        gap: formatMoney(other.maturity - r.maturity),
                      })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'ppf.exampleNote')}
                  inputsId="ppf-inputs-heading"
                />
              )}
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'ppf.needInputs')}</p>
              <p class="mt-2 text-sm">{t(locale, 'solar.stillMissing', { n: missing.length })}</p>
            </div>
          )}
          {shareHref && r && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
        </div>
      </div>

      {r && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <div class="max-w-xl">
              <WorkingBlock title={t(locale, 'ppf.w.title')} rows={working} />
            </div>
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail
              defaultOpen
              title={t(locale, 'fund.chart.heading')}
              hint={t(locale, 'ppf.chartHint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'ppf.chart.title')}
                netWithInterest={[0, ...r.monthly.balance]}
                netNoInterest={runningTotal([0, ...r.monthly.deposit])}
                breakevenWithInterest={null}
                labels={{
                  main: t(locale, 'ppf.chart.balance'),
                  secondary: t(locale, 'fund.chart.invested'),
                }}
              />
              <div class="mt-6 overflow-x-auto">
                <table class="w-full max-w-3xl min-w-80 text-left text-sm">
                  <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                  <thead>
                    <tr class="border-b border-line-strong">
                      <th scope="col" class="py-2 pr-3 font-medium">
                        {t(locale, 'plotVs.table.year')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'ppf.table.deposited')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'ppf.table.interest')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {t(locale, 'ppf.table.balance')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.byYear.map((row) => (
                      <tr key={row.year} class="border-b border-line">
                        <th scope="row" class="py-2 pr-3 font-normal num">
                          {row.year}
                        </th>
                        <td class="py-2 pr-3 text-right num">{formatINR(row.deposited)}</td>
                        <td class="py-2 pr-3 text-right num">{formatINR(row.interest)}</td>
                        <td class="py-2 pr-3 text-right font-medium num">
                          {formatINR(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-ppf.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'ppf.table.deposit'),
                    values: r.monthly.deposit,
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'ppf.table.interest'),
                    values: r.monthly.credited,
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'ppf.table.balance'),
                    values: r.monthly.balance,
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
