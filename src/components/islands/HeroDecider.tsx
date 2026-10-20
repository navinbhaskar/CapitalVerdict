import { useId, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, type Locale } from '@/i18n/t';
import { fuelPrices, verifiedFuelPrices, verifiedSolarValue, verifiedTariff } from '@/data';
import { localizePath } from '@/i18n/routes';
import { formatLakhCrore } from '@/lib/format';
import { formatNumber, formatPercent } from '@/lib/formatTool';
import { carFuelFlips, compareCarFuel, type CarFuelInput } from '@/models/carFuel';
import { carFuelExample } from '@/models/carFuel.example';

interface Props {
  locale: Locale;
}

type Tab = 'cng' | 'solar' | 'rent';

/**
 * The home page's live example. Petrol vs CNG runs the real model: verified Lucknow fuel prices
 * where available, the worked example's mileages, price gap and interest (labelled illustrative),
 * and the visitor's own monthly distance from the slider. Other tabs unlock when their data is
 * verified (solar) or their tool ships (rent vs buy).
 */
const LUCKNOW = verifiedFuelPrices('lucknow');
const PRICE_ISO = fuelPrices.cities.find((c) => c.id === 'lucknow')?.petrol.effectiveDate ?? '';
const PRICE_DATE = PRICE_ISO
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${PRICE_ISO}T00:00:00`),
    )
  : '';
const BASE_INPUT: CarFuelInput = {
  ...carFuelExample,
  base: { ...carFuelExample.base, energyPrice: LUCKNOW?.petrol ?? carFuelExample.base.energyPrice },
  alternative: {
    ...carFuelExample.alternative,
    energyPrice: LUCKNOW?.cng ?? carFuelExample.alternative.energyPrice,
  },
};
// The km at which the answer flips does not depend on the km chosen, so work it out once.
const FLIP_KM = carFuelFlips(BASE_INPUT).find((f) => f.variable === 'monthlyKm')?.threshold ?? null;
const SOLAR_READY =
  verifiedTariff() !== null && verifiedSolarValue('generationPerKWPerDay') !== null;
const KM = { min: 300, max: 4000, step: 100, start: carFuelExample.monthlyKm };

// Chart geometry (SVG user units).
const W = 320;
const H = 132;

function chartPaths(km: number) {
  const r = compareCarFuel({ ...BASE_INPUT, monthlyKm: km });
  const months = BASE_INPUT.horizonMonths;
  // Scale to the current values (there is no y-axis); the break-even marker moving left and
  // right is what shows the change.
  const top = Math.max(r.cumulativeSaving[months]!, r.extraPriceWithInterest[months]!) * 1.12;
  const x = (m: number) => (m / months) * W;
  const y = (v: number) => H - (Math.max(v, 0) / top) * H;
  const pt = (s: number[], m: number) => `${x(m).toFixed(2)} ${y(s[m]!).toFixed(2)}`;
  const line = (s: number[], from = 0, to = months) =>
    Array.from(
      { length: to - from + 1 },
      (_, i) => `${i === 0 ? 'M' : 'L'}${pt(s, from + i)}`,
    ).join(' ');
  const be = r.breakevenWithInterest;
  const gain = be
    ? `${line(r.cumulativeSaving, be.months)} ${Array.from(
        { length: months - be.months + 1 },
        (_, i) => `L${pt(r.extraPriceWithInterest, months - i)}`,
      ).join(' ')} Z`
    : null;
  return {
    result: r,
    saving: line(r.cumulativeSaving),
    cost: line(r.extraPriceWithInterest),
    gain,
    be: be && { x: x(be.months), y: y(r.cumulativeSaving[be.months]!), months: be.months },
  };
}

export default function HeroDecider({ locale }: Props) {
  const [tab, setTab] = useState<Tab>('cng');
  const [km, setKm] = useState(KM.start);
  const id = useId();
  const view = useMemo(() => chartPaths(km), [km]);
  const r = view.result;
  const nf = (n: number) => formatNumber(n);

  const verdict = view.be
    ? t(locale, 'hero.verdict.payback', { months: view.be.months })
    : t(locale, 'hero.verdict.never');

  const tabs: { id: Tab; label: string; locked: boolean }[] = [
    { id: 'cng', label: t(locale, 'hero.tab.cng'), locked: false },
    { id: 'solar', label: t(locale, 'hero.tab.solar'), locked: !SOLAR_READY },
    { id: 'rent', label: t(locale, 'hero.tab.rent'), locked: true },
  ];

  return (
    <div class="w-full max-w-md justify-self-center lg:justify-self-end">
      <figure
        class="relative grid rounded-xl p-4 shadow-float glass sm:p-5"
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
      >
        {/* All panels share one grid cell, so the card keeps the tallest panel's size on every tab. */}
        <div class={panelClass(tab === 'cng')}>
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium text-ink-muted">{t(locale, 'hero.tab.cng')}</span>
            <span class="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              {LUCKNOW
                ? t(locale, 'hero.context', { date: PRICE_DATE })
                : t(locale, 'home.preview.label')}
            </span>
          </div>
          <p class="mt-3 font-display text-xl font-semibold" aria-live="polite">
            <span key={verdict} class="tick block">
              {verdict}
            </span>
          </p>

          <svg
            viewBox={`0 0 ${W} ${H + 18}`}
            class="mt-4 w-full overflow-visible"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${id}-gain`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="var(--color-accent)" stop-opacity="0.22" />
                <stop offset="1" stop-color="var(--color-accent)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1="0"
                x2={W}
                y1={H * f}
                y2={H * f}
                stroke="var(--color-line)"
                stroke-width="0.6"
                stroke-dasharray="1.5 3"
              />
            ))}
            <line
              x1="0"
              x2={W}
              y1={H}
              y2={H}
              stroke="var(--color-line-strong)"
              stroke-width="0.6"
            />
            {view.gain && <path d={view.gain} fill={`url(#${id}-gain)`} />}
            <path
              d={view.cost}
              pathLength={1}
              class="draw"
              style="--delay: 300ms"
              stroke="var(--color-ink-subtle)"
              stroke-width="1"
              stroke-linecap="round"
            />
            <path
              d={view.saving}
              pathLength={1}
              class="draw"
              style="--delay: 380ms"
              stroke="var(--color-ink)"
              stroke-width="1.15"
              stroke-linecap="round"
            />
            {view.be && (
              <g>
                <line
                  x1={view.be.x}
                  x2={view.be.x}
                  y1={view.be.y + 6}
                  y2={H}
                  stroke="var(--color-accent)"
                  stroke-width="0.6"
                  stroke-dasharray="1.5 2.5"
                />
                <circle
                  cx={view.be.x}
                  cy={view.be.y}
                  r="6"
                  stroke="var(--color-accent)"
                  stroke-width="0.6"
                />
                <circle cx={view.be.x} cy={view.be.y} r="2.4" fill="var(--color-accent)" />
                <text
                  x={view.be.x}
                  y={view.be.y - 10}
                  font-size="8.5"
                  font-weight="500"
                  fill="var(--color-accent-strong)"
                  text-anchor="middle"
                >
                  {t(locale, 'unit.monthsShort', { n: view.be.months })}
                </text>
              </g>
            )}
            <text x="0" y={H + 14} font-size="8.5" fill="var(--color-ink-muted)">
              0
            </text>
            <text
              x={W / 2}
              y={H + 14}
              font-size="8.5"
              fill="var(--color-ink-muted)"
              text-anchor="middle"
            >
              {t(locale, 'unit.yearsShort', { n: 5 })}
            </text>
            <text x={W} y={H + 14} font-size="8.5" fill="var(--color-ink-muted)" text-anchor="end">
              {t(locale, 'unit.yearsShort', { n: 10 })}
            </text>
          </svg>

          <div class="mt-4">
            <div class="flex items-baseline justify-between gap-3">
              <label for={`${id}-km`} class="text-sm font-medium">
                {t(locale, 'hero.slider')}
              </label>
              <span class="text-sm font-semibold num">{t(locale, 'unit.km', { n: nf(km) })}</span>
            </div>
            <input
              id={`${id}-km`}
              type="range"
              min={KM.min}
              max={KM.max}
              step={KM.step}
              value={km}
              aria-valuetext={t(locale, 'hero.sliderValue', { n: nf(km) })}
              onInput={(e) => setKm(Number(e.currentTarget.value))}
              class="range mt-2 w-full"
              style={{ '--fill': `${((km - KM.min) / (KM.max - KM.min)) * 100}%` }}
            />
            {FLIP_KM !== null && (
              <p class="mt-1.5 text-xs text-ink-muted">
                {t(locale, 'hero.flip', { km: t(locale, 'unit.km', { n: nf(FLIP_KM) }) })}
              </p>
            )}
          </div>

          <dl class="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <Stat label={t(locale, 'home.preview.breakeven')}>
              {view.be ? t(locale, 'unit.monthsShort', { n: view.be.months }) : '—'}
            </Stat>
            <Stat label={t(locale, 'home.preview.distance')}>
              {view.be ? t(locale, 'unit.km', { n: nf(view.be.months * km) }) : '—'}
            </Stat>
            <Stat label={t(locale, 'home.preview.net10')}>
              <span class={r.netAt10Years!.withInterest < 0 ? 'text-danger' : ''}>
                {formatLakhCrore(r.netAt10Years!.withInterest)}
              </span>
            </Stat>
          </dl>
          <p class="mt-3 text-xs text-ink-muted">
            {t(locale, 'hero.footnote', {
              gap: formatLakhCrore(BASE_INPUT.extraPrice),
              rate: formatPercent(BASE_INPUT.interestRate),
            })}{' '}
            <a
              href={`${localizePath('/tools/car-fuel/', locale)}?km=${km}`}
              class="link font-medium"
            >
              {t(locale, 'hero.cta')}
            </a>
          </p>
        </div>
        <div class={panelClass(tab === 'solar')}>
          <LockedPanel
            title={t(locale, 'hero.tab.solar')}
            body={t(locale, 'hero.solarLocked')}
            link={{
              href: localizePath('/tools/solar/', locale),
              label: t(locale, 'hero.solarCta'),
            }}
          />
        </div>
        <div class={panelClass(tab === 'rent')}>
          <LockedPanel
            title={t(locale, 'hero.tab.rent')}
            body={t(locale, 'hero.rentLocked')}
            link={{
              href: localizePath('/tools/rent-vs-buy/', locale),
              label: t(locale, 'hero.rentCta'),
            }}
          />
        </div>
      </figure>

      <div
        role="tablist"
        aria-label={t(locale, 'hero.tablist')}
        class="mt-3 flex justify-center gap-1"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const order: Tab[] = ['cng', 'solar', 'rent'];
          const next = order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]!;
          setTab(next);
          document.getElementById(`${id}-tab-${next}`)?.focus();
        }}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            id={`${id}-tab-${tb.id}`}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === tb.id ? 0 : -1}
            onClick={() => setTab(tb.id)}
            class={`hero-tab ${tab === tb.id ? 'is-active' : ''}`}
          >
            {tb.locked && <LockIcon />}
            {tb.label}
            {tb.locked && <span class="sr-only">{t(locale, 'hero.locked')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Inactive panels stay in the layout (so they size the card) but are hidden from sight, focus and screen readers. */
function panelClass(active: boolean): string {
  return `col-start-1 row-start-1 min-w-0 ${active ? '' : 'invisible'}`;
}

function Stat({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <dt class="text-xs text-ink-muted">{label}</dt>
      <dd class="mt-1 font-semibold num sm:text-lg">{children}</dd>
    </div>
  );
}

function LockedPanel(props: {
  title: string;
  body: string;
  link: { href: string; label: string } | null;
}) {
  return (
    <div class="flex h-full flex-col items-start justify-center gap-3 px-1">
      <span class="inline-flex size-10 items-center justify-center rounded-lg bg-surface text-ink-muted">
        <LockIcon size={20} />
      </span>
      <p class="font-display text-xl font-semibold">{props.title}</p>
      <p class="max-w-xs text-sm text-ink-muted">{props.body}</p>
      {props.link && (
        <a href={props.link.href} class="link text-sm font-medium">
          {props.link.label}
        </a>
      )}
    </div>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
