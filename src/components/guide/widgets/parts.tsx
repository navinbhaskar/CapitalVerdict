/**
 * Building blocks for the small calculators inside guides: a frame, sliders, a choice of options
 * and a row of results. Each calculator runs the same model as the full tool, with the guide's
 * example as its starting point.
 */
import { useId } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t } from '@/i18n/t';

export function Frame({
  title,
  children,
  toolPath,
}: {
  title: string;
  children: ComponentChildren;
  /** The full calculator, linked under the results. */
  toolPath?: string;
}) {
  const id = useId();
  return (
    <section
      class="not-prose mt-8 mb-8 rounded-xl border border-accent/50 bg-raised p-4 sm:p-5"
      aria-labelledby={id}
    >
      <p class="text-sm text-accent-strong">{t('en', 'guide.tryIt')}</p>
      <h3 id={id} class="mt-0.5 font-display text-xl font-medium">
        {title}
      </h3>
      {children}
      {toolPath && (
        <p class="mt-4 border-t border-line pt-3 text-sm">
          <a href={toolPath} class="link">
            {t('en', 'guide.fullTool')}
          </a>
        </p>
      )}
    </section>
  );
}

/** The inputs, two to a row from the sm breakpoint. */
export function Inputs({ children }: { children: ComponentChildren }) {
  return <div class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>;
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  /** The value as text, e.g. "₹15 lakh" or "8%". */
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const fill = `${(((value - min) / (max - min)) * 100).toFixed(1)}%`;
  return (
    <div>
      <div class="flex items-baseline justify-between gap-3">
        <label for={id} class="text-sm text-ink-muted">
          {label}
        </label>
        <span class="font-medium num">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        class="range mt-1 w-full"
        style={{ '--fill': fill }}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}

export function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset class="sm:col-span-2">
      <legend class="text-sm text-ink-muted">{label}</legend>
      <div class="mt-1.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={String(o.value)}
            class="relative inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-strong px-4 text-sm transition-colors duration-(--duration-fast) has-checked:border-accent has-checked:bg-accent-soft has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-accent"
          >
            <input
              type="radio"
              class="sr-only"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The answers: label over figure, the main one in brass. Announced politely as they change. */
export function Results({
  items,
  children,
}: {
  items: { label: string; value: string; main?: boolean }[];
  /** A sentence or bars under the figures. */
  children?: ComponentChildren;
}) {
  return (
    <div class="mt-5 border-t border-line pt-4" aria-live="polite">
      <dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {items.map((i) => (
          <div key={i.label}>
            <dt class="text-sm text-ink-muted">{i.label}</dt>
            <dd
              class={`mt-0.5 font-display text-lg font-medium num ${i.main ? 'text-accent-strong' : ''}`}
            >
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

/** One plain sentence under the results. */
export function Verdict({ children }: { children: ComponentChildren }) {
  return <p class="mt-3 text-sm">{children}</p>;
}
