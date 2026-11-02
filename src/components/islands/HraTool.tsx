import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { incomeTax } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatPercent } from '@/lib/formatTool';
import { hraCalc, type HraLimit } from '@/models/hra';
import {
  HRA_CITIES,
  HRA_EXAMPLE_KEYS,
  HRA_LIMITS,
  SLAB_RATES,
  hraExampleForm,
  hraShareSchema,
  invalidHraFields,
  toHraInput,
  type HraForm,
  type HraNumberKey,
} from '@/models/hraForm';
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

const LIMIT_ORDER: HraLimit[] = ['received', 'rent', 'salaryShare'];
const CHECKLIST = [1, 2, 3].map((n) => `hra.checklist.${n}` as MessageKey);

/** HRA exemption under the old regime: the least of three amounts, shown side by side. */
export default function HraTool({ locale }: Props) {
  const [form, setForm] = useState<HraForm>(hraExampleForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof HraForm>());

  const set =
    <K extends keyof HraForm>(key: K) =>
    (value: HraForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, hraShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof HraForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), hraShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toHraInput(form), [form]);
  const r = useMemo(() => (input ? hraCalc(input, incomeTax) : null), [input]);
  const missing = invalidHraFields(form);
  const isExample = HRA_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const cityName = (id: string) =>
    id === 'other' ? t(locale, 'hra.city.other') : t(locale, `city.${id}` as MessageKey);

  const field = (
    key: HraNumberKey,
    extra: { slider?: { min: number; max: number; step: number } } = {},
  ) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, `hra.in.${key}` as MessageKey)}
      unit={key === 'months' ? t(locale, 'hra.unit.months') : t(locale, 'hra.unit.perMonth')}
      note={t(locale, `hra.note.${key}` as MessageKey)}
      value={form[key]}
      onChange={(v) => set(key)(v)}
      example={HRA_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...HRA_LIMITS[key]}
      integer={key === 'months'}
      slider={extra.slider}
      layout="row"
    />
  );

  const headline = r
    ? r.exempt > 0
      ? t(locale, 'hra.verdict.exempt', { amount: formatINR(r.exempt) })
      : t(locale, 'hra.verdict.none')
    : '';

  const working: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'hra.w.salary'),
            formula: `${formatINR(input.basicPlusDa)} × ${input.months}`,
            value: formatINR(r.salary),
          },
          {
            label: t(locale, 'hra.limit.received'),
            formula: `${formatINR(input.hraReceived)} × ${input.months}`,
            value: formatINR(r.limits.received),
          },
          {
            label: t(locale, 'hra.limit.rent'),
            formula: `${formatINR(r.rent)} − 10% × ${formatINR(r.salary)}`,
            value: formatINR(r.limits.rent),
          },
          {
            label: t(locale, 'hra.limit.salaryShare', { share: formatPercent(r.salaryShare) }),
            formula: `${formatPercent(r.salaryShare)} × ${formatINR(r.salary)}`,
            value: formatINR(r.limits.salaryShare),
          },
          {
            label: t(locale, 'hra.w.exempt'),
            formula: t(locale, 'hra.w.exemptFormula'),
            value: formatINR(r.exempt),
            strong: true,
          },
          {
            label: t(locale, 'hra.w.taxable'),
            formula: `${formatINR(r.received)} − ${formatINR(r.exempt)}`,
            value: formatINR(r.taxable),
          },
          {
            label: t(locale, 'hra.w.taxSaved'),
            formula: `${formatINR(r.exempt)} × ${formatPercent(input.slabRate)} × ${1 + incomeTax.cessRate}`,
            value: formatINR(r.taxSaved),
          },
        ]
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="hra-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="hra-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(hraExampleForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <Tier tone="yours" title={t(locale, 'hra.step.pay')} hint={t(locale, 'hra.step.payHint')}>
            {field('basicPlusDa')}
            {field('hraReceived')}
            {field('rentPaid')}
            {field('months', { slider: { min: 1, max: 12, step: 1 } })}
            <div class="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
              <div>
                <label for="hra-city" class="block text-sm font-medium">
                  {t(locale, 'hra.in.city')}
                </label>
                <p id="hra-city-note" class="mt-0.5 text-sm text-ink-muted">
                  {t(locale, 'hra.note.city')}
                </p>
              </div>
              <select
                id="hra-city"
                aria-describedby="hra-city-note"
                value={form.city}
                onChange={(e) => set('city')(e.currentTarget.value)}
                class="min-h-11 w-full rounded-lg border border-line-strong bg-page px-3 text-base text-ink transition-colors duration-(--duration-fast) ease-out-quart hover:border-ink-subtle focus:border-accent-strong"
              >
                {HRA_CITIES.map((id) => (
                  <option key={id} value={id}>
                    {cityName(id)}
                  </option>
                ))}
              </select>
            </div>
            <Segmented
              label={t(locale, 'hra.in.slabRate')}
              name="hra-slab"
              options={SLAB_RATES.map((rate) => ({
                value: String(rate),
                label: formatPercent(rate),
              }))}
              value={String(form.slabRate)}
              onChange={(v) => set('slabRate')(Number(v))}
            />
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="hra-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="hra-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'hra.verdict.sub', {
                  taxable: formatINR(r.taxable),
                  rate: formatPercent(input.slabRate),
                  saved: formatINR(r.taxSaved),
                })}
              </p>
              <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
                {LIMIT_ORDER.map((limit) => (
                  <li
                    key={limit}
                    class="flex items-baseline justify-between gap-4 py-2.5"
                    aria-current={limit === r.binding ? 'true' : undefined}
                  >
                    <span class={limit === r.binding ? 'font-medium text-ink' : 'text-ink-muted'}>
                      {t(locale, `hra.limit.${limit}` as MessageKey, {
                        share: formatPercent(r.salaryShare),
                      })}
                      {limit === r.binding && (
                        <span class="mt-0.5 block text-xs text-accent">
                          {t(locale, 'hra.least')}
                        </span>
                      )}
                    </span>
                    <span
                      class={`num ${limit === r.binding ? 'font-display text-lg font-medium text-accent' : 'font-medium'}`}
                    >
                      {formatINR(r.limits[limit])}
                    </span>
                  </li>
                ))}
              </ul>
              <p class="mt-3 text-sm text-ink-muted">
                {t(locale, 'hra.verdict.why', {
                  city: cityName(form.city),
                  share: formatPercent(r.salaryShare),
                })}
              </p>
              <p class="mt-2 text-sm text-ink-muted">{t(locale, 'hra.newRegime')}</p>
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'hra.exampleNote')}
                  inputsId="hra-inputs-heading"
                />
              )}
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'hra.needInputs')}</p>
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
        <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
          <div class="max-w-xl">
            <WorkingBlock title={t(locale, 'hra.w.title')} rows={working} />
          </div>
          <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
        </div>
      )}
    </div>
  );
}
