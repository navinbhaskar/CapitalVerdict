import { t, type Locale } from '@/i18n/t';
import { formatMoney, formatRupeesPrecise } from '@/lib/formatTool';
import type { CarSetResult } from '@/models/carFuel';
import { verdictHeadline } from './VerdictCard';

interface Props {
  locale: Locale;
  set: CarSetResult;
  /** Display names by key: `fuel` for "CNG", `car` for "CNG car". */
  names: Record<string, { fuel: string; car: string }>;
  baseKey: string;
  years: number;
}

/** Petrol, CNG and EV side by side: the total cost of owning each, and each one's payback on petrol. */
export default function CarSetCard({ locale, set, names, baseKey, years }: Props) {
  const [best, ...rest] = set.ranking.map((key) => set.entries.find((e) => e.key === key)!);
  const anyResale = set.entries.some((e) => e.resale > 0);
  const anyInterest = set.entries.some((e) => e.interest > 0);
  const rows: {
    label: string;
    value: (e: (typeof set.entries)[number]) => string;
    strong?: boolean;
  }[] = [
    { label: t(locale, 'carSet.row.price'), value: (e) => formatMoney(e.purchasePrice) },
    ...(anyInterest
      ? [
          {
            label: t(locale, 'carSet.row.interest'),
            value: (e: (typeof set.entries)[number]) => formatMoney(e.interest),
          },
        ]
      : []),
    { label: t(locale, 'carSet.row.running', { years }), value: (e) => formatMoney(e.running) },
    ...(anyResale
      ? [
          {
            label: t(locale, 'carSet.row.resale'),
            value: (e: (typeof set.entries)[number]) => `−${formatMoney(e.resale)}`,
          },
        ]
      : []),
    {
      label: t(locale, 'carSet.row.total', { years }),
      value: (e) => formatMoney(e.netCost),
      strong: true,
    },
    { label: t(locale, 'carSet.row.perKm'), value: (e) => formatRupeesPrecise(e.costPerKm) },
    { label: t(locale, 'carSet.row.thisMonth'), value: (e) => formatMoney(e.firstMonthRunning) },
  ];

  return (
    <section
      aria-labelledby="verdict-heading"
      id="verdict"
      class="scroll-mt-24 rounded-xl bg-raised p-4 shadow-raised sm:p-5"
    >
      <p class="text-sm font-medium text-ink-muted">{t(locale, 'verdict.label')}</p>
      <h2
        id="verdict-heading"
        class="mt-1 font-display text-xl font-semibold sm:text-2xl sm:font-medium"
        aria-live="polite"
      >
        <span key={best!.key} class="tick block">
          {t(locale, 'carSet.headline', { car: names[best!.key]!.fuel, years })}
        </span>
      </h2>
      <p class="mt-2 text-ink-muted">
        {t(locale, 'carSet.gaps', {
          second: names[rest[0]!.key]!.fuel,
          gap2: formatMoney(rest[0]!.netCost - best!.netCost),
          third: names[rest[1]!.key]!.fuel,
          gap3: formatMoney(rest[1]!.netCost - best!.netCost),
        })}
      </p>

      <div class="-mx-4 mt-4 overflow-x-auto border-t border-line px-4 sm:-mx-5 sm:px-5">
        <table class="w-full min-w-80 text-left text-sm">
          <caption class="sr-only">{t(locale, 'carSet.caption', { years })}</caption>
          <thead>
            <tr class="border-b border-line">
              <td class="py-2" />
              {set.entries.map((e) => (
                <th key={e.key} scope="col" class="py-2 pl-3 text-right font-medium">
                  {names[e.key]!.car}
                  {e.key === best!.key && (
                    <span class="mt-0.5 block text-xs font-medium text-accent-strong">
                      {t(locale, 'carSet.lowest')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                class={row.strong ? 'border-y border-line-strong' : 'border-b border-line'}
              >
                <th
                  scope="row"
                  class={`py-2 pr-2 font-normal text-ink-muted ${row.strong ? 'text-ink' : ''}`}
                >
                  {row.label}
                </th>
                {set.entries.map((e) => (
                  <td
                    key={e.key}
                    class={`py-2 pl-3 text-right num ${row.strong ? 'font-semibold' : ''}`}
                  >
                    {row.value(e)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul class="mt-4 space-y-1.5 text-sm" role="list">
        {Object.entries(set.pairs).map(([key, pair]) => (
          <li key={key}>
            <span class="text-ink-muted">
              {t(locale, 'carSet.against', { car: names[key]!.fuel })}
            </span>{' '}
            <span class="font-medium">
              {verdictHeadline(
                locale,
                pair.verdict,
                { base: names[baseKey]!.fuel, alternative: names[key]!.fuel },
                years,
              )}
            </span>
          </li>
        ))}
      </ul>
      <p class="mt-3 text-xs text-ink-muted">{t(locale, 'carSet.help')}</p>
    </section>
  );
}
