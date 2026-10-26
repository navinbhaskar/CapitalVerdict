import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Fragment, type ComponentChildren } from 'preact';
import { t, type Locale, type MessageKey } from '@/i18n/t';
import { fuelPrices } from '@/data';
import { localizePath } from '@/i18n/routes';
import { formatDuration } from '@/lib/duration';
import { formatMoney, formatNumber, formatPercent } from '@/lib/formatTool';
import { CAR_FUEL_START_FORM } from '@/models/carFuelForm';
import { RENT_BUY_EXAMPLE_FORM } from '@/models/rentBuyForm';
import BlankSelect from './BlankSelect';
import {
  CAR_ASK_LIMITS,
  CAR_ASK_START,
  EV_EXTRA_START,
  HERO_PRICE_CITY,
  HOME_ASK_LIMITS,
  HOME_ASK_START,
  SOLAR_ASK_LIMITS,
  SOLAR_ASK_START,
  SOLAR_STATE,
  carAsk,
  homeAsk,
  solarAsk,
  type CarAsk,
} from '@/models/heroAsk';

interface Props {
  locale: Locale;
}

type Tab = 'car' | 'solar' | 'home';
/** Icons are the same paths as Icon.astro's fuel, sun and home. */
const TABS: { id: Tab; label: MessageKey; icon: string }[] = [
  {
    id: 'car',
    label: 'hero.tab.car',
    icon: 'M4 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3 20h12M4 10h10M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3',
  },
  {
    id: 'solar',
    label: 'hero.tab.solar',
    icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  {
    id: 'home',
    label: 'hero.tab.home',
    icon: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  },
];

/** Auto-rotation: a few seconds per example, two rounds at most, then it rests on its own. */
const ROTATE_MS = 6000;
const MAX_STEPS = TABS.length * 2;

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

  // The examples rotate on their own until the visitor does anything with the card. Hovering or
  // focusing it pauses; any click, key or edit stops it for good; it never runs off screen or in a
  // hidden tab, and after two rounds it stops by itself. The pause button restarts it.
  const [auto, setAuto] = useState(true);
  const [held, setHeld] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [steps, setSteps] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const stop = () => setAuto(false);
  /** The timer is counting down to the next example right now. */
  const running = auto && !held && onScreen && steps < MAX_STEPS;

  useEffect(() => {
    const el = box.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting));
    io.observe(el);
    const onVisibility = () => setOnScreen(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!auto || held || !onScreen) return;
    if (steps >= MAX_STEPS) {
      setAuto(false);
      return;
    }
    const timer = setTimeout(() => {
      setTab((current) => TABS[(TABS.findIndex((x) => x.id === current) + 1) % TABS.length]!.id);
      setSteps((n) => n + 1);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [auto, held, onScreen, steps]);

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
    city: t(locale, `city.${HERO_PRICE_CITY}` as MessageKey),
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
    state: t(locale, `state.${SOLAR_STATE}` as MessageKey),
    subsidy: formatMoney(solarA?.subsidy ?? 0),
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
          <BlankSelect<CarAsk['alt']>
            label={t(locale, 'hero.ask.alt')}
            options={[
              { value: 'cng', label: t(locale, 'hero.ask.altCng') },
              { value: 'ev', label: t(locale, 'hero.ask.altEv') },
            ]}
            value={car.alt}
            onChange={(alt) =>
              setCar((c) => ({
                ...c,
                alt,
                extra: alt === 'ev' ? EV_EXTRA_START : CAR_ASK_START.extra,
              }))
            }
          />
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
        units: (
          <Blank
            label={t(locale, 'hero.ask.units')}
            value={solar.units}
            {...SOLAR_ASK_LIMITS.units}
            onChange={(units) => setSolar((s) => ({ ...s, units }))}
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
    <div
      ref={box}
      class="w-full max-w-md justify-self-center lg:justify-self-end"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusIn={() => setHeld(true)}
      onFocusOut={() => setHeld(false)}
    >
      <div class="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t(locale, 'hero.tablist')}
          class="hero-tabs"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            stop();
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
              onClick={() => {
                stop();
                setTab(tb.id);
              }}
              class={`hero-tab ${tab === tb.id ? 'is-active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={tb.icon}
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {t(locale, tb.label)}
              {/* While the examples rotate, a brass line fills under the active tab until the next. */}
              {tab === tb.id && running && (
                <span
                  key={steps}
                  class="hero-tab-progress"
                  style={{ animationDuration: `${ROTATE_MS}ms` }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (auto) stop();
            else {
              setSteps(0);
              setAuto(true);
            }
          }}
          aria-label={t(locale, auto ? 'hero.rotate.pause' : 'hero.rotate.play')}
          class="hero-rotate"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {auto ? (
              <path
                d="M9 6v12M15 6v12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            ) : (
              <path
                d="M8 5.5v13l10-6.5-10-6.5Z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
            )}
          </svg>
        </button>
      </div>

      <div
        class="relative mt-2 grid rounded-xl border border-line-strong bg-raised px-4 pt-4 pb-1 shadow-float sm:px-5 sm:pt-5"
        role="tabpanel"
        onInput={stop}
        onChange={stop}
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
                  aria-live={auto ? 'off' : 'polite'}
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
  return `col-start-1 row-start-1 min-w-0 ${active ? 'hero-panel-in' : 'invisible'}`;
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
