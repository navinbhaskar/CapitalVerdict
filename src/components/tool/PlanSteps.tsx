import type { ComponentChildren, JSX } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import {
  INCOME_FREQUENCIES,
  LUMP_SLOTS,
  PAY_FREQUENCIES,
  PLAN_SHAPES,
  lumpKeys,
  type PlanForm,
  type PlanNumberKey,
} from '@/models/planReturnForm';
import Tier from './Tier';

export interface PlanFieldOpts {
  label?: string;
  note?: string;
  optional?: boolean;
  flagged?: boolean;
}

interface Props {
  locale: Locale;
  form: PlanForm;
  /** Prefix for radio group names, so two tools on one page would not clash. */
  idPrefix: string;
  /** Bumped when the steps are replaced from outside, so the lump sum rows remount. */
  rev: number;
  slots: number;
  onShape: (shape: PlanForm['shape']) => void;
  onPayFrequency: (f: PlanForm['payFrequency']) => void;
  onIncomeFrequency: (f: PlanForm['incomeFrequency']) => void;
  onAddSlot: () => void;
  onRemoveSlot: (slot: number) => void;
  field: (key: PlanNumberKey, opts?: PlanFieldOpts) => JSX.Element;
}

/**
 * The plan's three steps (what you pay, a regular income, lump sums) and the ready-made shapes,
 * shared by the plan return calculator and the term-plus-investing comparison.
 */
export default function PlanSteps({
  locale,
  form,
  idPrefix,
  rev,
  slots,
  onShape,
  onPayFrequency,
  onIncomeFrequency,
  onAddSlot,
  onRemoveSlot,
  field,
}: Props) {
  return (
    <>
      <fieldset class="mt-4">
        <legend class="text-sm font-medium">{t(locale, 'plan.shape.label')}</legend>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          {PLAN_SHAPES.map((shape) => (
            <label
              key={shape}
              class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm transition-colors duration-(--duration-fast) ease-out-quart hover:border-ink-subtle has-[:checked]:border-accent-strong has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-strong"
            >
              <input
                type="radio"
                name={`${idPrefix}-shape`}
                value={shape}
                checked={form.shape === shape}
                onChange={() => onShape(shape)}
                class="size-4 shrink-0 accent-(--color-accent-strong)"
              />
              <span class="font-medium text-ink">
                {t(locale, `plan.shape.${shape}` as MessageKey)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Tier tone="yours" title={t(locale, 'plan.step.pay')} hint={t(locale, 'plan.step.payHint')}>
        <Segmented
          label={t(locale, 'plan.freq.pay')}
          name={`${idPrefix}-pay-frequency`}
          options={PAY_FREQUENCIES.map((f) => ({
            value: f,
            label: t(locale, `plan.freq.${f}` as MessageKey),
          }))}
          value={form.payFrequency}
          onChange={onPayFrequency}
        />
        {field('premium', {
          label: t(locale, `plan.in.premium.${form.payFrequency}` as MessageKey),
          note: t(locale, `plan.note.premium.${form.payFrequency}` as MessageKey),
        })}
        {form.payFrequency !== 'once' && field('payYears')}
      </Tier>

      <Tier
        tone="yours"
        title={t(locale, 'plan.step.income')}
        hint={t(locale, 'plan.step.incomeHint')}
      >
        {field('income', {
          label: t(locale, `plan.in.income.${form.incomeFrequency}` as MessageKey),
          optional: true,
        })}
        {form.income !== null && (
          <>
            <Segmented
              label={t(locale, 'plan.freq.income')}
              name={`${idPrefix}-income-frequency`}
              options={INCOME_FREQUENCIES.map((f) => ({
                value: f,
                label: t(locale, `plan.freq.${f}` as MessageKey),
              }))}
              value={form.incomeFrequency}
              onChange={onIncomeFrequency}
            />
            {field('incomeStartYear')}
            {field('incomeYears')}
          </>
        )}
      </Tier>

      <Tier tone="yours" title={t(locale, 'plan.step.lump')} hint={t(locale, 'plan.step.lumpHint')}>
        {Array.from({ length: slots }, (_, i) => i + 1).map((slot) => {
          const [amount, year] = lumpKeys(slot);
          return (
            <div key={`${slot}-${rev}`} class="py-1">
              <div class="flex items-center justify-between gap-3 pt-2">
                <p class="text-sm font-medium text-ink-muted">
                  {t(locale, 'plan.lump.title', { n: slot })}
                </p>
                {(slots > 1 || form[amount] !== null || form[year] !== null) && (
                  <button
                    type="button"
                    onClick={() => onRemoveSlot(slot)}
                    class="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-accent-strong hover:bg-surface"
                    aria-label={t(locale, 'plan.lump.removeLabel', { n: slot })}
                  >
                    {t(locale, 'plan.lump.remove')}
                  </button>
                )}
              </div>
              <div class="divide-y divide-line">
                {field(amount, {
                  label: t(locale, 'plan.in.lump'),
                  note: t(locale, 'plan.note.lump'),
                  optional: true,
                })}
                {field(year, {
                  label: t(locale, 'plan.in.lumpYear'),
                  note: t(locale, 'plan.note.lumpYear'),
                  optional: form[amount] === null,
                })}
              </div>
            </div>
          );
        })}
        {slots < LUMP_SLOTS && (
          <div class="py-2">
            <button
              type="button"
              onClick={onAddSlot}
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
              {t(locale, 'plan.lump.add')}
            </button>
          </div>
        )}
      </Tier>
    </>
  );
}

/** The last lump sum slot in use, so the form shows that many rows. */
export function filledSlots(form: PlanForm): number {
  let last = 0;
  for (let s = 1; s <= LUMP_SLOTS; s++) {
    const [amount, year] = lumpKeys(s);
    if (form[amount] !== null || form[year] !== null) last = s;
  }
  return last;
}

/** The form with lump sum `slot` removed and the later ones moved up. */
export function withoutSlot<F extends PlanForm>(form: F, slot: number): F {
  const next = { ...form };
  for (let s = slot; s <= LUMP_SLOTS; s++) {
    const [amount, year] = lumpKeys(s);
    const [nextAmount, nextYear] = s < LUMP_SLOTS ? lumpKeys(s + 1) : [null, null];
    next[amount] = nextAmount ? form[nextAmount] : null;
    next[year] = nextYear ? form[nextYear] : null;
  }
  return next;
}

export function Segmented<T extends string>({
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
        class="mt-2 grid w-full gap-1 rounded-lg bg-surface p-1 sm:mt-0 sm:max-w-xs"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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

export function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <fieldset class="mt-4">
      <legend class="w-full border-b border-line-strong pb-1.5 font-display text-lg font-medium">
        {title}
      </legend>
      <div class="divide-y divide-line">{children}</div>
    </fieldset>
  );
}
