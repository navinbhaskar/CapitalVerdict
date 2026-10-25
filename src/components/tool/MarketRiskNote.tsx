import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  /** `fund`: the tool works out an equity fund's result. `savings`: it assumes a return on savings. */
  kind: 'fund' | 'savings';
}

/** Plain warning that an assumed market return can fail, on every tool whose answer depends on one. */
export default function MarketRiskNote({ locale, kind }: Props) {
  return (
    <p class="mt-3 flex gap-2 text-sm text-ink-muted">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        class="mt-0.5 shrink-0 text-accent-strong"
      >
        <path
          d="M12 4 2.5 20h19L12 4Zm0 6v4.5m0 2.5h.01"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{t(locale, kind === 'fund' ? 'marketRisk.fund' : 'marketRisk.savings')}</span>
    </p>
  );
}
