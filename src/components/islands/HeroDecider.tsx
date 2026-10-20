import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import { Fragment, type ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { fuelPrices } from '@/data';
import { localizePath } from '@/i18n/routes';
import { formatDuration } from '@/lib/duration';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { CAR_FUEL_START_FORM } from '@/models/carFuelForm';
import { RENT_BUY_EXAMPLE_FORM } from '@/models/rentBuyForm';
import {
  CAR_ASK_LIMITS,
  CAR_ASK_START,
  EV_EXTRA_START,
  HERO_PRICE_CITY,
  HOME_ASK_LIMITS,
  HOME_ASK_START,
  SOLAR_ASK_LIMITS,
  SOLAR_ASK_START,
  SOLAR_RATE,
  carAsk,
  homeAsk,
  solarAsk,
  type CarAsk,
} from '@/models/heroAsk';

interface Props {
  locale: Locale;
}

type Tab = 'car' | 'solar' | 'home';
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: 'car', label: 'hero.tab.car' },
  { id: 'solar', label: 'hero.tab.solar' },
  { id: 'home', label: 'hero.tab.home' },
];

const PRICE_ISO =
  fuelPrices.cities.find((c) => c.id === HERO_PRICE_CITY)?.petrol.effectiveDate ?? '';
const PRICE_DATE = PRICE_ISO
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${PRICE_ISO}T00:00:00`),
    )
  : '';

/** Mid-sentence form of a fuel name: "petrol", but acronyms such as "CNG" and "EV" stay as they are. */
const inline = (name: string) => (name === name.toUpperCase() ? name : name.toLowerCase());

interface Panel {
  sentence: ComponentChildren;
  head: string;
  sub: string;
  flip?: string | null;
  context: string;
  href: string;
}

/**
 * The home page's live example, asked as a sentence with blanks the visitor can change. Answers
 * come from the same models and example forms as the full tools (see models/heroAsk.ts), and the
 * link carries the visitor's numbers into the calculator.
 */
export default function HeroDecider({ locale }: Props) {
  const [tab, setTab] = useState<Tab>('car');
  const [car, setCar] = useState<CarAsk>(CAR_ASK_START);
  const [solar, setSolar] = useState(SOLAR_ASK_START);
  const [home, setHome] = useState(HOME_ASK_START);
  const id = useId();

  const carA = useMemo(() => carAsk(car), [car]);
  const solarA = useMemo(() => solarAsk(solar), [solar]);
  const homeA = useMemo(() => homeAsk(home), [home]);

  const fuel = (side: 'base' | 'alternative') =>
    t(locale, side === 'base' ? 'fuel.petrol' : car.alt === 'cng' ? 'fuel.cng' : 'fuel.ev');

  // ---- Car ----
  let carHead = t(locale, 'hero.answer.invalid');
  let carSub = '';
  if (carA) {
    const v = carA.verdict;
    const years = carA.horizonYears;
    if (v.kind === 'payback') {
      carHead = t(locale, 'verdict.paysBack', {
        alt: fuel(v.payer),
        duration: formatDuration(locale, v.months),
      });
      carSub = t(locale, 'hero.car.ahead', { amount: formatMoney(carA.dearerNet), years });
    } else if (v.kind === 'never' || v.kind === 'resale') {
      carHead = t(locale, 'verdict.never', { base: fuel(v.winner), years });
      carSub = t(locale, 'hero.car.noPayback', { extra: formatMoney(Math.abs(carA.extraPrice)) });
    } else if (v.kind === 'dominant') {
      carHead = t(locale, 'verdict.dominant', { winner: fuel(v.winner) });
    } else {
      carHead = t(locale, 'verdict.tie');
    }
  }
  const carFlip =
    carA?.flipKm &&
    t(locale, 'verdict.plain.flipKm', {
      km: t(locale, 'unit.km', { n: formatNumber(Math.round(carA.flipKm.threshold)) }),
      below: inline(fuel(carA.flipKm.cheaperBelow)),
    });
  const carContext = t(locale, car.alt === 'cng' ? 'hero.car.contextCng' : 'hero.car.contextEv', {
    date: PRICE_DATE,
    rate: formatPercent(CAR_FUEL_START_FORM.interestRate!),
    pm: formatNumber(CAR_FUEL_START_FORM.petrolMileage!),
    cm: formatNumber(CAR_FUEL_START_FORM.cngMileage!),
    ee: formatNumber(CAR_FUEL_START_FORM.evEfficiency!),
    home: formatPercent(CAR_FUEL_START_FORM.homeChargingShare!),
    hr: formatNumber(CAR_FUEL_START_FORM.homeRate!),
  });

  // ---- Solar ----
  const solarHead = !solarA
    ? t(locale, 'hero.answer.invalid')
    : solarA.payback
      ? t(locale, 'solar.verdict.payback', {
          duration: formatDuration(locale, solarA.payback.months),
        })
      : t(locale, 'solar.verdict.never', { years: solarA.horizonYears });
  const solarSub =
    solarA && solarA.netAtHorizon > 0
      ? t(locale, 'hero.solar.ahead', {
          amount: formatMoney(solarA.netAtHorizon),
          years: solarA.horizonYears,
        })
      : '';
  const solarContext = t(locale, 'hero.solar.context', {
    rate: formatNumber(SOLAR_RATE),
    gen: formatNumber(solarA?.generationPerKWPerDay ?? 0, 1),
  });

  // ---- Home ----
  const homeHead = !homeA
    ? t(locale, 'hero.answer.invalid')
    : t(locale, homeA.difference < 0 ? 'hero.home.rent' : 'hero.home.buy', {
        amount: formatMoney(Math.abs(homeA.difference)),
      });
  const homeSub = homeA
    ? t(locale, 'hero.home.sub', {
        years: homeA.horizonYears,
        today: formatMoney(Math.abs(homeA.differenceToday)),
      })
    : '';
  const homeContext = t(locale, 'hero.home.context', {
    down: formatPercent(RENT_BUY_EXAMPLE_FORM.downPayment!),
    loan: formatPercent(RENT_BUY_EXAMPLE_FORM.loanRate!),
    loanYears: RENT_BUY_EXAMPLE_FORM.loanYears!,
    growth: formatPercent(RENT_BUY_EXAMPLE_FORM.appreciation!),
  });

  const panels: Record<Tab, Panel> = {
    car: {
      sentence: fill(t(locale, 'hero.car.sentence'), {
        km: (
          <Blank
            label={t(locale, 'hero.ask.km')}
            value={car.km}
            {...CAR_ASK_LIMITS.km}
            suffix={t(locale, 'hero.ask.kmUnit')}
            onChange={(km) => setCar((c) => ({ ...c, km }))}
          />
        ),
        alt: (
          <select
            aria-label={t(locale, 'hero.ask.alt')}
            class="blank-select"
            style={{
              width: `calc(${textWidth(t(locale, car.alt === 'cng' ? 'hero.ask.altCng' : 'hero.ask.altEv'))} + 0.9em)`,
            }}
            value={car.alt}
            onChange={(e) => {
              const alt = (e.currentTarget as HTMLSelectElement).value as CarAsk['alt'];
              setCar((c) => ({
                ...c,
                alt,
                extra: alt === 'ev' ? EV_EXTRA_START : CAR_ASK_START.extra,
              }));
            }}
          >
            <option value="cng">{t(locale, 'hero.ask.altCng')}</option>
            <option value="ev">{t(locale, 'hero.ask.altEv')}</option>
          </select>
        ),
        extra: (
          <Blank
            label={t(locale, 'hero.ask.extra')}
            value={car.extra}
            {...CAR_ASK_LIMITS.extra}
            prefix="₹"
            onChange={(extra) => setCar((c) => ({ ...c, extra }))}
          />
        ),
      }),
      head: carHead,
      sub: carSub,
      flip: carFlip,
      context: carContext,
      href: `${localizePath('/tools/car-fuel/', locale)}${carA?.query ?? ''}`,
    },
    solar: {
      sentence: fill(t(locale, 'hero.solar.sentence'), {
        bill: (
          <Blank
            label={t(locale, 'hero.ask.bill')}
            value={solar.bill}
            {...SOLAR_ASK_LIMITS.bill}
            prefix="₹"
            onChange={(bill) => setSolar((s) => ({ ...s, bill }))}
          />
        ),
        kw: (
          <Blank
            label={t(locale, 'hero.ask.kw')}
            value={solar.kw}
            {...SOLAR_ASK_LIMITS.kw}
            decimals={1}
            suffix=" kW"
            onChange={(kw) => setSolar((s) => ({ ...s, kw }))}
          />
        ),
        cost: (
          <Blank
            label={t(locale, 'hero.ask.cost')}
            value={solar.cost}
            {...SOLAR_ASK_LIMITS.cost}
            prefix="₹"
            onChange={(cost) => setSolar((s) => ({ ...s, cost }))}
          />
        ),
      }),
      head: solarHead,
      sub: solarSub,
      context: solarContext,
      href: `${localizePath('/tools/solar/', locale)}${solarA?.query ?? ''}`,
    },
    home: {
      sentence: fill(t(locale, 'hero.home.sentence'), {
        price: (
          <Blank
            label={t(locale, 'hero.ask.price')}
            value={home.price}
            {...HOME_ASK_LIMITS.price}
            prefix="₹"
            onChange={(price) => setHome((h) => ({ ...h, price }))}
          />
        ),
        rent: (
          <Blank
            label={t(locale, 'hero.ask.rent')}
            value={home.rent}
            {...HOME_ASK_LIMITS.rent}
            prefix="₹"
            onChange={(rent) => setHome((h) => ({ ...h, rent }))}
          />
        ),
        ret: (
          <Blank
            label={t(locale, 'hero.ask.ret')}
            value={home.ret}
            {...HOME_ASK_LIMITS.ret}
            percent
            onChange={(ret) => setHome((h) => ({ ...h, ret }))}
          />
        ),
      }),
      head: homeHead,
      sub: homeSub,
      context: homeContext,
      href: `${localizePath('/tools/rent-vs-buy/', locale)}${homeA?.query ?? ''}`,
    },
  };

  return (
    <div class="w-full max-w-md justify-self-center lg:justify-self-end">
      <div
        role="tablist"
        aria-label={t(locale, 'hero.tablist')}
        class="flex gap-1"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const order = TABS.map((x) => x.id);
          const next = order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]!;
          setTab(next);
          document.getElementById(`${id}-tab-${next}`)?.focus();
        }}
      >
        {TABS.map((tb) => (
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
            {t(locale, tb.label)}
          </button>
        ))}
      </div>

      <div
        class="relative mt-2 grid rounded-xl border border-line-strong bg-raised px-4 pt-4 pb-1 shadow-float sm:px-5 sm:pt-5"
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
      >
        {/* All panels share one grid cell, so the card keeps the tallest panel's size on every tab. */}
        {TABS.map(({ id: key }) => {
          const p = panels[key];
          return (
            <div key={key} class={panelClass(tab === key)}>
              <p class="font-display text-lg leading-loose">{p.sentence}</p>
              <div class="mt-3 border-t border-line pt-3">
                <p
                  class="font-display text-xl font-medium tracking-(--tracking-heading) text-accent-strong"
                  aria-live="polite"
                >
                  <span key={p.head} class="tick block">
                    {p.head}
                  </span>
                </p>
                {(p.sub || p.flip) && (
                  <p class="mt-1 text-sm text-ink-muted">
                    {p.sub && <span class="text-ink">{p.sub}</span>}
                    {p.sub && p.flip ? ' ' : ''}
                    {p.flip}
                  </p>
                )}
              </div>
              <p class="mt-3 text-xs text-ink-muted">{p.context}</p>
              <a
                href={p.href}
                class="link mt-1 inline-flex min-h-11 items-center text-sm font-medium"
              >
                {t(locale, 'hero.open')}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Width that fits a short number or word in the display font (digits about 0.63em, separators
 * 0.32em, capitals 0.74em). Keeps a blank as wide as its text so the sentence reads naturally.
 */
function textWidth(text: string): string {
  let em = 0.1;
  for (const ch of text) {
    em += /[0-9]/.test(ch) ? 0.63 : /[,.]/.test(ch) ? 0.32 : /[A-Z]/.test(ch) ? 0.74 : 0.5;
  }
  return `${Math.max(em, 0.65).toFixed(2)}em`;
}

/** A sentence template with {name} slots filled by inline controls. */
function fill(template: string, parts: Record<string, ComponentChildren>): ComponentChildren {
  return template.split(/(\{\w+\})/).map((segment, i) => {
    const name = /^\{(\w+)\}$/.exec(segment)?.[1];
    return <Fragment key={i}>{name && name in parts ? parts[name] : segment}</Fragment>;
  });
}

/** Inactive panels stay in the layout (so they size the card) but are hidden from sight, focus and screen readers. */
function panelClass(active: boolean): string {
  return `col-start-1 row-start-1 min-w-0 ${active ? '' : 'invisible'}`;
}

/**
 * An editable number inside a sentence: underlined in brass, as wide as its text. The answer
 * follows every valid keystroke; on leaving the field it shows the last valid value again.
 */
function Blank(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  percent?: boolean;
  decimals?: number;
}) {
  const { label, value, min, max, onChange, prefix, suffix, percent, decimals = 0 } = props;
  const show = (v: number) => {
    const n = percent ? v * 100 : v;
    return formatNumber(n, Number.isInteger(n) ? 0 : Math.max(decimals, percent ? 1 : 0));
  };
  const [text, setText] = useState(show(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(show(value)), [value]);

  return (
    <span class={`blank ${bad ? 'is-bad' : ''}`}>
      {prefix}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={bad || undefined}
        value={text}
        style={{ width: textWidth(text) }}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          setText(raw);
          const n = Number(raw.replace(/[^\d.]/g, ''));
          const v = percent ? n / 100 : n;
          const ok = raw.trim() !== '' && Number.isFinite(n) && v >= min && v <= max;
          setBad(!ok);
          if (ok) onChange(v);
        }}
        onBlur={() => {
          setBad(false);
          setText(show(value));
        }}
      />
      {percent ? '%' : suffix}
    </span>
  );
}
