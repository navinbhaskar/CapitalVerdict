import { t, type Locale } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatPercent } from '@/lib/formatTool';

interface Props {
  locale: Locale;
  /** `afterTax`: the tool asks for a return after tax, so say what that means for equity. */
  context: 'computed' | 'afterTax';
}

/**
 * How gains on equity and equity mutual funds are taxed, from the verified rules, in a small
 * closed note. Shown wherever a tool compares equity with something taxed differently.
 */
export default function EquityTaxNote({ locale, context }: Props) {
  const cg = incomeTax.capitalGains;
  return (
    <details class="group mt-3 rounded-lg border border-line px-3 text-sm">
      <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium hover:text-accent-strong">
        {t(locale, 'equityTax.title')}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          class="shrink-0 text-ink-muted transition-transform duration-(--duration-base) ease-out-quart group-open:rotate-180"
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </summary>
      <ul class="space-y-1.5 pb-3 text-ink-muted" role="list">
        <li>
          {t(locale, 'equityTax.short', {
            months: cg.listedLongTermAfterMonths,
            rate: formatPercent(cg.equityShortTermRate),
          })}
        </li>
        <li>
          {t(locale, 'equityTax.long', {
            rate: formatPercent(cg.longTermRate),
            exempt: formatINR(cg.equityLongTermExemption),
          })}
        </li>
        <li>{t(locale, 'equityTax.cess', { cess: formatPercent(incomeTax.cessRate) })}</li>
        <li>{t(locale, context === 'afterTax' ? 'equityTax.afterTax' : 'equityTax.computed')}</li>
      </ul>
    </details>
  );
}
