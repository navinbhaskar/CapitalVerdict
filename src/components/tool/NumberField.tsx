import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, type Locale } from '@/i18n/t';
import {
  displayBounds,
  formatNumberText,
  parseNumberText,
  type NumberRules,
} from '@/lib/numberInput';

interface Props extends NumberRules {
  locale: Locale;
  label: string;
  /** Unit shown inside the field on the right, e.g. "km", "₹/L", "%". */
  unit?: string;
  /** Source or note shown under the label, like a spreadsheet's "Source / note" column. */
  note?: string;
  /** Marks the value as an assumption the user should check. */
  flagged?: boolean;
  /**
   * `stack`: label above the field. `row`: label and note on the left, field on the right
   * (from the sm breakpoint), like a row of an inputs table.
   */
  layout?: 'stack' | 'row';
  /** Form field name, e.g. the share-link key. */
  name?: string;
  value: number | null;
  /** Called with the parsed value, or null while the text is invalid. */
  onChange: (value: number | null) => void;
}

export default function NumberField(props: Props) {
  const { locale, label, unit, note, flagged, layout = 'stack', value, onChange, ...rules } = props;
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
      onChange(parsed.value);
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
    onChange(null);
  };

  const describedBy = [error && `${id}-err`, note && `${id}-note`].filter(Boolean).join(' ');
  const row = layout === 'row';

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
          {flagged && (
            <span class="ml-2 inline-block rounded-full bg-warn-soft px-2 py-0.5 align-[1px] text-xs font-medium text-warn">
              {t(locale, 'inputs.flag')}
            </span>
          )}
        </label>
        {row && note && (
          <p id={`${id}-note`} class="mt-0.5 text-xs text-ink-muted">
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
            class={`min-h-11 w-full rounded-md border px-3 text-base text-ink num transition-colors duration-(--duration-fast) ease-out-quart hover:border-ink-subtle focus:border-accent-strong ${
              unit ? 'pr-16' : ''
            } ${error ? 'border-danger' : 'border-line-strong'} ${
              flagged ? 'bg-warn-soft/60' : 'bg-page'
            }`}
          />
          {unit && (
            <span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-muted">
              {unit}
            </span>
          )}
        </div>
        {!row && note && !error && (
          <p id={`${id}-note`} class="mt-1 text-xs text-ink-muted">
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
