import { useEffect, useId, useState } from 'preact/hooks';
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
  help?: string;
  value: number | null;
  /** Called with the parsed value, or null while the text is invalid. */
  onChange: (value: number | null) => void;
}

export default function NumberField(props: Props) {
  const { locale, label, unit, help, value, onChange, ...rules } = props;
  const id = useId();
  const [text, setText] = useState(formatNumberText(value, rules));
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

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
    const bounds = displayBounds(rules);
    setError(
      parsed.reason === 'required'
        ? t(locale, 'input.error.required')
        : parsed.reason === 'notInteger'
          ? t(locale, 'input.error.integer')
          : t(locale, 'input.error.range', bounds),
    );
    onChange(null);
  };

  const describedBy = [error && `${id}-err`, help && `${id}-help`].filter(Boolean).join(' ');

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
          onBlur={() => {
            setFocused(false);
            if (value !== null) setText(formatNumberText(value, rules));
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          class={`min-h-12 w-full rounded-lg border bg-page px-3.5 text-[1.0625rem] text-ink num transition-colors duration-200 hover:border-ink-subtle focus:border-accent-strong ${
            unit ? 'pr-20' : ''
          } ${error ? 'border-danger' : 'border-line-strong'}`}
        />
        {unit && (
          <span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {help && !error && (
        <p id={`${id}-help`} class="mt-1.5 text-sm text-ink-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} class="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
