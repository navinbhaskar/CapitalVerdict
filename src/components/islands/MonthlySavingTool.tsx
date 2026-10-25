import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, incomeTax, smallSavings } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { monthlySaving, sipBreakEven, type SavingOption } from '@/models/monthlySaving';
import {
  MONTHLY_SAVING_EXAMPLE_FORM,
  MONTHLY_SAVING_EXAMPLE_KEYS,
  MONTHLY_SAVING_LIMITS,
  invalidMonthlySavingFields,
  monthlySavingShareSchema,
  toMonthlySavingInput,
  type MonthlySavingForm,
} from '@/models/monthlySavingForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import EquityTaxNote from '@/components/tool/EquityTaxNote';
import MarketRiskNote from '@/components/tool/MarketRiskNote';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
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

const OPTIONS: SavingOption[] = ['sip', 'ppf', 'rd'];
const PPF = smallSavings.ppf;
const RETURNS = defaults.scenarioVariables.equityReturnNominal.values;
const CHECKLIST: MessageKey[] = [
  'saving.checklist.1',
  'saving.checklist.2',
  'saving.checklist.3',
  'saving.checklist.4',
];
const QUICK: (keyof MonthlySavingForm)[] = ['monthly', 'rdRate', 'taxRate'];

export default function MonthlySavingTool({ locale }: Props) {
  const [form, setForm] = useState<MonthlySavingForm>(MONTHLY_SAVING_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof MonthlySavingForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof MonthlySavingForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, monthlySavingShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof MonthlySavingForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Inflation follows the global assumptions unless the visitor set it here.
  useEffect(() => {
    if (!ready || pinned.current.has('inflation')) return;
    setForm((f) =>
      f.inflation === assumptions.inflation ? f : { ...f, inflation: assumptions.inflation },
    );
  }, [ready, assumptions.inflation]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), monthlySavingShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toMonthlySavingInput(form), [form]);
  const r = useMemo(() => (input ? monthlySaving(input, incomeTax, PPF) : null), [input]);
  const extras = useIdleValue(() => {
    if (!input) return null;
    return {
      flip: sipBreakEven(input, incomeTax, PPF),
      runs: (['pessimistic', 'base', 'optimistic'] as const).map((name) => ({
        name,
        ret: RETURNS[name],
        result: monthlySaving({ ...input, sipReturn: RETURNS[name] }, incomeTax, PPF),
      })),
    };
  }, [input]);

  const years = form.years ?? PPF.termYears;
  const missing = invalidMonthlySavingFields(form);
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));
  const isExample = MONTHLY_SAVING_EXAMPLE_KEYS.some((k) => !pinned.current.has(k));
  const optionName = (o: SavingOption) => t(locale, `saving.option.${o}` as MessageKey);

  const field = (
    key: keyof MonthlySavingForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
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
      example={MONTHLY_SAVING_EXAMPLE_KEYS.includes(key) && !pinned.current.has(key)}
      {...MONTHLY_SAVING_LIMITS[key]}
      {...extra}
      layout="row"
    />
  );

  /** What tax each option paid, in one line under its bar. */
  const taxNote = (o: SavingOption): string => {
    if (!r) return '';
    if (o === 'ppf') return t(locale, 'saving.taxNote.ppf');
    if (o === 'rd') return t(locale, 'saving.taxNote.rd', { tax: formatMoney(r.rd.tax) });
    const cg = incomeTax.capitalGains;
    const shortTax =
      Math.max(0, r.sip.shortTermGain) * cg.equityShortTermRate * (1 + incomeTax.cessRate);
    return t(locale, 'saving.taxNote.sip', {
      tax: formatMoney(r.sip.tax),
      short: formatMoney(shortTax),
      long: formatMoney(r.sip.tax - shortTax),
      exempt: formatINR(cg.equityLongTermExemption),
    });
  };

  const headline = r
    ? t(locale, `saving.verdict.${r.best}` as MessageKey, {
        amount: formatMoney(r.lead),
        years,
      })
    : '';

  const sipRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'saving.w.deposited'), value: formatINR(r.deposited) },
          {
            label: t(locale, 'saving.w.sipValue'),
            formula: t(locale, 'saving.w.sipFormula', { rate: formatPercent(input.sipReturn) }),
            value: formatMoney(r.sip.value),
          },
          {
            label: t(locale, 'saving.w.shortTerm'),
            formula: t(locale, 'saving.w.shortTermFormula'),
            value: formatMoney(r.sip.shortTermGain),
          },
          {
            label: t(locale, 'saving.w.longTerm'),
            formula: t(locale, 'saving.w.longTermFormula', {
              exempt: formatINR(incomeTax.capitalGains.equityLongTermExemption),
            }),
            value: formatMoney(r.sip.longTermGain),
          },
          { label: t(locale, 'saving.w.tax'), value: `−${formatMoney(r.sip.tax)}` },
          { label: t(locale, 'saving.w.kept'), value: formatMoney(r.sip.net), strong: true },
        ]
      : [];

  const ppfRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'saving.w.deposited'), value: formatINR(r.deposited) },
          {
            label: t(locale, 'saving.w.ppfInterest'),
            formula: t(locale, 'saving.w.ppfFormula', { rate: formatPercent(input.ppfRate) }),
            value: formatMoney(r.ppf.interest),
          },
          { label: t(locale, 'saving.w.tax'), value: formatINR(0) },
          { label: t(locale, 'saving.w.kept'), value: formatMoney(r.ppf.net), strong: true },
        ]
      : [];

  const rdRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'saving.w.deposited'), value: formatINR(r.deposited) },
          {
            label: t(locale, 'saving.w.rdNetRate'),
            formula: `${formatPercent(input.rdRate)} × (1 − ${formatPercent(input.taxRate)})`,
            value: formatPercent(input.rdRate * (1 - input.taxRate)),
          },
          { label: t(locale, 'saving.w.tax'), value: `−${formatMoney(r.rd.tax)}` },
          { label: t(locale, 'saving.w.kept'), value: formatMoney(r.rd.net), strong: true },
        ]
      : [];

  const flipLines: FlipLine[] =
    input && extras?.flip
      ? [
          {
            text: t(locale, 'saving.flip.sipReturn', {
              years,
              value: formatPercent(extras.flip.threshold),
            }),
            current: formatPercent(input.sipReturn),
          },
        ]
      : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="ms-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ms-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({ ...MONTHLY_SAVING_EXAMPLE_FORM, inflation: assumptions.inflation });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'saving.scope')}</p>

          <Tier tone="yours" title={t(locale, 'tier.yours')} hint={t(locale, 'tier.yoursHint')}>
            {field('monthly', 'saving.in.monthly', '₹', t(locale, 'saving.note.monthly'), {
              slider: { min: 500, max: 12_500, step: 500 },
            })}
          </Tier>

          <Tier tone="check" title={t(locale, 'tier.check')} hint={t(locale, 'tier.checkHint')}>
            {field('rdRate', 'saving.in.rdRate', '%', t(locale, 'saving.note.rdRate'), {
              percent: true,
            })}
            {field('taxRate', 'saving.in.taxRate', '%', t(locale, 'saving.note.taxRate'), {
              percent: true,
            })}
          </Tier>

          <Refine
            locale={locale}
            storageKey="dw.refine.saving"
            hint={t(locale, 'saving.summary', {
              years,
              fund: formatPercent(form.sipReturn ?? 0),
              ppf: formatPercent(form.ppfRate ?? 0),
            })}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'saving.group.assumed')}>
              {field(
                'years',
                'saving.in.years',
                t(locale, 'input.horizonYears.unit'),
                t(locale, 'saving.note.years'),
                { integer: true },
              )}
              {field('sipReturn', 'saving.in.sipReturn', '%', t(locale, 'saving.note.sipReturn'), {
                percent: true,
                flagged: true,
              })}
            </Group>
            <Group title={t(locale, 'saving.group.more')}>
              {field('ppfRate', 'saving.in.ppfRate', '%', t(locale, 'saving.note.ppfRate'), {
                percent: true,
              })}
              {field('inflation', 'saving.in.inflation', '%', t(locale, 'saving.note.inflation'), {
                percent: true,
              })}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && input ? (
            <section
              id="verdict"
              aria-labelledby="ms-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="ms-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, `saving.verdict.today.${r.best}` as MessageKey, {
                  amount: formatMoney(r.bestToday),
                })}
              </p>
              {extras?.flip && (
                <p class="mt-2 font-medium">
                  {t(locale, 'saving.verdict.sipNeeds', {
                    value: formatPercent(extras.flip.threshold),
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'saving.exampleNote')}
                  inputsId="ms-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'saving.compare', {
                  years,
                  deposited: formatMoney(r.deposited),
                })}
                items={OPTIONS.map((o) => ({
                  label: optionName(o),
                  value: r[o].net,
                  display: formatMoney(r[o].net),
                  best: r.best === o,
                  tax: r[o].tax,
                  note: taxNote(o),
                }))}
              />
              <MarketRiskNote locale={locale} kind="fund" />
              <EquityTaxNote locale={locale} context="computed" />
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'saving.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'saving.needInputs')}</p>
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
            tool="saving"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'saving.in.monthly'), value: formatMoney(input.monthly) },
                    {
                      label: t(locale, 'saving.in.sipReturn'),
                      value: formatPercent(input.sipReturn),
                    },
                    ...OPTIONS.map((o) => ({ label: optionName(o), value: formatMoney(r[o].net) })),
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
                <WorkingBlock title={optionName('sip')} rows={sipRows} />
                <WorkingBlock title={optionName('ppf')} rows={ppfRows} />
                <WorkingBlock title={optionName('rd')} rows={rdRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'plotVs.table.title')}
              hint={t(locale, 'saving.table.hint')}
            >
              <div class="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
                <div class="overflow-x-auto">
                  <table class="w-full min-w-80 text-left text-sm">
                    <caption class="sr-only">{t(locale, 'plotVs.table.title')}</caption>
                    <thead>
                      <tr class="border-b border-line-strong">
                        <th scope="col" class="py-2 pr-3 font-medium">
                          {t(locale, 'plotVs.table.year')}
                        </th>
                        {OPTIONS.map((o) => (
                          <th key={o} scope="col" class="py-2 pr-3 text-right font-medium">
                            {optionName(o)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.sip.byYear.map((_, y) =>
                        y === 0 ? null : (
                          <tr key={y} class="border-b border-line">
                            <th scope="row" class="py-2 pr-3 font-normal num">
                              {y}
                            </th>
                            {OPTIONS.map((o) => {
                              const v = r[o].byYear[y]!;
                              const top = Math.max(...OPTIONS.map((x) => r[x].byYear[y]!));
                              return (
                                <td
                                  key={o}
                                  class={`py-2 pr-3 text-right num ${v === top ? 'font-semibold text-accent-strong' : ''}`}
                                >
                                  {formatMoney(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                  <p class="mt-2 text-sm text-ink-muted">{t(locale, 'saving.table.note')}</p>
                </div>
                <section aria-labelledby="ms-scenarios">
                  <h3 id="ms-scenarios" class="font-display text-xl font-medium">
                    {t(locale, 'saving.scenario.heading')}
                  </h3>
                  <ul class="mt-4 space-y-3" role="list">
                    {extras?.runs.map(({ name, ret, result }) => (
                      <li key={name} class="rounded-xl border border-line p-4">
                        <div class="flex items-baseline justify-between gap-3">
                          <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                          <span class="font-semibold num">{formatMoney(result.sip.net)}</span>
                        </div>
                        <p class="mt-1 text-sm text-ink-muted">
                          {t(locale, 'saving.scenario.return', { value: formatPercent(ret) })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
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
