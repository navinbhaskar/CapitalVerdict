import { t, type Locale } from '@/i18n/t';

export interface FlipLine {
  /** Already-translated sentence, e.g. "Petrol wins if you drive less than 930 km a month". */
  text: string;
  /** Current value of the same input, formatted. */
  current: string;
}

interface Props {
  locale: Locale;
  lines: FlipLine[];
}

export default function SensitivityList({ locale, lines }: Props) {
  return (
    <section aria-labelledby="flips-heading">
      <h2 id="flips-heading" class="font-display text-2xl font-medium">
        {t(locale, 'flips.heading')}
      </h2>
      <p class="mt-1 text-sm text-ink-muted">{t(locale, 'flips.intro')}</p>
      {lines.length === 0 ? (
        <p class="mt-4 text-ink-muted">{t(locale, 'flips.none')}</p>
      ) : (
        <ul class="mt-4 divide-y divide-line border-y border-line" role="list">
          {lines.map((line) => (
            <li
              key={line.text}
              class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
            >
              <span>{line.text}</span>
              <span class="text-sm text-ink-muted num">
                {t(locale, 'flips.current', { value: line.current })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
