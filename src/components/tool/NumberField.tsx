import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';
import {
  displayBounds,
  formatNumberText,
  parseNumberText,
  type NumberRules,
} from '@/lib/numberInput';
import { formatMoneyShort, formatNumber } from '@/lib/formatTool';

interface Props extends NumberRules {
  locale: Locale;
  label: string;
  /** Unit shown inside the field on the right, e.g. "km", "₹/L", "%". */
  unit?: string;
  /** Source or note shown under the label, like a spreadsheet's "Source / note" column. */
  note?: string;
  /** Marks the value as an assumption the user should check. */
  flagged?: boolean;
  /** The value is still the tool's example: labelled so nobody mistakes it for data. */
  example?: boolean;
  /** A slider under the field, in the field's own units (not for percent fields). */
  slider?: { min: number; max: number; step: number };
  /**
   * `stack`: label above the field. `row`: label and note on the left, field on the right
   * (from the sm breakpoint), like a row of an inputs table.
   */
  layout?: 'stack' | 'row';
  /** Form field name, e.g. the share-link key. */
  name?: string;
  value: number | null;
  /**
   * Called with the parsed value, or null while the text is invalid. `valid` tells an empty
   * optional field (valid null) apart from bad input (invalid null).
   */
  onChange: (value: number | null, valid: boolean) => void;
}

export default function NumberField(props: Props) {
  const {
    locale,
    label,
    unit,
    note,
    flagged,
    example,
    slider,
    layout = 'stack',
    value,
    onChange,
    ...rules
  } = props;
  const id = useId();
  const [text, setText] = useState(formatNumberText(value, rules));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const shakeRef = useRef<HTMLDivElement>(null);

  /** Restart the shake animation on the field wrapper (not a remount, so focus stays put). */
  const shake = () => {
    const el = shakeRef.current;
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  };

  // Follow outside changes (reset, shared link, global assumptions) unless the user is typing here.
  useEffect(() => {
    if (focused) return;
    if (value !== null) {
      setText(formatNumberText(value, rules));
      setError(null);
    }
  }, [value, focused]);

  const onInput = (raw: string) => {
    setText(raw);
    const parsed = parseNumberText(raw, rules);
    if (parsed.ok) {
      setError(null);
      onChange(parsed.value, true);
      return;
    }
    if (!error) shake();
    setError(
      parsed.reason === 'required'
        ? t(locale, 'input.error.required')
        : parsed.reason === 'notInteger'
          ? t(locale, 'input.error.integer')
          : t(locale, 'input.error.range', displayBounds(rules)),
    );
    onChange(null, false);
  };

  const row = layout === 'row';
  // Rupees read "₹ 10,000"; other units ("years", "%", "km") follow the number.
  const rupees = unit === '₹';
  // Big amounts also in words, the way they are said: 5000000 → "₹50 lakh".
  const words = rupees && value !== null && value >= 1e5 && !error ? formatMoneyShort(value) : null;
  const describedBy = [error && `${id}-err`, words && `${id}-words`, note && `${id}-note`]
    .filter(Boolean)
    .join(' ');
  const sliderValue = slider ? Math.min(slider.max, Math.max(slider.min, value ?? slider.min)) : 0;
  const fill = slider ? ((sliderValue - slider.min) / (slider.max - slider.min)) * 100 : 0;
  // Range ends: ₹ on both; any other unit on the upper end only ("1" … "40 years").
  const bound = (v: number, end: 'min' | 'max') =>
    rupees
      ? formatMoneyShort(v)
      : unit && end === 'max'
        ? `${formatNumber(v)} ${unit}`
        : formatNumber(v);

  return (
    <div
      class={
        row
          ? 'grid gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center sm:items-start'
          : ''
      }
    >
      <div>
        <label for={id} class={`block text-sm font-medium ${row ? '' : 'mb-1.5'}`}>
          {label}
          {example ? (
            <span class="ml-2 inline-flex items-center gap-1 align-[1px] text-xs font-medium text-accent-strong">
              <span class="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              {t(locale, 'inputs.example')}
            </span>
          ) : (
            flagged && (
              <span class="ml-2 inline-flex items-center gap-1 align-[1px] text-xs font-medium text-warn">
                <span class="size-1.5 rounded-full bg-warn" aria-hidden="true" />
                {t(locale, 'inputs.flag')}
              </span>
            )
          )}
        </label>
        {row && note && (
          <p id={`${id}-note`} class="mt-0.5 text-sm text-ink-muted">
            {note}
          </p>
        )}
      </div>
      <div>
        <div ref={shakeRef} class="relative">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            name={props.name}
            value={text}
            onInput={(e) => onInput(e.currentTarget.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              if (value !== null) setText(formatNumberText(value, rules));
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            class={`min-h-11 w-full rounded-md border text-base font-medium text-ink num transition-[border-color,box-shadow] duration-(--duration-fast) ease-out-quart hover:border-ink-subtle focus:border-accent-strong focus:ring-3 focus:ring-accent-soft focus:outline-none ${
              rupees ? 'pr-3 pl-8' : unit ? 'pr-16 pl-3' : 'px-3'
            } ${error ? 'border-danger' : 'border-line-strong'} ${
              flagged && !example ? 'bg-warn-soft/60' : 'bg-raised'
            }`}
          />
          {unit && (
            <span
              class={`pointer-events-none absolute inset-y-0 flex items-center text-sm text-ink-muted ${
                rupees ? 'left-3' : 'right-3.5'
              }`}
            >
              {unit}
            </span>
          )}
        </div>
        {words && (
          <p id={`${id}-words`} class="mt-1 text-xs text-ink-muted num">
            {words}
          </p>
        )}
        {slider && (
          <div class="mt-1.5">
            <input
              type="range"
              class="range w-full"
              style={{ '--fill': `${fill.toFixed(2)}%` }}
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={sliderValue}
              aria-label={label}
              aria-valuetext={rupees ? `₹${text}` : unit ? `${text} ${unit}` : text}
              onInput={(e) => {
                const v = Number(e.currentTarget.value);
                setError(null);
                setText(formatNumberText(v, rules));
                onChange(v, true);
              }}
            />
            <div class="flex justify-between text-xs text-ink-muted num" aria-hidden="true">
              <span>{bound(slider.min, 'min')}</span>
              <span>{bound(slider.max, 'max')}</span>
            </div>
          </div>
        )}
        {!row && note && !error && (
          <p id={`${id}-note`} class="mt-1 text-sm text-ink-muted">
            {note}
          </p>
        )}
        {error && (
          <p id={`${id}-err`} class="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
