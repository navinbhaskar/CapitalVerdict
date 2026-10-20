import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, verifiedStampDuty } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { rentBuyFlips, rentBuyScenarios, rentVsBuy, type RentBuyVariable } from '@/models/rentBuy';
import {
  RENT_BUY_LIMITS,
  RENT_BUY_START_FORM,
  invalidRentBuyFields,
  rentBuyShareSchema,
  toRentBuyInput,
  type RentBuyForm,
} from '@/models/rentBuyForm';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable, { type MonthlyColumn } from '@/components/tool/MonthlyTable';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';

interface Props {
  locale: Locale;
}

const TABLE = defaults.scenarioVariables;
const SETS = {
  appreciation: TABLE.propertyAppreciation.values,
  rentGrowth: TABLE.rentGrowth.values,
};
const CHECKLIST: MessageKey[] = [
  'rentBuy.checklist.1',
  'rentBuy.checklist.2',
  'rentBuy.checklist.3',
  'rentBuy.checklist.4',
  'rentBuy.checklist.5',
];

export default function RentBuyTool({ locale }: Props) {
  const [form, setForm] = useState<RentBuyForm>(RENT_BUY_START_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof RentBuyForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof RentBuyForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, rentBuyShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof RentBuyForm)[]) pinned.current.add(key);
    setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Global assumptions fill unpinned fields: home-loan rate and inflation.
  useEffect(() => {
    if (!ready) return;
    setForm((f) => ({
      ...f,
      ...(!pinned.current.has('loanRate') && assumptions.homeLoanRate !== null
        ? { loanRate: assumptions.homeLoanRate }
        : {}),
      ...(!pinned.current.has('inflation') ? { inflation: assumptions.inflation } : {}),
    }));
  }, [ready, assumptions.homeLoanRate, assumptions.inflation]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), rentBuyShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toRentBuyInput(form), [form]);
  const computed = useMemo(() => {
    if (!input) return null;
    const result = rentVsBuy(input);
    const runs = rentBuyScenarios(input, SETS);
    const all = (['pessimistic', 'base', 'optimistic'] as const).map(
      (s) => runs[s].output.difference,
    );
    return {
      result,
      runs,
      flips: rentBuyFlips(input),
      bandLow: all[0]!.map((_, m) => Math.min(...all.map((s) => s[m]!))),
      bandHigh: all[0]!.map((_, m) => Math.max(...all.map((s) => s[m]!))),
    };
  }, [input]);

  const years = form.horizonYears ?? 15;
  const missing = invalidRentBuyFields(form);
  const cash = form.downPayment === 1;

  const QUICK: (keyof RentBuyForm)[] = [
    'homePrice',
    'monthlyRent',
    'loanRate',
    'stampDuty',
    'maintenance',
    'sellingCost',
    'investmentReturn',
    'horizonYears',
  ];
  const quickInvalid = missing.filter((k) => QUICK.includes(k));
  const refineInvalid = missing.some((k) => !QUICK.includes(k));

  const field = (
    key: keyof RentBuyForm,
    label: MessageKey,
    unit: string,
    note: string,
    extra: {
      percent?: boolean;
      integer?: boolean;
      flagged?: boolean;
      optional?: boolean;
      layout?: 'row' | 'stack';
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
      {...RENT_BUY_LIMITS[key]}
      {...extra}
      layout={extra.layout ?? 'row'}
    />
  );

  const r = computed?.result;
  const buyWins = r ? r.atHorizon.difference >= 0 : false;

  const upfrontRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'rentBuy.w.price'), value: formatINR(input.homePrice) },
          {
            label: t(locale, 'rentBuy.w.downPayment'),
            formula: `${formatINR(input.homePrice)} × ${formatPercent(input.downPayment)}`,
            value: formatINR(input.homePrice * input.downPayment),
          },
          {
            label: t(locale, 'rentBuy.w.stampDuty'),
            formula: `${formatINR(input.homePrice)} × ${formatPercent(input.stampDuty)}`,
            value: formatINR(input.homePrice * input.stampDuty),
          },
          { label: t(locale, 'rentBuy.w.other'), value: formatINR(input.otherUpfront) },
          {
            label: t(locale, 'rentBuy.w.upfront'),
            value: formatINR(r.upfrontCash),
            strong: true,
          },
          { label: t(locale, 'rentBuy.w.loan'), value: formatINR(r.loanAmount) },
          {
            label: t(locale, 'rentBuy.w.renterStart'),
            formula: `${formatINR(r.upfrontCash)} − ${formatINR(input.securityDeposit)}`,
            value: formatINR(r.upfrontCash - input.securityDeposit),
          },
        ]
      : [];

  const monthRows: WorkingRow[] =
    r && input
      ? [
          ...(cash
            ? []
            : [
                {
                  label: t(locale, 'rentBuy.w.emi'),
                  formula: t(locale, 'rentBuy.w.emiFormula', {
                    loan: formatINR(r.loanAmount),
                    rate: formatPercent(input.loanRate),
                    years: input.loanYears,
                  }),
                  value: formatINR(r.emi),
                },
              ]),
          {
            label: t(locale, 'rentBuy.w.maintenance'),
            formula: `${formatINR(input.homePrice)} × ${formatPercent(input.maintenance)} ÷ 12`,
            value: formatINR((input.homePrice * input.maintenance) / 12),
          },
          {
            label: t(locale, 'rentBuy.w.propertyTax'),
            formula: `${formatINR(input.propertyTax)} ÷ 12`,
            value: formatINR(input.propertyTax / 12),
          },
          {
            label: t(locale, 'rentBuy.w.ownerOutflow'),
            value: formatINR(r.buyerOutflow[0]!),
            strong: true,
          },
          { label: t(locale, 'rentBuy.w.rent'), value: formatINR(r.rent[0]!) },
          {
            label:
              r.buyerOutflow[0]! >= r.rent[0]!
                ? t(locale, 'rentBuy.w.renterInvests')
                : t(locale, 'rentBuy.w.buyerInvests'),
            formula: `${formatINR(Math.max(r.buyerOutflow[0]!, r.rent[0]!))} − ${formatINR(Math.min(r.buyerOutflow[0]!, r.rent[0]!))}`,
            value: formatINR(Math.abs(r.buyerOutflow[0]! - r.rent[0]!)),
            strong: true,
          },
        ]
      : [];

  const endRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'rentBuy.w.homeValue'),
            formula: `${formatINR(input.homePrice)} × (1 + ${formatPercent(input.appreciation)})^${years}`,
            value: formatMoney(r.end.homeValue),
          },
          { label: t(locale, 'rentBuy.w.loanLeft'), value: `−${formatMoney(r.end.outstanding)}` },
          {
            label: t(locale, 'rentBuy.w.sellingCost'),
            value: `−${formatMoney(r.end.sellingCost)}`,
          },
          {
            label: t(locale, 'rentBuy.w.buyerInvestments'),
            value: formatMoney(r.end.buyerInvestments),
          },
          {
            label: t(locale, 'rentBuy.w.buyerNet'),
            value: formatMoney(r.atHorizon.buyer),
            strong: true,
          },
          {
            label: t(locale, 'rentBuy.w.renterInvestments'),
            value: formatMoney(r.end.renterInvestments),
          },
          {
            label: t(locale, 'rentBuy.w.deposit'),
            value: formatMoney(input.securityDeposit),
          },
          {
            label: t(locale, 'rentBuy.w.renterNet'),
            value: formatMoney(r.atHorizon.renter),
            strong: true,
          },
        ]
      : [];

  const flipLines: FlipLine[] =
    computed && input
      ? computed.flips.map((flip) => {
          const side = flip.signBelow === -1 ? 'below' : 'above';
          const fmt = formatRentBuyValue(flip.variable);
          return {
            text: t(locale, `rentBuy.flip.${flip.variable}.${side}` as MessageKey, {
              years,
              value: fmt(flip.threshold),
            }),
            current: fmt(input[flip.variable]),
          };
        })
      : [];

  const columns: MonthlyColumn[] = r
    ? [
        { label: t(locale, 'rentBuy.col.homeValue'), kind: 'money', values: r.homeValue },
        { label: t(locale, 'rentBuy.col.loanLeft'), kind: 'money', values: r.outstanding },
        { label: t(locale, 'rentBuy.col.ownerOutflow'), kind: 'money', values: r.buyerOutflow },
        ...(r.prepaid.some((x) => x > 0)
          ? [{ label: t(locale, 'rentBuy.col.prepaid'), kind: 'money' as const, values: r.prepaid }]
          : []),
        { label: t(locale, 'rentBuy.col.rent'), kind: 'money', values: r.rent },
        { label: t(locale, 'rentBuy.col.buyerNet'), kind: 'money', values: r.buyerNetWorth },
        { label: t(locale, 'rentBuy.col.renterNet'), kind: 'money', values: r.renterNetWorth },
        {
          label: t(locale, 'rentBuy.col.difference'),
          kind: 'money',
          values: r.difference.slice(1),
        },
      ]
    : [];

  const headline = r
    ? buyWins
      ? t(locale, 'rentBuy.verdict.buy', { amount: formatMoney(r.atHorizon.difference), years })
      : t(locale, 'rentBuy.verdict.rent', { amount: formatMoney(-r.atHorizon.difference), years })
    : '';

  return (
    <div>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="rb-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="rb-inputs-heading" class="font-display text-xl font-semibold">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm(RENT_BUY_START_FORM);
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'solar.clear')}
            </button>
          </div>
          <p class="mt-1 text-sm text-ink-muted">{t(locale, 'inputs.quickLegend')}</p>

          <Group title={t(locale, 'rentBuy.group.essentials')}>
            {field('homePrice', 'rentBuy.in.homePrice', '₹', t(locale, 'rentBuy.note.homePrice'))}
            {field(
              'monthlyRent',
              'rentBuy.in.monthlyRent',
              '₹',
              t(locale, 'rentBuy.note.monthlyRent'),
            )}
            {!cash &&
              field(
                'loanRate',
                'rentBuy.in.loanRate',
                t(locale, 'assumptions.perYear'),
                t(locale, 'rentBuy.note.loanRate'),
                {
                  percent: true,
                  flagged: assumptions.homeLoanRate === null && form.loanRate === null,
                },
              )}
            {field('stampDuty', 'rentBuy.in.stampDuty', '%', t(locale, 'rentBuy.note.stampDuty'), {
              percent: true,
              flagged: verifiedStampDuty() === null,
            })}
            {field(
              'maintenance',
              'rentBuy.in.maintenance',
              '%',
              t(locale, 'rentBuy.note.maintenance'),
              {
                percent: true,
                flagged: true,
              },
            )}
            {field(
              'sellingCost',
              'rentBuy.in.sellingCost',
              '%',
              t(locale, 'rentBuy.note.sellingCost'),
              {
                percent: true,
                flagged: true,
              },
            )}
            {field(
              'investmentReturn',
              'rentBuy.in.investmentReturn',
              '%',
              t(locale, 'rentBuy.note.investmentReturn'),
              { percent: true, flagged: true },
            )}
            {field(
              'horizonYears',
              'rentBuy.in.horizon',
              t(locale, 'input.horizonYears.unit'),
              t(locale, 'rentBuy.note.horizon'),
              { integer: true },
            )}
          </Group>

          <Refine
            locale={locale}
            storageKey="dw.refine.rentBuy"
            hint={t(locale, 'rentBuy.refineHint')}
            forceOpen={refineInvalid && quickInvalid.length === 0}
          >
            <Group title={t(locale, 'rentBuy.group.home')}>
              {field(
                'downPayment',
                'rentBuy.in.downPayment',
                '%',
                t(locale, 'rentBuy.note.downPayment'),
                {
                  percent: true,
                },
              )}
              {field(
                'otherUpfront',
                'rentBuy.in.otherUpfront',
                '₹',
                t(locale, 'rentBuy.note.otherUpfront'),
                {
                  optional: true,
                },
              )}
            </Group>

            {!cash && (
              <Group title={t(locale, 'rentBuy.group.loan')}>
                {field(
                  'loanYears',
                  'rentBuy.in.loanYears',
                  t(locale, 'input.horizonYears.unit'),
                  t(locale, 'rentBuy.note.loanYears'),
                  { integer: true },
                )}
                {field(
                  'prepayYearly',
                  'rentBuy.in.prepayYearly',
                  t(locale, 'input.upkeep.unit'),
                  t(locale, 'rentBuy.note.prepayYearly'),
                  { optional: true },
                )}
                {field(
                  'monthlyIncome',
                  'rentBuy.in.monthlyIncome',
                  '₹',
                  t(locale, 'rentBuy.note.monthlyIncome'),
                  { optional: true },
                )}
              </Group>
            )}

            <Group title={t(locale, 'rentBuy.group.owning')}>
              {field(
                'propertyTax',
                'rentBuy.in.propertyTax',
                t(locale, 'input.upkeep.unit'),
                t(locale, 'rentBuy.note.propertyTax'),
                { optional: true },
              )}
              {field(
                'securityDeposit',
                'rentBuy.in.securityDeposit',
                '₹',
                t(locale, 'rentBuy.note.securityDeposit'),
                { optional: true },
              )}
            </Group>

            <Group title={t(locale, 'rentBuy.group.money')} columns>
              {field(
                'appreciation',
                'rentBuy.in.appreciation',
                '%',
                t(locale, 'rentBuy.note.appreciation'),
                {
                  percent: true,
                  layout: 'stack',
                },
              )}
              {field(
                'rentGrowth',
                'rentBuy.in.rentGrowth',
                '%',
                t(locale, 'rentBuy.note.rentGrowth'),
                {
                  percent: true,
                  layout: 'stack',
                },
              )}
              {field(
                'inflation',
                'rentBuy.in.inflation',
                '%',
                t(locale, 'rentBuy.note.inflation'),
                {
                  percent: true,
                  layout: 'stack',
                },
              )}
            </Group>

            <div class="mt-4 flex items-start justify-between gap-4 rounded-lg bg-surface px-3 py-2.5">
              <div>
                <p class="text-sm font-medium">{t(locale, 'rentBuy.taxToggle')}</p>
                <p class="mt-0.5 text-xs text-ink-muted">{t(locale, 'rentBuy.taxToggleNote')}</p>
              </div>
              <span class="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
                {t(locale, 'rentBuy.taxToggleOff')}
              </span>
            </div>
          </Refine>
        </section>

        <div class="lg:sticky lg:top-20">
          {computed && r && input ? (
            <section
              id="verdict"
              aria-labelledby="rb-verdict-heading"
              class="scroll-mt-24 rounded-xl bg-raised p-4 shadow-raised sm:p-5"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="rb-verdict-heading"
                class="mt-1 font-display text-xl font-semibold sm:text-2xl sm:font-medium"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, 'rentBuy.verdict.today', {
                  amount: formatMoney(Math.abs(r.atHorizon.differenceToday)),
                })}{' '}
                {r.crossover
                  ? t(locale, 'rentBuy.verdict.crossover', {
                      year: formatNumber(Math.ceil(r.crossover.years)),
                    })
                  : buyWins
                    ? ''
                    : t(locale, 'rentBuy.verdict.noCrossover', { years })}
              </p>
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'rentBuy.stat.buyer', { years })}>
                  {formatMoney(r.atHorizon.buyer)}
                </Stat>
                <Stat label={t(locale, 'rentBuy.stat.renter', { years })}>
                  {formatMoney(r.atHorizon.renter)}
                </Stat>
                <Stat label={t(locale, 'rentBuy.stat.outflow')}>
                  {formatMoney(r.buyerOutflow[0]!)}
                </Stat>
                <Stat label={t(locale, 'rentBuy.stat.rent')}>{formatMoney(r.rent[0]!)}</Stat>
                {(() => {
                  const ap = computed.flips.find((f) => f.variable === 'appreciation');
                  return (
                    <Stat label={t(locale, 'rentBuy.stat.neededAppreciation')}>
                      {ap ? formatPercent(ap.threshold) : '—'}
                    </Stat>
                  );
                })()}
                {!cash && (
                  <Stat label={t(locale, 'rentBuy.stat.interestPaid', { years })}>
                    {formatMoney(r.interestPaid)}
                  </Stat>
                )}
                {!cash && (
                  <Stat label={t(locale, 'rentBuy.stat.loanEnds')}>
                    {r.loanPaidOffMonth === null
                      ? t(locale, 'rentBuy.stat.loanAfter', { years })
                      : t(locale, 'rentBuy.stat.loanYear', {
                          year: Math.ceil(r.loanPaidOffMonth / 12),
                        })}
                  </Stat>
                )}
                {!cash && form.monthlyIncome !== null && (
                  <Stat label={t(locale, 'rentBuy.stat.emiShare')}>
                    {formatPercent(r.emi / form.monthlyIncome)}
                  </Stat>
                )}
              </dl>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'rentBuy.stat.note')}</p>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'rentBuy.needInputs')}</p>
              <p class="mt-2 text-sm">{t(locale, 'solar.stillMissing', { n: missing.length })}</p>
            </div>
          )}
          {shareHref && computed && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} />
            </div>
          )}
          <ScenarioShelf
            locale={locale}
            tool="rentBuy"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && input
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    {
                      label: t(locale, 'rentBuy.in.homePrice'),
                      value: formatMoney(input.homePrice),
                    },
                    {
                      label: t(locale, 'rentBuy.in.monthlyRent'),
                      value: formatMoney(input.monthlyRent),
                    },
                    {
                      label: t(locale, 'rentBuy.in.investmentReturn'),
                      value: formatPercent(input.investmentReturn),
                    },
                    {
                      label: t(locale, 'rentBuy.in.appreciation'),
                      value: formatPercent(input.appreciation),
                    },
                    {
                      label: t(locale, 'rentBuy.stat.buyer', { years }),
                      value: formatMoney(r.atHorizon.buyer),
                    },
                    {
                      label: t(locale, 'rentBuy.stat.renter', { years }),
                      value: formatMoney(r.atHorizon.renter),
                    },
                  ]
                : null
            }
          />
        </div>
      </div>

      {computed && r && input && (
        <>
          <section class="mt-10 border-t border-line pt-6" aria-labelledby="rb-working">
            <h2 id="rb-working" class="font-display text-xl font-semibold">
              {t(locale, 'working.heading')}
            </h2>
            <div class="mt-4 grid gap-4 lg:grid-cols-3">
              <WorkingBlock title={t(locale, 'rentBuy.w.upfrontTitle')} rows={upfrontRows} />
              <WorkingBlock title={t(locale, 'rentBuy.w.monthTitle')} rows={monthRows}>
                {t(locale, 'rentBuy.w.monthNote')}
              </WorkingBlock>
              <WorkingBlock title={t(locale, 'rentBuy.w.endTitle', { years })} rows={endRows} />
            </div>
          </section>

          <div class="mt-10 grid gap-6 border-t border-line pt-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
            <NetPositionChart
              locale={locale}
              title={t(locale, 'rentBuy.chart.title')}
              netWithInterest={r.difference}
              bandLow={computed.bandLow}
              bandHigh={computed.bandHigh}
              breakevenWithInterest={r.crossover?.months ?? null}
              labels={{
                main: t(locale, 'rentBuy.chart.main'),
                band: t(locale, 'rentBuy.chart.band'),
              }}
            />
            <section aria-labelledby="rb-scenarios">
              <h2 id="rb-scenarios" class="font-display text-xl font-semibold">
                {t(locale, 'scenario.heading')}
              </h2>
              <ul class="mt-4 space-y-3" role="list">
                {(['pessimistic', 'base', 'optimistic'] as const).map((name) => {
                  const run = computed.runs[name];
                  const d = run.output.atHorizon.difference;
                  return (
                    <li key={name} class="rounded-xl border border-line p-4">
                      <div class="flex items-baseline justify-between gap-3">
                        <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                        <span class={`font-semibold num ${d < 0 ? 'text-danger' : ''}`}>
                          {formatMoney(d)}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-ink-muted">
                        {t(locale, 'rentBuy.scenario.rates', {
                          home: formatPercent(run.input.appreciation),
                          rent: formatPercent(run.input.rentGrowth),
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p class="mt-3 text-xs text-ink-muted">{t(locale, 'rentBuy.scenario.note')}</p>
            </section>
          </div>

          <div class="mt-10 border-t border-line pt-6">
            <MonthlyTable
              locale={locale}
              columns={columns}
              highlight={r.crossover ? [r.crossover.months] : []}
              csvFilename="decidewise-rent-vs-buy.csv"
            />
          </div>

          <div class="mt-10 grid gap-8 border-t border-line pt-6 lg:grid-cols-2">
            <SensitivityList locale={locale} lines={flipLines} />
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>
        </>
      )}
    </div>
  );
}

function Group({
  title,
  children,
  columns = false,
}: {
  title: string;
  children: ComponentChildren;
  columns?: boolean;
}) {
  return (
    <fieldset class="mt-4">
      <legend class="w-full border-b border-line-strong pb-1.5 font-display text-base font-semibold">
        {title}
      </legend>
      <div class={columns ? 'grid gap-x-4 gap-y-3 pt-3 sm:grid-cols-2' : 'divide-y divide-line'}>
        {children}
      </div>
    </fieldset>
  );
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-sm text-ink-muted">{label}</dt>
      <dd class="mt-0.5 font-semibold num">{children}</dd>
    </div>
  );
}

function formatRentBuyValue(variable: RentBuyVariable): (v: number) => string {
  switch (variable) {
    case 'monthlyRent':
      return (v) => formatMoney(v);
    default:
      return (v) => formatPercent(v);
  }
}
