import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { defaults, verifiedFuelPrices } from '@/data';
import { decodeShare, encodeShare } from '@/lib/shareLink';
import { formatNumber, formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import {
  carFuelFlips,
  carFuelScenarios,
  defaultPriceRiseShifts,
  type CarFuelVariable,
} from '@/models/carFuel';
import {
  CAR_FUEL_EXAMPLE_FORM,
  CAR_FUEL_LIMITS,
  carFuelShareSchema,
  invalidFields,
  toCarFuelInput,
  type CarFuelForm,
} from '@/models/carFuelForm';
import NumberField from '@/components/tool/NumberField';
import VerdictCard from '@/components/tool/VerdictCard';
import CumulativeChart from '@/components/tool/CumulativeChart';
import SensitivityList, { type FlipLine } from '@/components/tool/SensitivityList';
import NonMoneyChecklist from '@/components/tool/NonMoneyChecklist';
import ShareLink from '@/components/tool/ShareLink';

interface Props {
  locale: Locale;
}

const SHIFTS = defaultPriceRiseShifts(defaults.scenarioVariables.energyPriceRise.values);
const CHECKLIST: MessageKey[] = [
  'checklist.carFuel.1',
  'checklist.carFuel.2',
  'checklist.carFuel.3',
  'checklist.carFuel.4',
  'checklist.carFuel.5',
];

export default function CarFuelTool({ locale }: Props) {
  const [form, setForm] = useState<CarFuelForm>(CAR_FUEL_EXAMPLE_FORM);
  const [ready, setReady] = useState(false);
  const [shareHref, setShareHref] = useState('');
  /** Fields the user (or a shared link) has set; global assumptions never overwrite these. */
  const pinned = useRef(new Set<keyof CarFuelForm>());
  const { assumptions } = useGlobalAssumptions();

  const set = (key: keyof CarFuelForm) => (value: number | null) => {
    pinned.current.add(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Restore a shared scenario from the URL.
  useEffect(() => {
    const fromUrl = decodeShare(window.location.search, carFuelShareSchema);
    for (const key of Object.keys(fromUrl) as (keyof CarFuelForm)[]) pinned.current.add(key);
    setForm((f) => ({ ...f, ...fromUrl }));
    setReady(true);
  }, []);

  // Fill unpinned fields from the global assumptions panel.
  const cityPrices = verifiedFuelPrices(assumptions.city);
  useEffect(() => {
    if (!ready) return;
    setForm((f) => {
      const next = { ...f };
      if (!pinned.current.has('interestRate')) next.interestRate = assumptions.carLoanRate;
      if (cityPrices && !pinned.current.has('petrolPrice')) next.petrolPrice = cityPrices.petrol;
      if (cityPrices && !pinned.current.has('cngPrice')) next.cngPrice = cityPrices.cng;
      return next;
    });
  }, [ready, assumptions.carLoanRate, cityPrices?.petrol, cityPrices?.cng]);

  // Keep the URL in step so the address bar is always a shareable link.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const query = encodeShare(form, carFuelShareSchema);
      const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', url);
      setShareHref(window.location.href);
    }, 250);
    return () => clearTimeout(timer);
  }, [form, ready]);

  const input = useMemo(() => toCarFuelInput(form), [form]);
  const computed = useMemo(() => {
    if (!input) return null;
    return { runs: carFuelScenarios(input, SHIFTS), flips: carFuelFlips(input) };
  }, [input]);

  const petrol = t(locale, 'fuel.petrol');
  const cng = t(locale, 'fuel.cng');
  const invalid = new Set(invalidFields(form));

  const reset = () => {
    pinned.current.clear();
    setForm({ ...CAR_FUEL_EXAMPLE_FORM, interestRate: assumptions.carLoanRate });
  };

  const field = (
    key: keyof CarFuelForm,
    label: MessageKey,
    unit: string,
    extra: { percent?: boolean; integer?: boolean; help?: MessageKey } = {},
  ) => (
    <NumberField
      locale={locale}
      label={t(locale, label)}
      unit={unit}
      value={form[key]}
      onChange={set(key)}
      {...CAR_FUEL_LIMITS[key]}
      percent={extra.percent}
      integer={extra.integer}
      help={extra.help ? t(locale, extra.help) : undefined}
    />
  );

  const flipLines: FlipLine[] =
    computed && input
      ? computed.flips.map((flip) => {
          const side = flip.signBelow === -1 ? 'below' : 'above';
          const fmt = formatFlipValue(locale, flip.variable);
          return {
            text: t(locale, `flip.${flip.variable}.${side}` as MessageKey, {
              base: petrol,
              value: fmt(flip.threshold),
            }),
            current: fmt(currentValue(input, flip.variable)),
          };
        })
      : [];

  const base = computed?.runs.base.output;

  return (
    <div>
      <div class="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
        <div>
          <div class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
            <p class="max-w-sm">
              {assumptions.city && !cityPrices
                ? t(locale, 'carFuel.cityPriceUnverified', {
                    city: t(locale, `city.${assumptions.city}` as MessageKey),
                  })
                : t(locale, 'carFuel.exampleNotice')}
            </p>
            <button
              type="button"
              onClick={reset}
              class="-my-1 inline-flex min-h-10 items-center rounded-md px-2 font-medium text-accent-strong hover:bg-page"
            >
              {t(locale, 'carFuel.resetExample')}
            </button>
          </div>

          <h2 class="mt-8 text-lg font-semibold">{t(locale, 'carFuel.quickInputs')}</h2>
          <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {field('monthlyKm', 'input.monthlyKm', t(locale, 'input.monthlyKm.unit'))}
            {field('extraPrice', 'input.extraPrice', t(locale, 'input.extraPrice.unit'))}
            {field('petrolMileage', 'input.petrolMileage', t(locale, 'input.petrolMileage.unit'))}
            {field('cngMileage', 'input.cngMileage', t(locale, 'input.cngMileage.unit'))}
          </div>

          <details
            class="group mt-6 border-t border-line pt-2"
            open={invalid.size > 0 ? true : undefined}
          >
            <summary class="flex min-h-12 cursor-pointer list-none items-center justify-between font-medium">
              {t(locale, 'carFuel.moreInputs')}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                class="text-ink-muted transition-transform duration-200 group-open:rotate-180"
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
            </summary>
            <div class="mt-3 grid gap-5 pb-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {field('petrolPrice', 'input.petrolPrice', t(locale, 'input.petrolPrice.unit'))}
              {field('cngPrice', 'input.cngPrice', t(locale, 'input.cngPrice.unit'))}
              <div class="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                {field('interestRate', 'input.interestRate', '%', {
                  percent: true,
                  help: 'input.interestRate.help',
                })}
              </div>
              {field('petrolPriceRise', 'input.petrolPriceRise', '%', { percent: true })}
              {field('cngPriceRise', 'input.cngPriceRise', '%', { percent: true })}
              {field('petrolUpkeep', 'input.petrolUpkeep', t(locale, 'input.upkeep.unit'))}
              {field('cngUpkeep', 'input.cngUpkeep', t(locale, 'input.upkeep.unit'))}
              {field('horizonYears', 'input.horizonYears', t(locale, 'input.horizonYears.unit'), {
                integer: true,
              })}
            </div>
          </details>
        </div>

        <div class="lg:sticky lg:top-24">
          {computed && input ? (
            <VerdictCard
              locale={locale}
              input={input}
              runs={computed.runs}
              baseName={petrol}
              altName={cng}
            />
          ) : (
            <div
              class="rounded-2xl border border-dashed border-line-strong p-7 text-ink-muted"
              role="status"
            >
              {t(locale, 'carFuel.incomplete')}
            </div>
          )}
          {shareHref && computed && (
            <div class="mt-4">
              <ShareLink locale={locale} url={shareHref} />
            </div>
          )}
        </div>
      </div>

      {computed && input && base && (
        <>
          <div class="mt-16 grid gap-10 border-t border-line pt-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-12">
            <CumulativeChart
              locale={locale}
              saving={base.cumulativeSaving}
              cost={base.extraPriceWithInterest}
              bandLow={computed.runs.pessimistic.output.cumulativeSaving}
              bandHigh={computed.runs.optimistic.output.cumulativeSaving}
              breakevenMonth={base.breakevenWithInterest?.months ?? null}
            />
            <section aria-labelledby="scenarios-heading">
              <h2 id="scenarios-heading" class="text-lg font-semibold">
                {t(locale, 'scenario.heading')}
              </h2>
              <ul class="mt-4 space-y-3" role="list">
                {(['pessimistic', 'base', 'optimistic'] as const).map((name) => {
                  const run = computed.runs[name];
                  const months = run.output.breakevenWithInterest?.months;
                  return (
                    <li
                      key={name}
                      class={`rounded-xl border p-4 ${name === 'base' ? 'border-line-strong bg-page' : 'border-line'}`}
                    >
                      <div class="flex items-baseline justify-between gap-3">
                        <span class="font-medium">{t(locale, `scenario.${name}`)}</span>
                        <span class="font-semibold num">
                          {months === undefined
                            ? t(locale, 'verdict.notWithin', { years: input.horizonMonths / 12 })
                            : t(locale, 'unit.months', { n: months })}
                        </span>
                      </div>
                      <p class="mt-1 text-sm text-ink-muted">
                        {t(locale, 'scenario.priceRise', {
                          rate: formatPercent(run.input.alternative.annualPriceRise),
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div class="mt-16 grid gap-12 border-t border-line pt-10 lg:grid-cols-2">
            <SensitivityList locale={locale} lines={flipLines} />
            <NonMoneyChecklist locale={locale} items={CHECKLIST.map((k) => t(locale, k))} />
          </div>
        </>
      )}
    </div>
  );
}

function formatFlipValue(locale: Locale, variable: CarFuelVariable): (v: number) => string {
  switch (variable) {
    case 'monthlyKm':
      return (v) => t(locale, 'unit.km', { n: formatNumber(v) });
    case 'baseEnergyPrice':
      return (v) => t(locale, 'unit.perLitre', { n: formatNumber(v, 2) });
    case 'alternativeEnergyPrice':
      return (v) => t(locale, 'unit.perKg', { n: formatNumber(v, 2) });
    case 'alternativeMileage':
      return (v) => t(locale, 'unit.kmPerKg', { n: formatNumber(v, 1) });
  }
}

function currentValue(input: NonNullable<ReturnType<typeof toCarFuelInput>>, v: CarFuelVariable) {
  switch (v) {
    case 'monthlyKm':
      return input.monthlyKm;
    case 'baseEnergyPrice':
      return input.base.energyPrice;
    case 'alternativeEnergyPrice':
      return input.alternative.energyPrice;
    case 'alternativeMileage':
      return input.alternative.mileage;
  }
}
