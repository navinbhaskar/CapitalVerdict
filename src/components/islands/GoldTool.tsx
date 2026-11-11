import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { gold, incomeTax } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { goldCompare, GOLD_OPTIONS, type GoldOption, type GoldOptionResult } from '@/models/gold';
import {
  GOLD_EXAMPLE_KEYS,
  GOLD_LIMITS,
  GOLD_PERCENT,
  goldExampleForm,
  goldShareSchema,
  invalidGoldFields,
  toGoldInput,
  type GoldForm,
  type GoldKey,
} from '@/models/goldForm';
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
import { Group } from '@/components/tool/PlanSteps';

interface Props {
  locale: Locale;
}

const CHECKLIST = [1, 2, 3].map((n) => `gold.checklist.${n}` as MessageKey);
const RUPEES_A_GRAM: GoldKey[] = ['sgbIssuePrice', 'goldPriceToday'];

/** Physical gold, digital gold, a gold ETF or a Sovereign Gold Bond: what you keep of each. */
export default function GoldTool({ locale }: Props) {
  const [form, setForm] = useState<GoldForm>(goldExampleForm);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<GoldKey>());

  const set = (key: GoldKey) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, goldShareSchema);
    for (const key of Object.keys(fromUrl) as GoldKey[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), goldShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toGoldInput(form), [form]);
  const r = useMemo(() => (input ? goldCompare(input, gold, incomeTax) : null), [input]);
  const missing = invalidGoldFields(form);
  const isExample = GOLD_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const name = (o: GoldOption) => t(locale, `gold.option.${o}` as MessageKey);
  const nameIn = (o: GoldOption) => t(locale, `gold.optionIn.${o}` as MessageKey);
  const pct = formatPercent;

  const field = (key: GoldKey) => (
    <NumberField
      key={key}
      locale={locale}
      name={key}
      label={t(locale, `gold.in.${key}` as MessageKey)}
      unit={
        GOLD_PERCENT.includes(key)
          ? '%'
          : key === 'years'
            ? t(locale, 'input.horizonYears.unit')
            : RUPEES_A_GRAM.includes(key)
              ? t(locale, 'gold.unit.gram')
              : '₹'
      }
      note={t(locale, `gold.note.${key}` as MessageKey)}
      value={form[key]}
      onChange={set(key)}
      example={GOLD_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...GOLD_LIMITS[key]}
      percent={GOLD_PERCENT.includes(key)}
      integer={key === 'years'}
      layout="row"
    />
  );

  const best = r?.best;
  const second = r?.ranking[1];
  const headline =
    r && input && best
      ? t(locale, 'gold.verdict.best', {
          option: name(best),
          kept: formatMoney(r.options[best].kept),
          amount: formatMoney(input.amount),
          years: input.years,
        })
      : '';

  /** One line under each bar: the tax it paid, and why. */
  const barNote = (o: GoldOption, x: GoldOptionResult): string => {
    const taxNote =
      x.gainTax > 0
        ? t(locale, x.longTerm ? 'gold.bar.longTerm' : 'gold.bar.shortTerm', {
            tax: formatINR(x.gainTax),
          })
        : t(locale, 'gold.bar.noGainTax');
    return o === 'sgb'
      ? `${taxNote} ${t(locale, 'gold.bar.interest', { kept: formatINR(x.interestKept) })}`
      : taxNote;
  };

  const working = (o: GoldOption): WorkingRow[] => {
    if (!r || !input) return [];
    const x = r.options[o];
    const g = `(1 + ${pct(input.growth)})^${input.years}`;
    const rows: WorkingRow[] = [];
    if (o === 'physical') {
      rows.push(
        {
          label: t(locale, 'gold.w.startValue'),
          formula: `${formatINR(input.amount)} ÷ ((1 + ${pct(input.making)}) × (1 + ${pct(gold.gst.rate)}))`,
          value: formatINR(x.startValue),
        },
        {
          label: t(locale, 'gold.w.makingGst'),
          formula: `${formatINR(x.making)} + ${formatINR(x.gst)}`,
          value: formatINR(x.making + x.gst),
        },
        {
          label: t(locale, 'gold.w.proceeds'),
          formula: `${formatINR(x.startValue)} × ${g} × (1 − ${pct(input.buybackCut)})`,
          value: formatINR(x.proceeds),
        },
      );
    } else if (o === 'digital') {
      rows.push(
        {
          label: t(locale, 'gold.w.startValue'),
          formula: `${formatINR(input.amount)} ÷ (1 + ${pct(gold.gst.rate)})`,
          value: formatINR(x.startValue),
        },
        {
          label: t(locale, 'gold.w.proceeds'),
          formula: `${formatINR(x.startValue)} × ${g} × (1 − ${pct(input.spread)})`,
          value: formatINR(x.proceeds),
        },
      );
    } else if (o === 'etf') {
      rows.push({
        label: t(locale, 'gold.w.proceeds'),
        formula: `${formatINR(input.amount)} × ${g} × (1 − ${pct(input.expenseRatio)})^${input.years}`,
        value: formatINR(x.proceeds),
      });
    } else {
      rows.push(
        {
          label: t(locale, 'gold.w.startValue'),
          formula: `${formatINR(input.amount)} ÷ (1 + ${pct(input.sgbPremium)})`,
          value: formatINR(x.startValue),
        },
        {
          label: t(locale, 'gold.w.proceeds'),
          formula: `${formatINR(x.startValue)} × ${g}`,
          value: formatINR(x.proceeds),
        },
        {
          label: t(locale, 'gold.w.interest'),
          formula: t(locale, 'gold.w.interestFormula', {
            rate: pct(gold.sgb.couponRate),
            issue: formatINR(input.sgbIssuePrice),
            tax: pct(input.slabRate),
          }),
          value: formatINR(x.interestKept),
        },
      );
    }
    rows.push(
      {
        label: t(locale, 'gold.w.gain'),
        formula: `${formatINR(x.proceeds)} − ${formatINR(input.amount)}`,
        value: formatINR(x.gain),
      },
      {
        label: t(locale, x.longTerm ? 'gold.w.taxLong' : 'gold.w.taxShort'),
        formula:
          x.gain > 0
            ? `${formatINR(x.gain)} × ${pct(x.longTerm ? incomeTax.capitalGains.longTermRate : input.slabRate)} × ${1 + incomeTax.cessRate}`
            : t(locale, 'gold.w.noTax'),
        value: formatINR(x.gainTax),
      },
      {
        label: t(locale, 'gold.w.kept'),
        formula:
          o === 'sgb'
            ? `${formatINR(x.proceeds)} − ${formatINR(x.gainTax)} + ${formatINR(x.interestKept)}`
            : `${formatINR(x.proceeds)} − ${formatINR(x.gainTax)}`,
        value: formatINR(x.kept),
        strong: true,
      },
    );
    return rows;
  };

  const lead =
    r && best && second
      ? r.options[best].keptByMonth.map((v, i) => v - r.options[second].keptByMonth[i]!)
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="gold-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="gold-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(goldExampleForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>

          <Tier
            tone="yours"
            title={t(locale, 'gold.step.yours')}
            hint={t(locale, 'gold.step.yoursHint')}
          >
            {field('amount')}
            {field('years')}
            {field('growth')}
            {field('slabRate')}
          </Tier>

          <Tier
            tone="check"
            title={t(locale, 'gold.step.costs')}
            hint={t(locale, 'gold.step.costsHint')}
          >
            <Group title={name('physical')}>
              {field('making')}
              {field('buybackCut')}
            </Group>
            <Group title={name('digital')}>{field('spread')}</Group>
            <Group title={name('etf')}>{field('expenseRatio')}</Group>
            <Group title={name('sgb')}>
              {field('goldPriceToday')}
              {field('sgbIssuePrice')}
              {field('sgbPremium')}
            </Group>
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input && best && second ? (
            <section
              id="verdict"
              aria-labelledby="gold-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="gold-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'gold.verdict.sub', {
                  gap: formatMoney(r.options[best].kept - r.options[second].kept),
                  second: nameIn(second),
                })}
              </p>
              <CompareBars
                caption={t(locale, 'gold.compare', {
                  amount: formatMoney(input.amount),
                  years: input.years,
                })}
                items={r.ranking.map((o) => ({
                  label: name(o),
                  value: r.options[o].kept,
                  display: formatMoney(r.options[o].kept),
                  best: o === best,
                  tax: r.options[o].gainTax + r.options[o].interestTax,
                  note: barNote(o, r.options[o]),
                }))}
              />
              <p class="mt-3 text-sm text-ink-muted">{t(locale, 'gold.sgbNote')}</p>
              <p class="mt-2 text-sm text-ink-muted">{t(locale, 'gold.digitalNote')}</p>
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'gold.exampleNote')}
                  inputsId="gold-inputs-heading"
                />
              )}
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'gold.needInputs')}</p>
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

      {r && input && best && second && (
        <>
          <div class="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 border-t border-line pt-5 lg:grid-cols-2">
            {GOLD_OPTIONS.map((o) => (
              <WorkingBlock key={o} title={name(o)} rows={working(o)} />
            ))}
          </div>
          <div class="mt-6 max-w-xl">
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail
              defaultOpen
              title={t(locale, 'gold.chart.heading')}
              hint={t(locale, 'gold.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'gold.chart.title', { best: name(best), second: nameIn(second) })}
                netWithInterest={[lead[0] ?? 0, ...lead]}
                breakevenWithInterest={null}
                labels={{
                  main: t(locale, 'gold.chart.line', { best: name(best), second: nameIn(second) }),
                }}
              />
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-gold.csv"
                highlight={[]}
                columns={GOLD_OPTIONS.map((o) => ({
                  label: t(locale, 'gold.col.kept', { option: name(o) }),
                  values: r.options[o].keptByMonth,
                  kind: 'money' as const,
                }))}
              />
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}
