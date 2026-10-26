import { useEffect, useId, useRef, useState } from 'preact/hooks';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  /** Accessible name, e.g. "Cheaper-to-run car". */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A choice inside a sentence: looks like the other blanks (brass text, brass underline, a small
 * chevron) and opens a short list styled like the site, instead of the browser's own menu.
 * Keyboard: Enter, Space or the arrow keys open it; arrows move; Enter or Space picks; Escape or
 * Tab closes. A select-only combobox in the ARIA pattern, with the list as a listbox.
 */
export default function BlankSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: Props<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value),
    ),
  );
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  // Close on a click or tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const show = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const pick = (i: number) => {
    const option = options[i];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <span ref={rootRef} class="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        class="blank-select"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {current.label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          class={`blank-select-chevron ${open ? 'is-open' : ''}`}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        hidden={!open}
        class="blank-select-list"
      >
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={o.value === value}
            class={`blank-select-option ${i === active ? 'is-active' : ''}`}
            onPointerEnter={() => setActive(i)}
            onClick={() => pick(i)}
          >
            <span>{o.label}</span>
            {o.value === value && (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  stroke-width="2.25"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            )}
          </li>
        ))}
      </ul>
    </span>
  );
}
