import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import {
  breakEvenDeductions,
  compareRegimes,
  type Regime,
  type RegimeTax,
} from '@/models/taxRegime';
import {
  TAX_REGIME_EXAMPLE_FORM,
  TAX_REGIME_EXAMPLE_KEYS,
  TAX_REGIME_LIMITS,
  taxRegimeShareSchema,
  toTaxRegimeInput,
  type TaxRegimeForm,
} from '@/models/taxRegimeForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';

interface Props {
  locale: Locale;
}

const CHECKLIST: MessageKey[] = [
  'taxRegime.checklist.1',
  'taxRegime.checklist.2',
  'taxRegime.checklist.3',
];
/** Deduction totals for the "at other deductions" table, ₹. */
const DEDUCTION_STEPS = [0, 1_50_000, 2_50_000, 3_50_000, 5_00_000, 7_50_000];

export default function TaxRegimeTool({ locale }: Props) {
  const [form, setForm] = useState<TaxRegimeForm>(TAX_REGIME_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof TaxRegimeForm>());

  const set = (key: keyof TaxRegimeForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, taxRegimeShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof TaxRegimeForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), taxRegimeShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toTaxRegimeInput(form), [form]);
  const r = useMemo(() => (input ? compareRegimes(input, incomeTax) : null), [input]);
  const breakEven = useMemo(() => (input ? breakEvenDeductions(input, incomeTax) : null), [input]);
  const atDeductions = useMemo(
    () =>
      input
        ? DEDUCTION_STEPS.map((d) => ({
            d,
            result: compareRegimes({ ...input, oldDeductions: d }, incomeTax),
          }))
        : [],
    [input],
  );

  const isExample = TAX_REGIME_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const regimeName = (regime: Regime) => t(locale, `taxRegime.regime.${regime}` as MessageKey);

  const field = (
    key: keyof TaxRegimeForm,
    label: MessageKey,
    note: string,
    extra: { optional?: boolean; slider?: { min: number; max: number; step: number } } = {},
  ) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, label)}
      unit="₹"
      note={note}
      value={form[key]}
      onChange={set(key)}
      example={TAX_REGIME_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...TAX_REGIME_LIMITS[key]}
      {...extra}
      layout="row"
    />
  );

  const headline = r
    ? r.saving < 1
      ? t(locale, 'taxRegime.verdict.same')
      : t(locale, `taxRegime.verdict.better.${r.better}` as MessageKey, {
          amount: formatMoney(r.saving),
        })
    : '';

  const rowsFor = (regime: Regime, tax: RegimeTax): WorkingRow[] =>
    input
      ? [
          {
            label: t(locale, 'taxRegime.w.income'),
            value: formatINR(input.salary + input.otherIncome),
          },
          {
            label: t(locale, 'taxRegime.w.standard'),
            value: `−${formatINR(tax.standardDeduction)}`,
          },
          { label: t(locale, 'taxRegime.w.deductions'), value: `−${formatINR(tax.deductions)}` },
          { label: t(locale, 'taxRegime.w.taxable'), value: formatINR(tax.taxable), strong: true },
          {
            label: t(locale, 'taxRegime.w.slabTax'),
            formula: t(locale, 'taxRegime.w.slabFormula'),
            value: formatINR(tax.slabTax),
          },
          {
            label: t(
              locale,
              regime === 'new' &&
                tax.taxable > incomeTax.regimes.new.rebate.incomeLimit &&
                tax.rebate > 0
                ? 'taxRegime.w.relief'
                : 'taxRegime.w.rebate',
            ),
            value: `−${formatINR(tax.rebate)}`,
          },
          {
            label: t(locale, 'taxRegime.w.cess'),
            formula: `${formatPercent(incomeTax.cessRate)}`,
            value: formatINR(tax.cess),
          },
          { label: t(locale, 'taxRegime.w.total'), value: formatINR(tax.total), strong: true },
        ]
      : [];

  const flipLines: FlipLine[] =
    input && breakEven !== null
      ? [
          {
            text: t(locale, 'taxRegime.flip.deductions', { value: formatMoney(breakEven) }),
            current: formatMoney(input.oldDeductions),
          },
        ]
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="tr-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="tr-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(TAX_REGIME_EXAMPLE_FORM);
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">
            {t(locale, 'taxRegime.scope', { year: incomeTax.taxYear })}
          </p>

          <Group title={t(locale, 'taxRegime.group.income')}>
            {field('salary', 'taxRegime.in.salary', t(locale, 'taxRegime.note.salary'), {
              slider: { min: 3_00_000, max: 50_00_000, step: 50_000 },
            })}
            {field(
              'otherIncome',
              'taxRegime.in.otherIncome',
              t(locale, 'taxRegime.note.otherIncome'),
              {
                optional: true,
              },
            )}
          </Group>
          <Group title={t(locale, 'taxRegime.group.deductions')}>
            {field(
              'oldDeductions',
              'taxRegime.in.oldDeductions',
              t(locale, 'taxRegime.note.oldDeductions'),
              { optional: true },
            )}
            {field(
              'newDeductions',
              'taxRegime.in.newDeductions',
              t(locale, 'taxRegime.note.newDeductions'),
              { optional: true },
            )}
          </Group>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="tr-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="tr-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              {r.saving >= 1 && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'taxRegime.verdict.month', { amount: formatMoney(r.saving / 12) })}
                </p>
              )}
              <p class="mt-2 font-medium">
                {breakEven !== null
                  ? t(locale, 'taxRegime.verdict.breakEven', { value: formatMoney(breakEven) })
                  : t(locale, 'taxRegime.verdict.oldNever')}
              </p>
              {r.beyondScope && (
                <p class="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                  {t(locale, 'taxRegime.beyondScope')}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'taxRegime.exampleNote')}
                  inputsId="tr-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'compare.tax')}
                items={[
                  {
                    label: regimeName('new'),
                    value: r.new.total,
                    display: formatMoney(r.new.total),
                    best: r.better === 'new' && r.saving >= 1,
                  },
                  {
                    label: regimeName('old'),
                    value: r.old.total,
                    display: formatMoney(r.old.total),
                    best: r.better === 'old' && r.saving >= 1,
                  },
                ]}
              />
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'taxRegime.stat.taxableNew')}>
                  {formatMoney(r.new.taxable)}
                </Stat>
                <Stat label={t(locale, 'taxRegime.stat.taxableOld')}>
                  {formatMoney(r.old.taxable)}
                </Stat>
              </dl>
              <p class="mt-3 text-xs text-ink-muted">
                {t(locale, 'taxRegime.stat.note', { year: incomeTax.taxYear })}
              </p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'taxRegime.needInputs')}</p>
            </div>
          )}
          {shareHref && r && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} headline={headline} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="taxRegime"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'taxRegime.in.salary'), value: formatMoney(input.salary) },
                    {
                      label: t(locale, 'taxRegime.in.oldDeductions'),
                      value: formatMoney(input.oldDeductions),
                    },
                    { label: t(locale, 'taxRegime.stat.new'), value: formatMoney(r.new.total) },
                    { label: t(locale, 'taxRegime.stat.old'), value: formatMoney(r.old.total) },
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
              <div class="grid gap-4 lg:grid-cols-2">
                <WorkingBlock title={regimeName('new')} rows={rowsFor('new', r.new)} />
                <WorkingBlock title={regimeName('old')} rows={rowsFor('old', r.old)} />
              </div>
            </MoreDetail>

            <MoreDetail
              title={t(locale, 'taxRegime.table.title')}
              hint={t(locale, 'taxRegime.table.hint')}
            >
              <div class="overflow-x-auto">
                <table class="w-full min-w-80 text-left text-sm">
                  <caption class="sr-only">{t(locale, 'taxRegime.table.title')}</caption>
                  <thead>
                    <tr class="border-b border-line-strong">
                      <th scope="col" class="py-2 pr-3 font-medium">
                        {t(locale, 'taxRegime.table.deductions')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {regimeName('new')}
                      </th>
                      <th scope="col" class="py-2 pr-3 text-right font-medium">
                        {regimeName('old')}
                      </th>
                      <th scope="col" class="py-2 font-medium">
                        {t(locale, 'taxRegime.table.better')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {atDeductions.map(({ d, result }) => (
                      <tr key={d} class="border-b border-line">
                        <th scope="row" class="py-2 pr-3 font-normal num">
                          {formatMoney(d)}
                        </th>
                        <td class="py-2 pr-3 text-right num">{formatMoney(result.new.total)}</td>
                        <td class="py-2 pr-3 text-right num">{formatMoney(result.old.total)}</td>
                        <td class="py-2">
                          {result.saving < 1
                            ? t(locale, 'taxRegime.table.same')
                            : regimeName(result.better)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p class="mt-2 text-sm text-ink-muted">{t(locale, 'taxRegime.table.note')}</p>
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
