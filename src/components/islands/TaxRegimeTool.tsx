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
import type { DeductionKey, DeductionLine } from '@/models/taxDeductions';
import {
  DEDUCTION_GROUPS,
  TAX_REGIME_EXAMPLE_FORM,
  TAX_REGIME_EXAMPLE_KEYS,
  TAX_REGIME_LIMITS,
  invalidTaxRegimeFields,
  needsBasicPay,
  taxRegimeShareSchema,
  toTaxRegimeInput,
  type DeductionGroup,
  type DeductionMode,
  type TaxRegimeForm,
  type TaxRegimeNumberKey,
} from '@/models/taxRegimeForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import Refine from '@/components/tool/Refine';
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
  const pinned = useRef(new Set<keyof TaxRegimeForm>());

  const set =
    <K extends keyof TaxRegimeForm>(key: K) =>
    (value: TaxRegimeForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  // A shared link fills the form. The address bar is never rewritten with the visitor's salary
  // and deductions: the share link is built only for the copy button and saved scenarios.
  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, taxRegimeShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof TaxRegimeForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);
  const query = ready ? encodeShare(pickKeys(form, pinned.current), taxRegimeShareSchema) : '';
  const shareHref = ready
    ? `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`
    : '';

  const result = useMemo(() => toTaxRegimeInput(form), [form]);
  const input = result?.input ?? null;
  const items = result?.items ?? null;
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
  // The old regime with every remaining limit used: does it overtake the new one?
  const roomTotal = items
    ? items.roomLeft.section80C +
      items.roomLeft.npsExtra +
      items.roomLeft.healthSelf +
      items.roomLeft.healthParents
    : 0;
  const allUsed = useMemo(
    () =>
      input && roomTotal > 0
        ? compareRegimes({ ...input, oldDeductions: input.oldDeductions + roomTotal }, incomeTax)
        : null,
    [input, roomTotal],
  );

  const missing = invalidTaxRegimeFields(form);
  const isExample = TAX_REGIME_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const regimeName = (regime: Regime) => t(locale, `taxRegime.regime.${regime}` as MessageKey);
  const line = (key: DeductionKey): DeductionLine | undefined =>
    items?.old.find((l) => l.key === key);

  const field = (
    key: TaxRegimeNumberKey,
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
      onChange={(v) => set(key)(v)}
      example={TAX_REGIME_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...TAX_REGIME_LIMITS[key]}
      optional={extra.optional ?? true}
      slider={extra.slider}
      layout="row"
    />
  );

  const check = (
    key: 'largeCity' | 'healthSelfSenior' | 'healthParentsSenior' | 'governmentEmployer',
  ) => (
    <label class="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
      <input
        type="checkbox"
        name={key}
        checked={form[key]}
        onChange={(e) => set(key)(e.currentTarget.checked)}
        class="size-5 shrink-0 accent-(--color-accent-strong)"
      />
      <span>{t(locale, `taxRegime.check.${key}` as MessageKey)}</span>
    </label>
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

  /** Each claim after its limit, in the working. */
  const itemRows: WorkingRow[] = items
    ? [
        ...items.old
          .filter((l) => l.entered > 0 || l.allowed > 0)
          .map((l) => ({
            label: t(locale, `taxRegime.item.${l.key}` as MessageKey),
            formula:
              l.limit !== null && l.entered > l.limit
                ? t(locale, 'taxRegime.w.capped', { limit: formatINR(l.limit) })
                : undefined,
            value: formatINR(l.allowed),
          })),
        {
          label: t(locale, 'taxRegime.w.oldTotal'),
          value: formatINR(items.oldTotal),
          strong: true,
        },
        {
          label: t(locale, 'taxRegime.w.newTotal'),
          value: formatINR(items.newTotal),
        },
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

  /** One claim's fields, with how much of its limit is used. */
  const groupBody: Record<DeductionGroup, ComponentChildren> = {
    rent: (
      <>
        {field('hraReceived', 'taxRegime.in.hraReceived', t(locale, 'taxRegime.note.hraReceived'), {
          optional: false,
        })}
        {field('rentPaid', 'taxRegime.in.rentPaid', t(locale, 'taxRegime.note.rentPaid'), {
          optional: false,
        })}
        {check('largeCity')}
        {line('hra') && (
          <p class="py-2.5 text-sm text-ink-muted">
            {t(locale, 'taxRegime.hraResult', { amount: formatINR(line('hra')!.allowed) })}
          </p>
        )}
      </>
    ),
    invest: (
      <>
        {field('section80C', 'taxRegime.in.section80C', t(locale, 'taxRegime.note.section80C'))}
        <Cap locale={locale} line={line('section80C')} />
      </>
    ),
    health: (
      <>
        {field('healthSelf', 'taxRegime.in.healthSelf', t(locale, 'taxRegime.note.healthSelf'))}
        {check('healthSelfSenior')}
        <Cap locale={locale} line={line('healthSelf')} />
        {field(
          'healthParents',
          'taxRegime.in.healthParents',
          t(locale, 'taxRegime.note.healthParents'),
        )}
        {check('healthParentsSenior')}
        <Cap locale={locale} line={line('healthParents')} />
      </>
    ),
    homeLoan: (
      <>
        {field(
          'homeLoanInterest',
          'taxRegime.in.homeLoanInterest',
          t(locale, 'taxRegime.note.homeLoanInterest'),
        )}
        <Cap locale={locale} line={line('homeLoanInterest')} />
      </>
    ),
    nps: (
      <>
        {field('npsExtra', 'taxRegime.in.npsExtra', t(locale, 'taxRegime.note.npsExtra'))}
        <Cap locale={locale} line={line('npsExtra')} />
        {field('employerNps', 'taxRegime.in.employerNps', t(locale, 'taxRegime.note.employerNps'))}
        {check('governmentEmployer')}
      </>
    ),
    education: field(
      'educationLoanInterest',
      'taxRegime.in.educationLoanInterest',
      t(locale, 'taxRegime.note.educationLoanInterest'),
    ),
    savings: (
      <>
        {field(
          'savingsInterest',
          'taxRegime.in.savingsInterest',
          t(locale, 'taxRegime.note.savingsInterest'),
        )}
        <Cap locale={locale} line={line('savingsInterest')} />
      </>
    ),
  };

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

          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {field('salary', 'taxRegime.in.salary', t(locale, 'taxRegime.note.salary'), {
              slider: { min: 3_00_000, max: 50_00_000, step: 50_000 },
            })}
            <Segmented
              label={t(locale, 'taxRegime.mode.label')}
              name="tr-mode"
              options={(['items', 'total'] as DeductionMode[]).map((m) => ({
                value: m,
                label: t(locale, `taxRegime.mode.${m}` as MessageKey),
              }))}
              value={form.mode}
              onChange={(m) => {
                // Switching to one total starts from the itemised total, not from nothing.
                if (m === 'total' && form.oldDeductions === null && items) {
                  setForm((f) => ({ ...f, oldDeductions: items.oldTotal }));
                }
                set('mode')(m);
              }}
            />
            {form.mode === 'total' &&
              field(
                'oldDeductions',
                'taxRegime.in.oldDeductions',
                t(locale, 'taxRegime.note.oldDeductions'),
              )}
          </Tier>

          {form.mode === 'items' && (
            <fieldset class="mt-5">
              <legend class="font-display text-lg font-medium">
                {t(locale, 'taxRegime.groups.title')}
              </legend>
              <p class="mt-0.5 text-sm text-ink-muted">{t(locale, 'taxRegime.groups.hint')}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                {DEDUCTION_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={form[g]}
                    onClick={() => set(g)(!form[g])}
                    class="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-raised px-4 text-sm font-medium text-ink transition-colors duration-(--duration-fast) ease-out-quart hover:border-accent aria-pressed:border-accent-strong aria-pressed:bg-accent-soft aria-pressed:text-accent-strong"
                  >
                    {form[g] && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m5 12.5 4.5 4.5L19 7.5"
                          stroke="currentColor"
                          stroke-width="2.25"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    )}
                    {t(locale, `taxRegime.group.${g}` as MessageKey)}
                  </button>
                ))}
              </div>

              {needsBasicPay(form) && (
                <div class="mt-4 rounded-xl border border-line-strong bg-raised px-4 pt-1 pb-1">
                  {field(
                    'basicPlusDa',
                    'taxRegime.in.basicPlusDa',
                    t(locale, 'taxRegime.note.basicPlusDa'),
                    { optional: false },
                  )}
                </div>
              )}

              {DEDUCTION_GROUPS.filter((g) => form[g]).map((g) => (
                <Group key={g} title={t(locale, `taxRegime.group.${g}` as MessageKey)}>
                  {groupBody[g]}
                </Group>
              ))}
            </fieldset>
          )}

          <Refine
            locale={locale}
            storageKey="dw.refine.taxRegime"
            hint={t(
              locale,
              form.mode === 'items' ? 'taxRegime.summaryItems' : 'taxRegime.summary',
              {
                other: formatMoney(form.otherIncome ?? 0),
                nd: formatMoney(form.newDeductions ?? 0),
              },
            )}
            forceOpen={missing.some((k) => k === 'otherIncome' || k === 'newDeductions')}
          >
            <Group title={t(locale, 'taxRegime.group.more')}>
              {field(
                'otherIncome',
                'taxRegime.in.otherIncome',
                t(locale, 'taxRegime.note.otherIncome'),
              )}
              {form.mode === 'total' &&
                field(
                  'newDeductions',
                  'taxRegime.in.newDeductions',
                  t(locale, 'taxRegime.note.newDeductions'),
                )}
            </Group>
          </Refine>
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
              {items && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'taxRegime.verdict.itemsTotal', {
                    amount: formatMoney(items.oldTotal),
                  })}
                </p>
              )}
              <p class="mt-2 font-medium">
                {breakEven !== null
                  ? t(locale, 'taxRegime.verdict.breakEven', { value: formatMoney(breakEven) })
                  : t(locale, 'taxRegime.verdict.oldNever')}
              </p>
              {allUsed && (
                <p class="mt-2 text-ink-muted">
                  {r.better === 'old' && r.saving >= 1
                    ? t(locale, 'taxRegime.verdict.roomMore', {
                        room: formatMoney(roomTotal),
                        amount: formatMoney(r.old.total - allUsed.old.total),
                      })
                    : allUsed.better === 'old' && allUsed.saving >= 1
                      ? t(locale, 'taxRegime.verdict.roomFlips', {
                          room: formatMoney(roomTotal),
                          amount: formatMoney(allUsed.saving),
                        })
                      : t(locale, 'taxRegime.verdict.roomStays', {
                          room: formatMoney(roomTotal),
                        })}
                </p>
              )}
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
            query={query ? `?${query}` : ''}
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
              {items && (
                <div class="mb-4 max-w-xl">
                  <WorkingBlock title={t(locale, 'taxRegime.w.itemsTitle')} rows={itemRows} />
                </div>
              )}
              <div class="grid gap-4 lg:grid-cols-2">
                <WorkingBlock title={regimeName('new')} rows={rowsFor('new', r.new)} />
                <WorkingBlock title={regimeName('old')} rows={rowsFor('old', r.old)} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
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

/** How much of a claim's limit is used, as a thin bar and one line. */
function Cap({ locale, line }: { locale: Locale; line: DeductionLine | undefined }) {
  if (!line || line.limit === null || line.limit <= 0) return null;
  const share = Math.min(1, line.allowed / line.limit);
  const over = line.entered - line.limit;
  return (
    <div class="py-2.5">
      <div class="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div
          class="h-full origin-left rounded-full bg-accent"
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
      <p class="mt-1.5 text-sm text-ink-muted">
        {over > 0
          ? t(locale, 'taxRegime.cap.over', {
              over: formatINR(over),
              limit: formatINR(line.limit),
            })
          : t(locale, 'taxRegime.cap.used', {
              used: formatINR(line.allowed),
              limit: formatINR(line.limit),
              left: formatINR(line.limit - line.allowed),
            })}
      </p>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = `${name}-label`;
  return (
    <div class="py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p id={id} class="text-sm font-medium">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={id}
        class="mt-2 grid w-full grid-cols-2 gap-1 rounded-lg bg-surface p-1 sm:mt-0 sm:max-w-xs"
      >
        {options.map((o) => (
          <label
            key={o.value}
            class="flex min-h-10 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-medium text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart has-[:checked]:bg-raised has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-strong"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              class="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
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
