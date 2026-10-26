import { useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { cityIds, fuelPrices, verifiedCityIds, verifiedFuelPrices } from '@/data';
import { EXAMPLE_PRICE_CITY } from '@/models/carFuel.example';
import {
  DEFAULT_ASSUMPTIONS,
  RATE_LIMITS,
  type AssumptionKey,
  type GlobalAssumptions,
} from '@/lib/assumptions';
import { formatPercent } from '@/lib/formatTool';
import { useGlobalAssumptions } from '@/lib/useAssumptions';
import NumberField from '@/components/tool/NumberField';
import { TOOL_GROUPS, toolKey } from '@/lib/tools';
import { localizePath } from '@/i18n/routes';

type RateKey = keyof typeof RATE_LIMITS;
type SaveState = 'idle' | 'saved' | 'notSaved';

interface Props {
  locale: Locale;
}

/** Which live tools read each assumption. Keep in step with the tools. */
const USED_BY: Partial<Record<AssumptionKey, MessageKey[]>> = {
  city: ['tool.carFuel.title', 'tool.scooter.title'],
  carLoanRate: ['tool.carFuel.title', 'tool.carLoan.title', 'tool.ac.title', 'tool.scooter.title'],
  homeLoanRate: ['tool.rentVsBuy.title', 'tool.prepay.title'],
  inflation: [
    'tool.rentVsBuy.title',
    'tool.prepay.title',
    'tool.carLoan.title',
    'tool.plotVs.title',
    'tool.saving.title',
    'tool.sip.title',
    'tool.lumpsum.title',
    'tool.swp.title',
    'tool.planReturn.title',
    'tool.termPlan.title',
  ],
};
/** What each setting changes, in one line. */
const WHAT: Partial<Record<AssumptionKey, MessageKey>> = {
  city: 'assumptions.what.city',
  inflation: 'assumptions.what.inflation',
  carLoanRate: 'assumptions.what.carLoanRate',
  homeLoanRate: 'assumptions.what.homeLoanRate',
};

/** A calculator's page, from its title key. */
const TOOL_PATH = new Map(
  TOOL_GROUPS.flatMap((g) => g.tools).map((entry) => [toolKey(entry, 'title'), entry.path]),
);

/**
 * Settings shown in the panel: only those a live tool reads. Tax regime, marginal tax rate, equity
 * return and FD rate stay in storage but are hidden until a tool uses them.
 */
const SHOWN: AssumptionKey[] = ['city', 'inflation', 'carLoanRate', 'homeLoanRate'];

/** Fields the user has changed from the defaults. */
function changedKeys(a: GlobalAssumptions): AssumptionKey[] {
  return SHOWN.filter((k) => a[k] !== DEFAULT_ASSUMPTIONS[k]);
}

export default function AssumptionsPanel({ locale }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { assumptions, update, reset } = useGlobalAssumptions();
  // The state follows the city, or the example city until one is chosen.
  const stateOfCity =
    fuelPrices.cities.find((c) => c.id === (assumptions.city ?? EXAMPLE_PRICE_CITY))?.state ?? 'DL';
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmReset, setConfirmReset] = useState(false);
  /** Bumped on each save so the checkmark redraws, and on reset so fields reload. */
  const [savedTick, setSavedTick] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const titleId = useId();
  const changed = changedKeys(assumptions);

  // Latest values, so two quick changes in a row never overwrite each other.
  const latest = useRef(assumptions);
  latest.current = assumptions;

  const commit = (next: GlobalAssumptions) => {
    latest.current = next;
    setSaveState(update(next) ? 'saved' : 'notSaved');
    setSavedTick((n) => n + 1);
    setConfirmReset(false);
  };
  const set = <K extends AssumptionKey>(key: K, value: GlobalAssumptions[K]) =>
    commit({ ...latest.current, [key]: value });
  const resetOne = (key: AssumptionKey) => {
    set(key, DEFAULT_ASSUMPTIONS[key] as never);
    setFormKey((k) => k + 1);
  };

  const open = () => {
    setSaveState('idle');
    setConfirmReset(false);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  /** What the setting changes, then its default: the full list of tools sits under the field. */
  const noteFor = (key: AssumptionKey, defaultText: string | null) =>
    [WHAT[key] ? t(locale, WHAT[key]!) : null, defaultText].filter(Boolean).join(' ');

  const rateField = (key: RateKey, label: MessageKey, optional: boolean, unit: string) => {
    const d = DEFAULT_ASSUMPTIONS[key];
    const defaultText =
      d === null
        ? t(locale, 'assumptions.noDefault')
        : t(locale, 'assumptions.default', { value: formatPercent(d) }) + '.';
    return (
      <Row
        key={`${key}-${formKey}`}
        locale={locale}
        changed={changed.includes(key)}
        onReset={() => resetOne(key)}
      >
        <NumberField
          locale={locale}
          layout="row"
          name={key}
          label={t(locale, label)}
          unit={unit}
          note={noteFor(key, defaultText)}
          value={assumptions[key]}
          percent
          optional={optional}
          min={0}
          max={RATE_LIMITS[key]}
          onChange={(value, valid) => {
            if (valid && value !== assumptions[key]) set(key, value as never);
          }}
        />
        <UsedBy locale={locale} tools={USED_BY[key] ?? []} />
      </Row>
    );
  };

  const cityPricesVerified = verifiedFuelPrices(assumptions.city) !== null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        class="nav-pill sm:pr-3.5 sm:pl-2.5"
      >
        <SlidersIcon />
        <span class="sr-only sm:not-sr-only">{t(locale, 'assumptions.open')}</span>
        {changed.length > 0 && (
          <>
            <span
              class="absolute -top-0.5 left-6 size-2 rounded-full bg-accent ring-2 ring-page sm:left-7"
              aria-hidden="true"
            />
            <span class="sr-only">
              {t(locale, 'assumptions.changedCount', { n: changed.length })}
            </span>
          </>
        )}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialogRef.current && close()}
        class="assumptions-sheet fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md overflow-y-auto overscroll-contain bg-raised p-0 text-ink shadow-float backdrop:bg-scrim"
      >
        <div class="flex min-h-full flex-col">
          <header class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line px-5 py-3 glass">
            <div>
              <h2 id={titleId} class="font-display text-xl font-medium">
                {t(locale, 'assumptions.title')}
              </h2>
              <p class="mt-0.5 text-sm text-ink-muted">{t(locale, 'assumptions.privacy')}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t(locale, 'assumptions.close')}
              class="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-(--duration-fast) ease-out-quart hover:bg-surface hover:text-ink"
            >
              <CloseIcon />
            </button>
          </header>

          <div class="flex-1 px-5 pt-4 pb-6">
            <p class="text-sm text-ink-muted">{t(locale, 'assumptions.intro')}</p>

            <Group title={t(locale, 'assumptions.group.location')}>
              <Row
                key={`city-${formKey}`}
                locale={locale}
                changed={changed.includes('city')}
                onReset={() => resetOne('city')}
              >
                <SelectRow
                  label={t(locale, 'assumptions.city')}
                  note={[
                    assumptions.city && !cityPricesVerified
                      ? t(locale, 'assumptions.cityUnverified')
                      : noteFor('city', null),
                    t(
                      locale,
                      assumptions.city ? 'assumptions.stateFromCity' : 'assumptions.stateDefault',
                      {
                        state: t(locale, `state.${stateOfCity}` as MessageKey),
                      },
                    ),
                  ].join(' ')}
                  value={assumptions.city ?? ''}
                  options={[
                    { value: '', label: t(locale, 'assumptions.cityNone') },
                    // Cities without verified prices are listed but cannot be chosen yet.
                    ...cityIds.map((id) => {
                      const city = t(locale, `city.${id}` as MessageKey);
                      const verified = verifiedCityIds.includes(id);
                      return {
                        value: id,
                        label: verified ? city : t(locale, 'assumptions.cityNotVerified', { city }),
                        disabled: !verified,
                      };
                    }),
                  ]}
                  onChange={(v) => set('city', v === '' ? null : v)}
                />
                <UsedBy locale={locale} tools={USED_BY.city ?? []} />
              </Row>
            </Group>

            <Group title={t(locale, 'assumptions.group.economy')}>
              {rateField(
                'inflation',
                'assumptions.inflation',
                false,
                t(locale, 'assumptions.perYear'),
              )}
            </Group>

            <Group title={t(locale, 'assumptions.group.loans')}>
              {rateField(
                'carLoanRate',
                'assumptions.carLoanRate',
                false,
                t(locale, 'assumptions.perYear'),
              )}
              {rateField(
                'homeLoanRate',
                'assumptions.homeLoanRate',
                true,
                t(locale, 'assumptions.perYear'),
              )}
            </Group>
          </div>

          <footer class="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 glass">
            <p
              class="inline-flex min-h-6 items-center gap-1.5 text-sm text-ink-muted"
              aria-live="polite"
            >
              {saveState === 'saved' && (
                <>
                  <svg
                    key={savedTick}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    class="check-draw shrink-0 text-accent-strong"
                  >
                    <path
                      pathLength={1}
                      d="m5 12.5 4.5 4.5L19 7.5"
                      stroke="currentColor"
                      stroke-width="2.25"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  {t(locale, 'assumptions.saved')}
                </>
              )}
              {saveState === 'notSaved' && t(locale, 'assumptions.notSaved')}
              {saveState === 'idle' &&
                (changed.length > 0
                  ? t(locale, 'assumptions.changedCount', { n: changed.length })
                  : t(locale, 'assumptions.allDefaults'))}
            </p>
            {changed.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  setSaveState(reset() ? 'saved' : 'notSaved');
                  setSavedTick((n) => n + 1);
                  setFormKey((k) => k + 1);
                  setConfirmReset(false);
                }}
                class={`btn btn-outline ${confirmReset ? 'border-danger text-danger' : ''}`}
              >
                {confirmReset
                  ? t(locale, 'assumptions.resetConfirm')
                  : t(locale, 'assumptions.reset')}
              </button>
            )}
          </footer>
        </div>
      </dialog>
    </>
  );
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="mt-5">
      <h3 class="border-b border-line-strong pb-1.5 font-display text-lg font-medium">{title}</h3>
      <div class="divide-y divide-line">{children}</div>
    </section>
  );
}

/** The calculators that read a setting, folded away: names as links. */
function UsedBy({ locale, tools }: { locale: Locale; tools: MessageKey[] }) {
  if (tools.length === 0) {
    return <p class="-mt-1 pb-2.5 text-sm text-ink-muted">{t(locale, 'assumptions.notUsedYet')}</p>;
  }
  return (
    <details class="group -mt-1 pb-1.5">
      <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent-strong">
        {t(locale, tools.length === 1 ? 'assumptions.usedByOne' : 'assumptions.usedByCount', {
          n: tools.length,
        })}
        <svg
          class="size-4 transition-transform duration-(--duration-fast) ease-out-quart group-open:rotate-180"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </summary>
      <ul class="grid grid-cols-2 gap-x-4 pb-1" role="list">
        {tools.map((key) => {
          const path = TOOL_PATH.get(key);
          return (
            <li key={key}>
              {path ? (
                <a
                  href={localizePath(path, locale)}
                  class="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-accent-strong"
                >
                  {t(locale, key)}
                </a>
              ) : (
                <span class="inline-flex min-h-11 items-center text-sm text-ink-muted">
                  {t(locale, key)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** A field with a "Changed" marker and its own reset when it differs from the default. */
function Row(props: {
  locale: Locale;
  changed: boolean;
  onReset: () => void;
  children: ComponentChildren;
}) {
  return (
    <div class="relative">
      {props.children}
      {props.changed && (
        <p class="-mt-1 flex items-center gap-2 pb-2.5 text-sm">
          <span class="inline-flex items-center gap-1.5 text-accent-strong">
            <span class="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t(props.locale, 'assumptions.changed')}
          </span>
          <button type="button" onClick={props.onReset} class="link min-h-6 text-sm">
            {t(props.locale, 'assumptions.resetOne')}
          </button>
        </p>
      )}
    </div>
  );
}

function SelectRow(props: {
  label: string;
  note: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div class="grid gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
      <div>
        <label for={id} class="block text-sm font-medium">
          {props.label}
        </label>
        <p id={`${id}-note`} class="mt-0.5 text-sm text-ink-muted">
          {props.note}
        </p>
      </div>
      <select
        id={id}
        value={props.value}
        aria-describedby={`${id}-note`}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        class="min-h-11 w-full rounded-lg border border-line-strong bg-page px-3 text-base text-ink transition-colors duration-(--duration-fast) ease-out-quart hover:border-ink-subtle focus:border-accent-strong"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h10m4 0h2M4 17h4m4 0h8"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
      <circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.75" />
      <circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="1.75" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
    </svg>
  );
}
