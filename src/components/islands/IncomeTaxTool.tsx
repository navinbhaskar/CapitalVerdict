import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatPercent } from '@/lib/formatTool';
import { localizePath } from '@/i18n/routes';
import { incomeTaxCalc } from '@/models/incomeTaxCalc';
import type { Regime } from '@/models/taxRegime';
import {
  INCOME_TAX_EXAMPLE_KEYS,
  INCOME_TAX_LIMITS,
  incomeTaxExampleForm,
  incomeTaxShareSchema,
  invalidIncomeTaxFields,
  toIncomeTaxInput,
  type IncomeTaxForm,
  type IncomeTaxNumberKey,
} from '@/models/incomeTaxForm';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import { Segmented } from '@/components/tool/PlanSteps';

interface Props {
  locale: Locale;
}

const REGIMES: Regime[] = ['new', 'old'];
const CHECKLIST = [1, 2, 3].map((n) => `itax.checklist.${n}` as MessageKey);

/** Income tax for one year under one regime, slab by slab. */
export default function IncomeTaxTool({ locale }: Props) {
  const [form, setForm] = useState<IncomeTaxForm>(incomeTaxExampleForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof IncomeTaxForm>());

  const set =
    <K extends keyof IncomeTaxForm>(key: K) =>
    (value: IncomeTaxForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, incomeTaxShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof IncomeTaxForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), incomeTaxShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toIncomeTaxInput(form), [form]);
  const r = useMemo(() => (input ? incomeTaxCalc(input, incomeTax) : null), [input]);
  const missing = invalidIncomeTaxFields(form);
  const isExample = INCOME_TAX_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const regimeName = (g: Regime) => t(locale, `itax.regime.${g}` as MessageKey);
  /** The regime's name inside a sentence. */
  const regimeIn = (g: Regime) => t(locale, `itax.regimeIn.${g}` as MessageKey);
  const otherRegime: Regime = form.regime === 'new' ? 'old' : 'new';

  const field = (key: IncomeTaxNumberKey) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, `taxRegime.in.${key}` as MessageKey)}
      unit={t(locale, 'itax.unit.year')}
      note={t(locale, `taxRegime.note.${key}` as MessageKey)}
      value={form[key]}
      onChange={(v) => set(key)(v)}
      example={INCOME_TAX_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...INCOME_TAX_LIMITS[key]}
      layout="row"
    />
  );

  const headline = r
    ? r.total > 0
      ? t(locale, 'itax.verdict.tax', { amount: formatINR(r.total), regime: regimeIn(r.regime) })
      : t(locale, 'itax.verdict.nil', { regime: regimeIn(r.regime) })
    : '';

  const working: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'itax.w.income'),
            formula: `${formatINR(input.salary)} + ${formatINR(input.otherIncome)}`,
            value: formatINR(input.salary + input.otherIncome),
          },
          {
            label: t(locale, 'itax.w.taxable'),
            formula: `${formatINR(input.salary + input.otherIncome)} − ${formatINR(r.standardDeduction)} − ${formatINR(r.deductions)}`,
            value: formatINR(r.taxable),
          },
          {
            label: t(locale, 'itax.w.slabTax'),
            formula: t(locale, 'itax.w.slabTaxFormula'),
            value: formatINR(r.slabTax),
          },
          {
            label: t(locale, 'itax.w.rebate'),
            formula: t(locale, 'itax.w.rebateFormula', {
              limit: formatINR(incomeTax.regimes[r.regime].rebate.incomeLimit),
            }),
            value: `− ${formatINR(r.rebate)}`,
          },
          {
            label: t(locale, 'itax.w.cess'),
            formula: `${formatINR(r.slabTax - r.rebate)} × ${formatPercent(incomeTax.cessRate)}`,
            value: formatINR(r.cess),
          },
          {
            label: t(locale, 'itax.w.total'),
            formula: `${formatINR(r.slabTax - r.rebate)} + ${formatINR(r.cess)}`,
            value: formatINR(r.total),
            strong: true,
          },
        ]
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="itax-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="itax-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(incomeTaxExampleForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <Tier
            tone="yours"
            title={t(locale, 'itax.step.income')}
            hint={t(locale, 'itax.step.incomeHint', { year: incomeTax.taxYear })}
          >
            <Segmented
              label={t(locale, 'itax.in.regime')}
              name="itax-regime"
              options={REGIMES.map((g) => ({ value: g, label: regimeName(g) }))}
              value={form.regime}
              onChange={(g) => set('regime')(g)}
            />
            {field('salary')}
            {field('otherIncome')}
            {field(form.regime === 'old' ? 'oldDeductions' : 'newDeductions')}
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="itax-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="itax-verdict-heading"
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
                    ['itax.stat.monthly', formatINR(r.monthly)],
                    ['itax.stat.average', formatPercent(r.averageRate)],
                    ['itax.stat.marginal', formatPercent(r.marginalRate)],
                    ['itax.stat.taxable', formatINR(r.taxable)],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} class="flex items-baseline justify-between gap-4 py-2.5">
                    <dt class="text-ink-muted">{t(locale, key)}</dt>
                    <dd class="font-medium num">{value}</dd>
                  </div>
                ))}
              </dl>
              {r.rebate > 0 && (
                <p class="mt-3 text-sm text-ink-muted">
                  {t(locale, r.total > 0 ? 'itax.relief' : 'itax.rebate', {
                    amount: formatINR(r.rebate),
                    limit: formatINR(incomeTax.regimes[r.regime].rebate.incomeLimit),
                  })}
                </p>
              )}
              <p class="mt-3 text-sm text-ink-muted">
                {t(
                  locale,
                  r.otherTotal < r.total
                    ? 'itax.other.less'
                    : r.otherTotal > r.total
                      ? 'itax.other.more'
                      : 'itax.other.same',
                  {
                    regime: regimeIn(otherRegime),
                    amount: formatINR(r.otherTotal),
                    gap: formatINR(Math.abs(r.otherTotal - r.total)),
                  },
                )}{' '}
                <a
                  href={localizePath('/tools/old-or-new-tax-regime/', locale)}
                  class="font-medium text-accent underline underline-offset-2"
                >
                  {t(locale, 'itax.other.link')}
                </a>
              </p>
              {r.beyondScope && (
                <p class="mt-2 text-sm font-medium">{t(locale, 'taxRegime.beyondScope')}</p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'itax.exampleNote')}
                  inputsId="itax-inputs-heading"
                />
              )}
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'itax.needInputs')}</p>
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

      {r && (
        <>
          <section aria-labelledby="itax-slabs-heading" class="mt-8 border-t border-line pt-5">
            <h2 id="itax-slabs-heading" class="font-display text-xl font-medium">
              {t(locale, 'itax.slabs.heading', { regime: regimeIn(r.regime) })}
            </h2>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full max-w-3xl min-w-80 text-left text-sm">
                <caption class="sr-only">
                  {t(locale, 'itax.slabs.heading', { regime: regimeIn(r.regime) })}
                </caption>
                <thead>
                  <tr class="border-b border-line-strong">
                    <th scope="col" class="py-2 pr-3 font-medium">
                      {t(locale, 'itax.slabs.band')}
                    </th>
                    <th scope="col" class="py-2 pr-3 text-right font-medium">
                      {t(locale, 'itax.slabs.rate')}
                    </th>
                    <th scope="col" class="py-2 pr-3 text-right font-medium">
                      {t(locale, 'itax.slabs.income')}
                    </th>
                    <th scope="col" class="py-2 pr-3 text-right font-medium">
                      {t(locale, 'itax.slabs.tax')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.slabs.map((s) => (
                    <tr
                      key={s.from}
                      class={`border-b border-line ${s.income > 0 ? '' : 'text-ink-muted'}`}
                    >
                      <th scope="row" class="py-2 pr-3 font-normal num">
                        {s.upTo === null
                          ? t(locale, 'itax.slabs.above', { from: formatINR(s.from) })
                          : `${formatINR(s.from)} – ${formatINR(s.upTo)}`}
                      </th>
                      <td class="py-2 pr-3 text-right num">{formatPercent(s.rate)}</td>
                      <td class="py-2 pr-3 text-right num">{formatINR(s.income)}</td>
                      <td class="py-2 pr-3 text-right font-medium num">{formatINR(s.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div class="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <div class="max-w-xl">
              <WorkingBlock title={t(locale, 'itax.w.title')} rows={working} />
            </div>
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>
        </>
      )}
    </div>
  );
}
