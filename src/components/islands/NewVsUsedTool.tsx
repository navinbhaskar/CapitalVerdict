import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { idvDepreciationShare } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { newVsUsed, type CarCost, type CarKind } from '@/models/newVsUsed';
import {
  ENGINE_SIZES,
  NEW_VS_USED_LIMITS,
  USED_AGES,
  invalidNewVsUsedFields,
  newVsUsedShareSchema,
  newVsUsedStartForm,
  resolveNewVsUsed,
  toNewVsUsedInput,
  type NewVsUsedForm,
} from '@/models/newVsUsedForm';
import CompareBars from '@/components/tool/CompareBars';
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

type Field = keyof typeof NEW_VS_USED_LIMITS;
const KINDS: CarKind[] = ['new', 'used'];
const CHECKLIST = [1, 2, 3].map((n) => `nvu.checklist.${n}` as MessageKey);
const PERCENT: Field[] = ['newLoanRate', 'usedLoanRate', 'loanShare', 'investmentReturn'];
const YEARLY: Field[] = ['newInsurance', 'usedInsurance', 'newUpkeep', 'usedUpkeep'];
const WHOLE_YEARS: Field[] = ['years', 'loanYears'];

/** A new car or a used one: the cost of owning each for the same years, counted at the sale. */
export default function NewVsUsedTool({ locale }: Props) {
  const [raw, setRaw] = useState<NewVsUsedForm>(newVsUsedStartForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof NewVsUsedForm>());

  const set =
    <K extends keyof NewVsUsedForm>(key: K) =>
    (value: NewVsUsedForm[K]) => {
      pinned.current.add(key);
      setRaw((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, newVsUsedShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof NewVsUsedForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setRaw((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(raw, pinned.current), newVsUsedShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [raw, ready]);

  // Auto fields follow the others until typed over; recomputed on every change.
  const { form, source } = resolveNewVsUsed(raw, pinned.current);
  const input = useMemo(() => toNewVsUsedInput(form), [JSON.stringify(form)]);
  const r = useMemo(() => (input ? newVsUsed(input) : null), [input]);
  const missing = invalidNewVsUsedFields(form);
  const isExample = Object.values(source).includes('example');
  const loan = form.payment === 'loan';
  const kindName = (k: CarKind) => t(locale, `nvu.car.${k}` as MessageKey);

  /** The note under an auto field says where its value came from. */
  const noteFor = (key: Field): string => {
    if (source[key] !== 'auto') return t(locale, `nvu.note.${key}` as MessageKey);
    const p = form.newPrice ?? 0;
    const ageAtSale = key === 'newSale' ? (form.years ?? 0) : form.usedAge + (form.years ?? 0);
    const age = key === 'usedPrice' ? form.usedAge : ageAtSale;
    const share = idvDepreciationShare(age * 12) ?? 0;
    return t(locale, `nvu.auto.${key}` as MessageKey, {
      price: formatINR(p),
      age,
      share: formatPercent(1 - share),
      cc: t(locale, `nvu.engine.${form.engine}` as MessageKey),
    });
  };

  const field = (key: Field) => (
    <NumberField
      key={key}
      locale={locale}
      name={key}
      label={t(locale, `nvu.in.${key}` as MessageKey)}
      unit={
        PERCENT.includes(key)
          ? '%'
          : WHOLE_YEARS.includes(key)
            ? t(locale, 'input.horizonYears.unit')
            : YEARLY.includes(key)
              ? t(locale, 'nvu.unit.year')
              : '₹'
      }
      note={noteFor(key)}
      value={form[key]}
      onChange={(v) => set(key)(v)}
      example={source[key] === 'example'}
      {...NEW_VS_USED_LIMITS[key]}
      percent={PERCENT.includes(key)}
      integer={WHOLE_YEARS.includes(key)}
      layout="row"
    />
  );

  const years = input?.years ?? 0;
  const headline = r
    ? r.saving < 1
      ? t(locale, 'nvu.verdict.same', { years })
      : t(locale, 'nvu.verdict.cheaper', {
          car: t(locale, `nvu.carIn.${r.better}` as MessageKey),
          amount: formatMoney(r.saving),
          years,
        })
    : '';

  const working = (kind: CarKind, c: CarCost): WorkingRow[] => {
    const side = input![kind];
    return [
      { label: t(locale, 'nvu.w.price'), value: formatINR(side.price) },
      {
        label: t(locale, `nvu.in.${kind}OneOff` as MessageKey),

        value: formatINR(side.oneOff),
      },
      {
        label: t(locale, 'nvu.w.insurance'),
        formula: `${formatINR(side.insurance)} × ${years}`,
        value: formatINR(c.insuranceTotal),
      },
      {
        label: t(locale, 'nvu.w.upkeep'),
        formula: `${formatINR(side.upkeep)} × ${years}`,
        value: formatINR(c.upkeepTotal),
      },
      ...(c.loanAmount > 0
        ? [
            {
              label: t(locale, 'nvu.w.interest'),
              formula: t(locale, 'nvu.w.interestFormula', {
                emi: formatINR(c.emi),
                loan: formatINR(c.loanAmount),
              }),
              value: formatINR(c.interest),
            },
          ]
        : []),
      { label: t(locale, 'nvu.w.sale'), value: `− ${formatINR(side.sale)}` },
      {
        label: t(locale, 'nvu.w.plain'),
        formula: t(locale, 'nvu.w.plainFormula'),
        value: formatINR(c.plainCost),
      },
      {
        label: t(locale, 'nvu.w.forgone'),
        formula: t(locale, 'nvu.w.forgoneFormula', {
          rate: formatPercent(input!.investmentReturn),
        }),
        value: formatINR(c.forgone),
      },
      {
        label: t(locale, 'nvu.w.cost'),
        formula: `${formatINR(c.plainCost)} + ${formatINR(c.forgone)}`,
        value: formatINR(c.cost),
        strong: true,
      },
    ];
  };

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="nvu-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="nvu-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setRaw(newVsUsedStartForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>

          <Tier tone="yours" title={t(locale, 'nvu.step.new')} hint={t(locale, 'nvu.step.newHint')}>
            {field('newPrice')}
            {field('newOneOff')}
            {field('newInsurance')}
            {field('newUpkeep')}
            {field('newSale')}
          </Tier>

          <Tier
            tone="yours"
            title={t(locale, 'nvu.step.used')}
            hint={t(locale, 'nvu.step.usedHint')}
          >
            <Segmented
              label={t(locale, 'nvu.in.usedAge')}
              name="nvu-age"
              options={USED_AGES.map((a) => ({
                value: String(a),
                label: t(locale, 'nvu.ageYears', { years: a }),
              }))}
              value={String(form.usedAge)}
              onChange={(v) => set('usedAge')(Number(v))}
            />
            {field('usedPrice')}
            {field('usedOneOff')}
            {field('usedInsurance')}
            {field('usedUpkeep')}
            {field('usedSale')}
          </Tier>

          <Tier
            tone="check"
            title={t(locale, 'nvu.step.both')}
            hint={t(locale, 'nvu.step.bothHint')}
          >
            {field('years')}
            <Segmented
              label={t(locale, 'nvu.in.engine')}
              name="nvu-engine"
              options={ENGINE_SIZES.map((e) => ({
                value: e,
                label: t(locale, `nvu.engine.${e}` as MessageKey),
              }))}
              value={form.engine}
              onChange={(v) => set('engine')(v)}
            />
            <Segmented
              label={t(locale, 'nvu.in.payment')}
              name="nvu-payment"
              options={(['cash', 'loan'] as const).map((p) => ({
                value: p,
                label: t(locale, `nvu.payment.${p}` as MessageKey),
              }))}
              value={form.payment}
              onChange={(v) => set('payment')(v)}
            />
            {loan && (
              <>
                {field('loanShare')}
                {field('loanYears')}
                {field('newLoanRate')}
                {field('usedLoanRate')}
              </>
            )}
            {field('investmentReturn')}
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="nvu-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="nvu-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'nvu.verdict.sub', {
                  monthly: formatINR(r.saving / r.months),
                  rate: formatPercent(input.investmentReturn),
                })}
              </p>
              <CompareBars
                caption={t(locale, 'nvu.compare', { years })}
                items={KINDS.map((k) => ({
                  label: kindName(k),
                  value: r[k].cost,
                  display: formatMoney(r[k].cost),
                  best: r.better === k,
                  note: t(locale, 'nvu.compareNote', {
                    monthly: formatINR(r[k].cost / r.months),
                  }),
                }))}
              />
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'nvu.idvNote')}</p>
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'nvu.exampleNote')}
                  inputsId="nvu-inputs-heading"
                />
              )}
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'nvu.needInputs')}</p>
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
            <WorkingBlock title={kindName('new')} rows={working('new', r.new)} />
            <WorkingBlock title={kindName('used')} rows={working('used', r.used)} />
          </div>
          <div class="mt-6 max-w-xl">
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail
              defaultOpen
              title={t(locale, 'nvu.chart.heading')}
              hint={t(locale, 'nvu.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'nvu.chart.title')}
                netWithInterest={r.usedAheadByMonth}
                breakevenWithInterest={null}
                labels={{ main: t(locale, 'nvu.chart.line') }}
              />
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-new-or-used-car.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'nvu.col.new'),
                    values: r.new.costByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'nvu.col.used'),
                    values: r.used.costByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'nvu.chart.line'),
                    values: r.usedAheadByMonth.slice(1),
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
