import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatDuration } from '@/lib/duration';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import {
  DEBT_KINDS,
  DEBT_ORDERS,
  compareDebtOrders,
  type Debt,
  type DebtOrder,
  type DebtRun,
} from '@/models/debtOrder';
import {
  DEBT_EXAMPLE_KEYS,
  DEBT_LIMITS,
  SLOTS,
  debtEmptyForm,
  debtExampleForm,
  debtKeys,
  debtShareSchema,
  invalidDebtFields,
  slotUsed,
  toDebtInput,
  type DebtForm,
  type DebtNumberKey,
  type Slot,
} from '@/models/debtOrderForm';
import CompareBars, { type CompareItem } from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable from '@/components/tool/MonthlyTable';

interface Props {
  locale: Locale;
}

/** Slots shown at the start: the example's three. */
const START_SLOTS = 3;
const lastUsed = (form: DebtForm) =>
  SLOTS.reduce((last, n) => (slotUsed(form, n) ? n : last), 0 as number);

/** Which debt to pay off first, with spare money: by rate, by balance, or as you are. */
export default function DebtOrderTool({ locale }: Props) {
  const [form, setForm] = useState<DebtForm>(() => debtExampleForm());
  const [rev, setRev] = useState(0);
  const [slots, setSlots] = useState(START_SLOTS);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof DebtForm>());

  const replace = (next: DebtForm) => {
    setForm(next);
    setSlots(Math.max(2, lastUsed(next)));
    setRev((n) => n + 1);
  };

  const set =
    <K extends keyof DebtForm>(key: K) =>
    (value: DebtForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, debtShareSchema);
    const keys = Object.keys(fromUrl) as (keyof DebtForm)[];
    if (keys.length > 0) {
      // A shared link lists every debt: rows it leaves out are empty, not the example's.
      const debts = keys.some((k) => /^d\d/.test(k));
      const base = debts
        ? { ...debtEmptyForm(), extra: debtExampleForm().extra }
        : debtExampleForm();
      if (debts) for (const k of Object.keys(base) as (keyof DebtForm)[]) pinned.current.add(k);
      for (const k of keys) pinned.current.add(k);
      replace({ ...base, ...fromUrl } as DebtForm);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      // Once any debt is changed, the link lists every debt in use (and none of the empty rows),
      // since a link with debts in it is read as the whole list.
      const keys = new Set(pinned.current);
      if ([...keys].some((k) => /^d\d/.test(k))) {
        for (const n of SLOTS)
          for (const k of Object.values(debtKeys(n))) {
            if (slotUsed(form, n)) keys.add(k);
            else keys.delete(k);
          }
      }
      const query = encodeShare(pickKeys(form, keys), debtShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toDebtInput(form), [form]);
  const r = useMemo(() => (input ? compareDebtOrders(input) : null), [input]);

  const isExample = DEBT_EXAMPLE_KEYS.some((key) => !pinned.current.has(key));
  const invalid = invalidDebtFields(form);
  const used = SLOTS.filter((n) => slotUsed(form, n)).length;

  const removeSlot = (slot: Slot) => {
    const next = { ...form };
    for (let s = slot; s <= SLOTS.length; s++) {
      const here = debtKeys(s as Slot);
      const from = s < SLOTS.length ? debtKeys((s + 1) as Slot) : null;
      next[here.kind] = from ? form[from.kind] : 'other';
      next[here.balance] = from ? form[from.balance] : null;
      next[here.rate] = from ? form[from.rate] : null;
      next[here.payment] = from ? form[from.payment] : null;
      for (const k of Object.values(here)) pinned.current.add(k);
    }
    setForm(next);
    setSlots((n) => Math.max(2, n - 1));
    setRev((n) => n + 1);
  };

  const field = (key: DebtNumberKey, label: string, note: string, percent = false) => (
    <NumberField
      key={`${key}-${rev}`}
      locale={locale}
      name={key}
      label={label}
      unit={percent ? '%' : '₹'}
      note={note}
      value={form[key]}
      onChange={(v) => set(key)(v)}
      example={DEBT_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...DEBT_LIMITS[key]}
      percent={percent}
      optional={key === 'lumpSum'}
      layout="row"
    />
  );

  // Names for the debts in the answer: "the credit card", or "credit card 2" when kinds repeat.
  const names = useMemo(() => {
    if (!input) return [];
    const kinds = input.debts.map((d) => d.kind);
    return input.debts.map((d, i) => {
      const base = t(locale, `debt.kind.${d.kind}` as MessageKey);
      const same = kinds.filter((k) => k === d.kind).length;
      if (same < 2) return base;
      const nth = kinds.slice(0, i + 1).filter((k) => k === d.kind).length;
      return t(locale, 'debt.kindNth', { kind: base, n: nth });
    });
  }, [input, locale]);

  // The same, as list labels: "Credit card", "Credit card (2)".
  const labels = useMemo(() => {
    if (!input) return [];
    const kinds = input.debts.map((d) => d.kind);
    return input.debts.map((d, i) => {
      const base = t(locale, `debt.kindLabel.${d.kind}` as MessageKey);
      if (kinds.filter((k) => k === d.kind).length < 2) return base;
      const nth = kinds.slice(0, i + 1).filter((k) => k === d.kind).length;
      return t(locale, 'debt.kindNth', { kind: base, n: nth });
    });
  }, [input, locale]);

  const when = (months: number | null) =>
    months === null ? t(locale, 'debt.never') : formatDuration(locale, months);

  let headline = '';
  let best: DebtRun | null = null;
  let worst: DebtOrder | null = null;
  if (r && input) {
    best = r.orders[r.best];
    const first = best.order.find((i) => best!.clearedMonth[i] !== 0) ?? best.order[0]!;
    worst = DEBT_ORDERS.reduce((a, b) =>
      r.orders[b].totalInterest > r.orders[a].totalInterest ? b : a,
    );
    headline =
      best.months === null
        ? t(locale, 'debt.headline.never')
        : t(locale, 'debt.headline', { debt: names[first] ?? '' });
  }

  const bars: CompareItem[] = r
    ? [
        ...DEBT_ORDERS.map((o) => ({
          label: t(locale, `debt.order.${o}` as MessageKey),
          value: r.orders[o].totalInterest,
          display: formatMoney(r.orders[o].totalInterest),
          best: o === r.best,
          note: t(locale, 'debt.bar.note', { time: when(r.orders[o].months) }),
        })),
        {
          label: t(locale, 'debt.order.now'),
          value: r.now.totalInterest,
          display: formatMoney(r.now.totalInterest),
          note: t(locale, 'debt.bar.note', { time: when(r.now.months) }),
        },
      ]
    : [];

  const working: WorkingRow[] =
    r && input && best
      ? [
          {
            label: t(locale, 'debt.w.owed'),
            formula: t(locale, 'debt.w.owedFormula', { n: input.debts.length }),
            value: formatMoney(input.debts.reduce((s, d) => s + d.balance, 0)),
          },
          {
            label: t(locale, 'debt.w.regular'),
            formula: t(locale, 'debt.w.regularFormula'),
            value: formatMoney(input.debts.reduce((s, d) => s + d.payment, 0)),
          },
          {
            label: t(locale, 'debt.w.extra'),
            formula: t(locale, 'debt.w.extraFormula'),
            value: formatMoney(input.extra),
          },
          {
            label: t(locale, 'debt.w.interestNow'),
            formula: t(locale, 'debt.w.interestFormula'),
            value: formatMoney(r.now.totalInterest),
          },
          {
            label: t(locale, 'debt.w.interestBest'),
            formula: t(locale, `debt.order.${r.best}` as MessageKey),
            value: formatMoney(best.totalInterest),
            strong: true,
          },
          {
            label: t(locale, 'debt.w.saved'),
            formula: t(locale, 'debt.w.savedFormula'),
            value: formatMoney(r.now.totalInterest - best.totalInterest),
          },
        ]
      : [];

  const length = r ? Math.max(r.now.balanceByMonth.length, best?.balanceByMonth.length ?? 0) : 0;
  const pad = (values: number[]) => Array.from({ length }, (_, i) => values[i] ?? 0);

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="debt-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="debt-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                replace(debtExampleForm());
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'debt.scope')}</p>

          {SLOTS.slice(0, slots).map((n) => {
            const k = debtKeys(n);
            const selectId = `debt-kind-${n}`;
            return (
              <Tier
                key={`${n}-${rev}`}
                tone="yours"
                title={t(locale, 'debt.slot.title', { n })}
                hint={t(locale, 'debt.slot.hint')}
              >
                <div class="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
                  <label for={selectId} class="text-sm font-medium">
                    {t(locale, 'debt.in.kind')}
                  </label>
                  <select
                    id={selectId}
                    value={form[k.kind]}
                    onChange={(e) => set(k.kind)(e.currentTarget.value as Debt['kind'])}
                    class="min-h-11 w-full rounded-lg border border-line-strong bg-page px-3 text-base text-ink transition-colors duration-(--duration-fast) ease-out-quart hover:border-ink-subtle focus:border-accent-strong"
                  >
                    {DEBT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(locale, `debt.kindLabel.${kind}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div class="divide-y divide-line border-t border-line">
                  {field(k.balance, t(locale, 'debt.in.balance'), t(locale, 'debt.note.balance'))}
                  {field(k.rate, t(locale, 'debt.in.rate'), t(locale, 'debt.note.rate'), true)}
                  {field(
                    k.payment,
                    t(locale, 'debt.in.payment'),
                    t(
                      locale,
                      `debt.note.payment.${form[k.kind] === 'card' ? 'card' : 'loan'}` as MessageKey,
                    ),
                  )}
                </div>
                {slots > 2 && (
                  <div class="flex justify-end py-1">
                    <button
                      type="button"
                      onClick={() => removeSlot(n)}
                      class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
                      aria-label={t(locale, 'debt.slot.removeLabel', { n })}
                    >
                      {t(locale, 'plan.lump.remove')}
                    </button>
                  </div>
                )}
              </Tier>
            );
          })}
          {slots < SLOTS.length && (
            <div class="py-2">
              <button
                type="button"
                onClick={() => setSlots((s) => s + 1)}
                class="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
                {t(locale, 'debt.slot.add')}
              </button>
            </div>
          )}

          <Tier
            tone="yours"
            title={t(locale, 'debt.step.spare')}
            hint={t(locale, 'debt.step.spareHint')}
          >
            {field('extra', t(locale, 'debt.in.extra'), t(locale, 'debt.note.extra'))}
            {field('lumpSum', t(locale, 'debt.in.lumpSum'), t(locale, 'debt.note.lumpSum'))}
          </Tier>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input && best ? (
            <section
              id="verdict"
              aria-labelledby="debt-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="debt-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              {best.months !== null && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'debt.sub', {
                    order: t(locale, `debt.orderShort.${r.best}` as MessageKey),
                    interest: formatMoney(best.totalInterest),
                    time: when(best.months),
                  })}
                </p>
              )}
              {worst !== null && worst !== r.best && (
                <p class="mt-2 font-medium">
                  {t(locale, 'debt.vsWorst', {
                    order: t(locale, `debt.orderShort.${worst}` as MessageKey),
                    more: formatMoney(r.orders[worst].totalInterest - best.totalInterest),
                  })}
                </p>
              )}
              <p class="mt-2 text-ink-muted">
                {r.now.months === null
                  ? t(locale, 'debt.vsNowNever', {
                      saved: formatMoney(r.now.totalInterest - best.totalInterest),
                    })
                  : t(locale, 'debt.vsNow', {
                      saved: formatMoney(r.now.totalInterest - best.totalInterest),
                      time: when(r.now.months),
                    })}
              </p>
              {r.notCovering.length > 0 && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'debt.notCovering', {
                    debts: r.notCovering.map((i) => names[i]).join(', '),
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'debt.exampleNote')}
                  inputsId="debt-inputs-heading"
                />
              )}
              <div class="mt-4 border-t border-line pt-4 text-sm">
                <p class="text-ink-muted">{t(locale, 'debt.orderTitle')}</p>
                <ol class="mt-1.5 list-none space-y-1.5">
                  {best.order.map((i, rank) => (
                    <li key={i} class="flex items-baseline justify-between gap-4">
                      <span>
                        <span class="num">{`${rank + 1}.`}</span> {labels[i]}{' '}
                        <span class="text-ink-muted">
                          {formatPercent(input.debts[i]!.annualRate)}
                        </span>
                      </span>
                      <span class="text-ink-muted num">
                        {best!.clearedMonth[i] === 0
                          ? t(locale, 'debt.clearedToday')
                          : best!.clearedMonth[i] === null
                            ? t(locale, 'debt.never')
                            : t(locale, 'debt.clearedIn', {
                                time: formatDuration(locale, best!.clearedMonth[i]!),
                              })}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <CompareBars caption={t(locale, 'debt.compare')} items={bars} />
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, used < 2 ? 'debt.needTwo' : 'debt.needInputs')}</p>
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
            tool="debt-order"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && best
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    {
                      label: t(locale, 'debt.w.interestBest'),
                      value: formatMoney(best.totalInterest),
                    },
                    { label: t(locale, 'debt.in.extra'), value: formatMoney(input?.extra ?? 0) },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && input && best && (
        <>
          <div class="mt-8 border-t border-line pt-5">
            <NonMoneyChecklist
              locale={locale}
              items={[1, 2, 3, 4].map((n) => t(locale, `debt.checklist.${n}` as MessageKey))}
            />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="max-w-xl">
                <WorkingBlock title={t(locale, 'debt.w.title')} rows={working} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'debt.chart.heading')}
              hint={t(locale, 'debt.chart.hint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'debt.chart.title')}
                netWithInterest={pad(best.balanceByMonth)}
                netNoInterest={pad(r.now.balanceByMonth)}
                breakevenWithInterest={null}
                labels={{
                  main: t(locale, `debt.order.${r.best}` as MessageKey),
                  secondary: t(locale, 'debt.order.now'),
                }}
              />
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                csvFilename="capitalverdict-debt-order.csv"
                highlight={[]}
                columns={[
                  {
                    label: t(locale, 'debt.col.paid'),
                    values: best.paidByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'debt.col.interest'),
                    values: best.interestByMonth.slice(1),
                    kind: 'money',
                  },
                  {
                    label: t(locale, 'debt.col.owed'),
                    values: best.balanceByMonth.slice(1),
                    kind: 'money',
                  },
                ]}
              />
              <p class="mt-2 text-sm text-ink-muted">
                {t(locale, 'debt.monthNote', {
                  order: t(locale, `debt.orderShort.${r.best}` as MessageKey),
                })}
              </p>
            </MoreDetail>
          </div>
        </>
      )}
    </div>
  );
}
