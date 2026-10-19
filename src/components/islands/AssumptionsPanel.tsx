import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { cityIds } from '@/data';
import { RATE_LIMITS, type GlobalAssumptions } from '@/lib/assumptions';
import { parsePercent, toPercentText } from '@/lib/percent';
import { useGlobalAssumptions } from '@/lib/useAssumptions';

type RateKey = keyof typeof RATE_LIMITS;
type SaveState = 'idle' | 'saved' | 'notSaved';

interface Props {
  locale: Locale;
}

export default function AssumptionsPanel({ locale }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { assumptions, update, reset } = useGlobalAssumptions();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [formKey, setFormKey] = useState(0);
  const titleId = useId();

  const commit = (next: GlobalAssumptions) => setSaveState(update(next) ? 'saved' : 'notSaved');
  const set = <K extends keyof GlobalAssumptions>(key: K, value: GlobalAssumptions[K]) =>
    commit({ ...assumptions, [key]: value });

  const open = () => {
    setSaveState('idle');
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const rateField = (key: RateKey, label: MessageKey, nullable: boolean) => (
    <PercentField
      key={`${key}-${formKey}`}
      locale={locale}
      label={t(locale, label)}
      value={assumptions[key]}
      max={RATE_LIMITS[key]}
      nullable={nullable}
      onCommit={(value) => set(key, value as never)}
    />
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        class="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-ink-muted transition-colors duration-200 hover:bg-surface hover:text-ink"
      >
        <SlidersIcon />
        <span class="sr-only sm:not-sr-only">{t(locale, 'assumptions.open')}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialogRef.current && close()}
        class="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md overflow-y-auto border-l border-line bg-page p-0 text-ink backdrop:bg-[#1c2b39]/30"
      >
        <div class="flex min-h-full flex-col">
          <div class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-page px-5 py-4">
            <h2 id={titleId} class="text-lg font-semibold">
              {t(locale, 'assumptions.title')}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t(locale, 'assumptions.close')}
              class="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>

          <div class="flex-1 space-y-8 px-5 py-6">
            <p class="text-[0.9375rem] text-ink-muted">{t(locale, 'assumptions.intro')}</p>

            <Group title={t(locale, 'assumptions.group.location')}>
              <SelectField
                label={t(locale, 'assumptions.state')}
                value={assumptions.state}
                options={[{ value: 'UP', label: t(locale, 'state.UP') }]}
                onChange={(v) => set('state', v as GlobalAssumptions['state'])}
              />
              <SelectField
                label={t(locale, 'assumptions.city')}
                value={assumptions.city ?? ''}
                options={[
                  { value: '', label: t(locale, 'assumptions.cityNone') },
                  ...cityIds.map((id) => ({
                    value: id,
                    label: t(locale, `city.${id}` as MessageKey),
                  })),
                ]}
                onChange={(v) => set('city', v === '' ? null : v)}
              />
            </Group>

            <Group title={t(locale, 'assumptions.group.tax')}>
              <SelectField
                label={t(locale, 'assumptions.taxRegime')}
                value={assumptions.taxRegime}
                options={[
                  { value: 'new', label: t(locale, 'taxRegime.new') },
                  { value: 'old', label: t(locale, 'taxRegime.old') },
                ]}
                onChange={(v) => set('taxRegime', v as GlobalAssumptions['taxRegime'])}
              />
              {rateField('marginalTaxRate', 'assumptions.marginalTaxRate', true)}
            </Group>

            <Group title={t(locale, 'assumptions.group.economy')}>
              {rateField('inflation', 'assumptions.inflation', false)}
              {rateField('equityReturn', 'assumptions.equityReturn', false)}
              {rateField('fdRate', 'assumptions.fdRate', true)}
            </Group>

            <Group title={t(locale, 'assumptions.group.loans')}>
              {rateField('homeLoanRate', 'assumptions.homeLoanRate', true)}
              {rateField('carLoanRate', 'assumptions.carLoanRate', false)}
            </Group>
          </div>

          <div class="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page px-5 py-4">
            <p class="text-sm text-ink-muted" aria-live="polite">
              {saveState === 'saved' && t(locale, 'assumptions.saved')}
              {saveState === 'notSaved' && t(locale, 'assumptions.notSaved')}
              {saveState === 'idle' && t(locale, 'assumptions.privacy')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSaveState(reset() ? 'saved' : 'notSaved');
                setFormKey((k) => k + 1);
              }}
              class="inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 text-sm font-medium hover:bg-surface"
            >
              {t(locale, 'assumptions.reset')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <fieldset class="space-y-4">
      <legend class="mb-3 text-xs font-medium tracking-[0.08em] text-ink-muted uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

const inputClass =
  'min-h-11 w-full rounded-md border border-line-strong bg-page px-3 text-ink transition-colors duration-200 hover:border-ink-subtle focus:border-accent-strong';

function SelectField(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label for={id} class="mb-1.5 block text-[0.9375rem] font-medium">
        {props.label}
      </label>
      <select
        id={id}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        class={inputClass}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PercentField(props: {
  locale: Locale;
  label: string;
  value: number | null;
  max: number;
  nullable: boolean;
  onCommit: (value: number | null) => void;
}) {
  const { locale, label, value, max, nullable, onCommit } = props;
  const id = useId();
  const [text, setText] = useState(toPercentText(value));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // Follow outside changes (stored values loading, another tab) unless the user is typing here.
  useEffect(() => {
    if (!focused) {
      setText(toPercentText(value));
      setError(null);
    }
  }, [value, focused]);

  const onInput = (raw: string) => {
    setText(raw);
    const parsed = parsePercent(raw, max, nullable);
    if (parsed.ok) {
      setError(null);
      if (parsed.value !== value) onCommit(parsed.value);
    } else {
      setError(t(locale, 'assumptions.error.range', { min: 0, max: toPercentText(max) }));
    }
  };

  const hint = value === null && !error ? t(locale, 'assumptions.notSet') : null;

  return (
    <div>
      <label for={id} class="mb-1.5 block text-[0.9375rem] font-medium">
        {label}
      </label>
      <div class="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onInput={(e) => onInput(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          class={`${inputClass} pr-24 num ${error ? 'border-danger' : ''}`}
        />
        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
          {t(locale, 'assumptions.perYear')}
        </span>
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} class={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-ink-muted'}`}>
          {error ?? hint}
        </p>
      )}
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
