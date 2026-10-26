import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { stateOfCity, tariffFor, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare, pickKeys } from '@/lib/shareLink';
import { formatINR } from '@/lib/format';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import { EXAMPLE_PRICE_CITY } from '@/models/carFuel.example';
import { compareScooters } from '@/models/scooter';
import {
  SCOOTER_EXAMPLE_KEYS,
  SCOOTER_INTEGER_KEYS,
  SCOOTER_LIMITS,
  invalidScooterFields,
  scooterExampleForm,
  scooterIncentives,
  scooterShareSchema,
  toScooterInput,
  type ScooterForm,
  type ScooterNumberKey,
} from '@/models/scooterForm';
import CompareBars from '@/components/tool/CompareBars';
import ExampleNote from '@/components/tool/ExampleNote';
import ResultBar from '@/components/tool/ResultBar';
import Tier from '@/components/tool/Tier';
import NumberField from '@/components/tool/NumberField';
import WorkingBlock, { type WorkingRow } from '@/components/tool/WorkingBlock';
import NetPositionChart from '@/components/tool/NetPositionChart';
import MonthlyTable, { type MonthlyColumn } from '@/components/tool/MonthlyTable';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';
import Refine from '@/components/tool/Refine';
import ScenarioShelf from '@/components/tool/ScenarioShelf';
import MoreDetail from '@/components/tool/MoreDetail';

interface Props {
  locale: Locale;
}

/** Today, for the incentive year. */
const TODAY = new Date().toISOString().slice(0, 10);
const CHECKLIST = [1, 2, 3, 4].map((n) => `scooter.checklist.${n}` as MessageKey);
const DISTANCES = [300, 500, 750, 1000, 1500];
const PERCENT = new Set<ScooterNumberKey>([
  'ppacRate',
  'petrolPriceRise',
  'tariffRise',
  'interestRate',
]);
/** Shown in the first tiers; the rest sit in the Refine panel. */
const REFINE: ScooterNumberKey[] = [
  'fuelPrice',
  'petrolUpkeep',
  'evUpkeep',
  'batteryCost',
  'batteryYear',
  'ppacRate',
  'petrolPriceRise',
  'tariffRise',
  'interestRate',
  'years',
];
const UNIT: Partial<Record<ScooterNumberKey, MessageKey>> = {
  monthlyKm: 'scooter.unit.kmMonth',
  petrolMileage: 'scooter.unit.kmL',
  fuelPrice: 'scooter.unit.perL',
  kmPerUnit: 'scooter.unit.kmUnit',
  batteryKWh: 'scooter.unit.kWh',
  otherUnits: 'ac.unit.unitsMonth',
  pricePerUnit: 'ac.unit.perUnit',
  years: 'input.horizonYears.unit',
  batteryYear: 'scooter.unit.year',
  petrolUpkeep: 'scooter.unit.perYear',
  evUpkeep: 'scooter.unit.perYear',
};

/** An e-scooter against a petrol scooter: does cheaper running earn back the extra price? */
export default function ScooterTool({ locale }: Props) {
  const { assumptions } = useGlobalAssumptions();
  const city = assumptions.city ?? EXAMPLE_PRICE_CITY;
  const state = stateOfCity(assumptions.city);
  const cityPetrol = verifiedFuelPrices(city)?.petrol ?? null;
  const TARIFF = useMemo(() => tariffFor(state), [state]);
  const [form, setForm] = useState<ScooterForm>(() =>
    scooterExampleForm(verifiedFuelPrices(EXAMPLE_PRICE_CITY)?.petrol ?? null),
  );
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  const pinned = useRef(new Set<keyof ScooterForm>());
  const exampleKeys = SCOOTER_EXAMPLE_KEYS.filter((k) =>
    TARIFF ? true : k !== 'otherUnits' && k !== 'sanctionedLoadKW',
  );

  const set =
    <K extends keyof ScooterForm>(key: K) =>
    (value: ScooterForm[K]) => {
      pinned.current.add(key);
      setForm((f) => ({ ...f, [key]: value }));
    };

  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, scooterShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof ScooterForm)[]) pinned.current.add(key);
    if (Object.keys(fromUrl).length > 0) setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // The petrol price and the interest follow Assumptions (city, car-loan rate) unless set here.
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      let next = f;
      if (!pinned.current.has('fuelPrice') && cityPetrol !== null && f.fuelPrice !== cityPetrol)
        next = { ...next, fuelPrice: cityPetrol };
      if (!pinned.current.has('interestRate') && f.interestRate !== assumptions.carLoanRate)
        next = { ...next, interestRate: assumptions.carLoanRate };
      return next;
    });
  }, [ready, cityPetrol, assumptions.carLoanRate]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(pickKeys(form, pinned.current), scooterShareSchema);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toScooterInput(form, TARIFF, state, TODAY), [form, TARIFF, state]);
  const r = useMemo(() => (input ? compareScooters(input) : null), [input]);
  const inc = scooterIncentives(form, state, TODAY);
  const byDistance = useMemo(
    () =>
      input
        ? DISTANCES.map((km) => ({
            km,
            current: km === input.monthlyKm,
            net: compareScooters({ ...input, monthlyKm: km }).comparison.netAtHorizon.withInterest,
          }))
        : [],
    [input],
  );

  const years = form.years ?? 7;
  const missing = invalidScooterFields(form, TARIFF !== null);
  const refineInvalid = missing.some((k) => REFINE.includes(k));
  const quickInvalid = missing.some((k) => !REFINE.includes(k));
  const isExample = exampleKeys.some((k) => !pinned.current.has(k));

  const field = (
    key: ScooterNumberKey,
    extra: { optional?: boolean; flagged?: boolean; note?: string } = {},
  ) => (
    <NumberField
      locale={locale}
      name={key}
      label={t(locale, `scooter.in.${key}` as MessageKey)}
      unit={
        PERCENT.has(key)
          ? '%'
          : key === 'sanctionedLoadKW'
            ? 'kW'
            : UNIT[key]
              ? t(locale, UNIT[key]!)
              : '₹'
      }
      note={extra.note ?? t(locale, `scooter.note.${key}` as MessageKey)}
      value={form[key]}
      onChange={(v) => set(key)(v)}
      example={exampleKeys.includes(key) && !pinned.current.has(key)}
      {...SCOOTER_LIMITS[key]}
      percent={PERCENT.has(key)}
      integer={SCOOTER_INTEGER_KEYS.has(key)}
      optional={extra.optional}
      flagged={extra.flagged}
      layout="row"
    />
  );

  const check = (key: 'subsidyOptIn' | 'claimState' | 'scrapping', label: string, note: string) => (
    <label class="flex min-h-11 cursor-pointer items-start gap-3 py-3 text-sm">
      <input
        type="checkbox"
        name={key}
        checked={form[key]}
        onChange={(e) => set(key)(e.currentTarget.checked)}
        class="mt-0.5 size-5 shrink-0 accent-(--color-accent-strong)"
      />
      <span>
        <span class="block font-medium">{label}</span>
        <span class="mt-0.5 block text-ink-muted">{note}</span>
      </span>
    </label>
  );

  const c = r?.comparison;
  let headline = '';
  if (r && c) {
    if (r.extraPrice <= 0) {
      headline = t(
        locale,
        c.firstMonthSaving > 0 ? 'scooter.verdict.cheaperBoth' : 'scooter.verdict.cheaperToBuy',
      );
    } else if (c.firstMonthSaving <= 0) {
      headline = t(locale, 'scooter.verdict.noSaving');
    } else if (c.breakevenWithInterest) {
      headline = t(locale, 'scooter.verdict.payback', {
        time: formatDuration(locale, c.breakevenWithInterest.months),
      });
    } else {
      headline = t(locale, 'scooter.verdict.never', { years });
    }
  }
  const net = c?.netAtHorizon.withInterest ?? 0;

  const runningRows: WorkingRow[] =
    r && input
      ? [
          {
            label: t(locale, 'scooter.w.petrol'),
            formula: `${formatNumber(input.monthlyKm)} ÷ ${formatNumber(input.petrol.mileage)} × ₹${formatNumber(input.petrol.fuelPrice, 2)}`,
            value: formatINR(r.petrolPerMonth),
          },
          {
            label: t(locale, 'scooter.w.units'),
            formula: `${formatNumber(input.monthlyKm)} ÷ ${formatNumber(input.ev.kmPerUnit)}`,
            value: t(locale, 'scooter.unitsValue', { n: formatNumber(r.unitsPerMonth, 1) }),
          },
          ...(r.billWithout !== null && r.billWith !== null
            ? [
                {
                  label: t(locale, 'scooter.w.billWithout'),
                  value: formatINR(r.billWithout),
                },
                {
                  label: t(locale, 'scooter.w.billWith'),
                  value: formatINR(r.billWith),
                },
              ]
            : []),
          {
            label: t(locale, 'scooter.w.charging'),
            formula:
              r.billWithout !== null
                ? t(locale, 'scooter.w.chargingBill')
                : `${formatNumber(r.unitsPerMonth, 1)} × ₹${formatNumber(r.costPerUnit, 2)}`,
            value: formatINR(r.chargingPerMonth),
          },
          {
            label: t(locale, 'scooter.w.saving'),
            formula: t(locale, 'scooter.w.savingFormula'),
            value: formatINR(c!.firstMonthSaving),
            strong: true,
          },
        ]
      : [];

  const priceRows: WorkingRow[] =
    r && input
      ? [
          { label: t(locale, 'scooter.w.evPrice'), value: formatINR(input.ev.price) },
          ...(input.refunds.state > 0
            ? [
                {
                  label: t(locale, 'scooter.w.state'),
                  formula: t(locale, 'scooter.w.stateFormula', {
                    kwh: formatNumber(form.batteryKWh ?? 0, 1),
                  }),
                  value: `−${formatINR(input.refunds.state)}`,
                },
              ]
            : []),
          ...(input.refunds.scrapping > 0
            ? [
                {
                  label: t(locale, 'scooter.w.scrapping'),
                  value: `−${formatINR(input.refunds.scrapping)}`,
                },
              ]
            : []),
          { label: t(locale, 'scooter.w.petrolPrice'), value: `−${formatINR(input.petrol.price)}` },
          {
            label: t(locale, 'scooter.w.extra'),
            value: formatINR(r.extraPrice),
            strong: true,
          },
        ]
      : [];

  const endRows: WorkingRow[] =
    r && c && input
      ? [
          {
            label: t(locale, 'scooter.w.totalSaving', { years }),
            value: formatMoney(c.cumulativeSaving[c.cumulativeSaving.length - 1]!),
          },
          {
            label: t(locale, 'scooter.w.extraWithInterest', {
              rate: formatPercent(input.interestRate),
            }),
            value: `−${formatMoney(c.extraPriceWithInterest[c.extraPriceWithInterest.length - 1]!)}`,
          },
          { label: t(locale, 'scooter.w.net'), value: formatMoney(net), strong: true },
        ]
      : [];

  const columns: MonthlyColumn[] = c
    ? [
        { label: t(locale, 'scooter.col.petrol'), kind: 'money', values: c.monthlyCost.base },
        {
          label: t(locale, 'scooter.col.ev'),
          kind: 'money',
          values: c.monthlyCost.alternative,
        },
        {
          label: t(locale, 'scooter.col.cumulative'),
          kind: 'money',
          values: c.cumulativeSaving.slice(1),
        },
        {
          label: t(locale, 'scooter.col.net'),
          kind: 'money',
          values: c.cumulativeSaving.slice(1).map((s, i) => s - c.extraPriceWithInterest[i + 1]!),
        },
      ]
    : [];

  return (
    <div>
      <ResultBar locale={locale} headline={headline} />
      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-10">
        <section aria-labelledby="scooter-inputs-heading">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="scooter-inputs-heading" class="font-display text-2xl font-medium">
              {t(locale, 'inputs.heading')}
            </h2>
            <button
              type="button"
              onClick={() => {
                pinned.current.clear();
                setForm({
                  ...scooterExampleForm(cityPetrol),
                  interestRate: assumptions.carLoanRate,
                });
              }}
              class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>

          <Tier
            tone="yours"
            title={t(locale, 'scooter.step.scooters')}
            hint={t(locale, 'scooter.step.scootersHint')}
          >
            {field('monthlyKm')}
            {field('petrolPrice')}
            {field('petrolMileage')}
            {field('evPrice')}
            {field('kmPerUnit', { flagged: true })}
            {field('batteryKWh')}
          </Tier>

          <Tier
            tone="check"
            title={t(locale, 'scooter.step.power')}
            hint={t(locale, 'scooter.step.powerHint')}
          >
            {TARIFF ? (
              <>
                {field('otherUnits')}
                {field('sanctionedLoadKW', { note: t(locale, 'ac.note.load') })}
                {TARIFF.subsidy &&
                  check(
                    'subsidyOptIn',
                    t(locale, 'solar.in.subsidyOptIn'),
                    t(locale, 'scooter.note.subsidyOptIn'),
                  )}
              </>
            ) : (
              field('pricePerUnit', { flagged: true })
            )}
            {inc.statePossible > 0 &&
              check(
                'claimState',
                t(locale, 'scooter.in.claimState', { amount: formatINR(inc.statePossible) }),
                t(locale, 'scooter.note.claimState'),
              )}
            {inc.scrappingPossible > 0 &&
              check(
                'scrapping',
                t(locale, 'scooter.in.scrapping', { amount: formatINR(inc.scrappingPossible) }),
                t(locale, 'scooter.note.scrapping'),
              )}
            {inc.central > 0 && (
              <p class="py-3 text-sm text-ink-muted">
                {t(locale, 'scooter.centralNote', { amount: formatINR(inc.central) })}
              </p>
            )}
          </Tier>

          <Refine
            locale={locale}
            storageKey="dw.refine.scooter"
            hint={t(locale, 'scooter.summary', {
              petrol: `₹${formatNumber(form.fuelPrice ?? 0, 2)}`,
              rise: formatPercent(form.petrolPriceRise ?? 0),
              rate: formatPercent(form.interestRate ?? 0),
              years,
            })}
            forceOpen={refineInvalid && !quickInvalid}
          >
            <Group title={t(locale, 'scooter.group.running')}>
              {field('fuelPrice')}
              {field('petrolUpkeep', { optional: true })}
              {field('evUpkeep', { optional: true })}
              {field('batteryCost', { optional: true })}
              {form.batteryCost !== null && field('batteryYear')}
              {TARIFF && field('ppacRate', { optional: true, note: t(locale, 'solar.note.ppac') })}
            </Group>
            <Group title={t(locale, 'scooter.group.money')}>
              {field('petrolPriceRise')}
              {field('tariffRise')}
              {field('interestRate')}
              {field('years')}
            </Group>
          </Refine>
        </section>

        <div class="order-first lg:sticky lg:top-20 lg:order-none">
          {r && c && input ? (
            <section
              id="verdict"
              aria-labelledby="scooter-verdict-heading"
              class="band-dark scroll-mt-24 rounded-xl p-5 shadow-raised sm:p-6"
            >
              <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
              <h2
                id="scooter-verdict-heading"
                class="mt-1 font-display text-2xl font-medium tracking-(--tracking-heading)"
                aria-live="polite"
              >
                <span key={headline} class="tick block">
                  {headline}
                </span>
              </h2>
              <p class="mt-2 text-ink-muted">
                {t(locale, net >= 0 ? 'scooter.verdict.ahead' : 'scooter.verdict.behind', {
                  amount: formatMoney(Math.abs(net)),
                  years,
                })}
              </p>
              <p class="mt-2 font-medium">
                {t(locale, 'scooter.verdict.running', {
                  petrol: formatINR(r.petrolPerMonth),
                  ev: formatINR(r.chargingPerMonth),
                })}
              </p>
              {r.billWithout !== null && (
                <p class="mt-2 text-ink-muted">
                  {t(locale, 'scooter.verdict.perUnit', {
                    rate: `₹${r.costPerUnit.toFixed(2)}`,
                  })}
                </p>
              )}
              {isExample && (
                <ExampleNote
                  locale={locale}
                  text={t(locale, 'scooter.exampleNote')}
                  inputsId="scooter-inputs-heading"
                />
              )}
              <CompareBars
                caption={t(locale, 'scooter.compare', { years })}
                items={[
                  {
                    label: t(locale, 'scooter.bar.petrol'),
                    value: c.totalCost!.base[c.totalCost!.base.length - 1]!,
                    display: formatMoney(c.totalCost!.base[c.totalCost!.base.length - 1]!),
                    best: net < 0,
                  },
                  {
                    label: t(locale, 'scooter.bar.ev'),
                    value: c.totalCost!.alternative[c.totalCost!.alternative.length - 1]!,
                    display: formatMoney(
                      c.totalCost!.alternative[c.totalCost!.alternative.length - 1]!,
                    ),
                    best: net >= 0,
                  },
                ]}
              />
              <p class="mt-2 text-xs text-ink-muted">{t(locale, 'scooter.compareNote')}</p>
              <dl class="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-line pt-4">
                <Stat label={t(locale, 'scooter.stat.extra')}>{formatMoney(r.extraPrice)}</Stat>
                <Stat label={t(locale, 'scooter.stat.saving')}>
                  {formatMoney(c.firstMonthSaving)}
                </Stat>
                <Stat label={t(locale, 'scooter.stat.simple')}>
                  {r.extraPrice > 0 && c.breakevenNoInterest
                    ? formatDuration(locale, c.breakevenNoInterest.months)
                    : '—'}
                </Stat>
                <Stat label={t(locale, 'scooter.stat.units')}>
                  {t(locale, 'scooter.unitsValue', { n: formatNumber(r.unitsPerMonth, 1) })}
                </Stat>
              </dl>
            </section>
          ) : (
            <div
              class="rounded-xl border border-dashed border-line-strong p-5 text-ink-muted"
              role="status"
            >
              <p>{t(locale, 'scooter.needInputs')}</p>
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
            tool="scooter"
            query={shareHref ? new URL(shareHref).search : ''}
            summary={
              r && c
                ? [
                    { label: t(locale, 'scenarios.row.answer'), value: headline },
                    { label: t(locale, 'scooter.stat.extra'), value: formatMoney(r.extraPrice) },
                    {
                      label: t(locale, 'scooter.stat.saving'),
                      value: formatMoney(c.firstMonthSaving),
                    },
                  ]
                : null
            }
          />
        </div>
      </div>

      {r && c && input && (
        <>
          <div class="mt-8 grid gap-6 border-t border-line pt-5 lg:grid-cols-2">
            <section aria-labelledby="scooter-distance">
              <h2 id="scooter-distance" class="font-display text-2xl font-medium">
                {t(locale, 'scooter.distance.heading')}
              </h2>
              <p class="mt-1 text-sm text-ink-muted">
                {t(locale, 'scooter.distance.intro', { years })}
              </p>
              <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
                {byDistance.map((row) => (
                  <li
                    key={row.km}
                    class="flex items-baseline justify-between gap-4 py-2.5"
                    aria-current={row.current ? 'true' : undefined}
                  >
                    <span class={row.current ? 'font-medium text-ink' : 'text-ink-muted'}>
                      {t(locale, 'scooter.distance.row', { km: formatNumber(row.km) })}
                    </span>
                    <span
                      class={`num ${row.current ? 'font-semibold text-accent-strong' : 'font-medium'}`}
                    >
                      {t(locale, row.net >= 0 ? 'scooter.distance.ev' : 'scooter.distance.petrol', {
                        amount: formatMoney(Math.abs(row.net)),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>

          <div class="mt-6 border-t border-line">
            <MoreDetail title={t(locale, 'detail.working')} hint={t(locale, 'detail.workingHint')}>
              <div class="grid gap-4 lg:grid-cols-3">
                <WorkingBlock title={t(locale, 'scooter.w.runningTitle')} rows={runningRows} />
                <WorkingBlock title={t(locale, 'scooter.w.priceTitle')} rows={priceRows} />
                <WorkingBlock title={t(locale, 'scooter.w.endTitle', { years })} rows={endRows} />
              </div>
            </MoreDetail>

            <MoreDetail
              defaultOpen
              title={t(locale, 'detail.chart')}
              hint={t(locale, 'detail.chartHint')}
            >
              <NetPositionChart
                locale={locale}
                title={t(locale, 'scooter.chart.title')}
                netWithInterest={c.cumulativeSaving.map((s, m) => s - c.extraPriceWithInterest[m]!)}
                netNoInterest={c.cumulativeSaving.map((s) => s - r.extraPrice)}
                breakevenWithInterest={
                  r.extraPrice > 0 ? (c.breakevenWithInterest?.months ?? null) : null
                }
                breakevenNoInterest={
                  r.extraPrice > 0 ? (c.breakevenNoInterest?.months ?? null) : null
                }
              />
            </MoreDetail>

            <MoreDetail title={t(locale, 'detail.monthly')} hint={t(locale, 'detail.monthlyHint')}>
              <MonthlyTable
                locale={locale}
                columns={columns}
                highlight={
                  r.extraPrice > 0 && c.breakevenWithInterest
                    ? [c.breakevenWithInterest.months]
                    : []
                }
                csvFilename="capitalverdict-scooter.csv"
              />
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
