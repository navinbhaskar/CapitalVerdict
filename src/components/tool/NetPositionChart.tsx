import { useEffect, useRef, useState } from 'preact/hooks';
import type uPlotType from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  title: string;
  /** Index = month (0 … horizon). Net = cumulative saving − extra price (± interest). */
  netWithInterest: number[];
  /** Optional dashed comparison line (e.g. ignoring interest). */
  netNoInterest?: number[];
  /** Scenario envelope for the with-interest line. Leave out to draw lines only. */
  bandLow?: number[];
  bandHigh?: number[];
  breakevenWithInterest: number | null;
  breakevenNoInterest?: number | null;
  /** Legend text; defaults to the car fuel wording. */
  labels?: { main: string; secondary?: string; band?: string };
}

const HEIGHT = 240;
const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Net position over time: below zero the extra price has not been earned back yet, above zero it
 * has. The line crosses zero at break-even. uPlot loads lazily so it never blocks the first render.
 * The same numbers are in the month-by-month table for screen readers.
 */
export default function NetPositionChart(props: Props) {
  const {
    locale,
    title,
    netWithInterest,
    netNoInterest,
    bandLow,
    bandHigh,
    breakevenWithInterest,
    breakevenNoInterest = null,
    labels,
  } = props;
  const legend = labels ?? {
    main: t(locale, 'chart.netWithInterest'),
    secondary: t(locale, 'chart.netNoInterest'),
    band: t(locale, 'chart.netBand'),
  };
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlotType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // The chart library loads only once the chart is near the screen, so an open chart below the
  // answer costs nothing on first paint. Its space is reserved, so nothing moves when it draws.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let resize: ResizeObserver | undefined;

    const build = async () => {
      let uPlot: typeof uPlotType;
      try {
        ({ default: uPlot } = await import('uplot'));
      } catch {
        // Script failed to load (offline, blocked): say so instead of shimmering forever.
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !box.current) return;
      plot.current?.destroy();

      const ink = cssVar('--color-ink');
      const muted = cssVar('--color-ink-subtle');
      const line = cssVar('--color-line');
      const strong = cssVar('--color-line-strong');
      const accent = cssVar('--color-accent');
      const lakh = (v: number) =>
        v === 0
          ? '₹0'
          : `${v < 0 ? '−' : ''}${t(locale, 'unit.lakhShort', { n: Number((Math.abs(v) / 1e5).toFixed(1)) })}`;
      const months = netWithInterest.map((_, m) => m);

      const dot = (u: uPlotType, month: number | null, series: number[], filled: boolean) => {
        if (month === null) return;
        const x = u.valToPos(month, 'x', true);
        const y = u.valToPos(series[month]!, 'y', true);
        const ctx = u.ctx;
        const r = devicePixelRatio;
        ctx.save();
        ctx.fillStyle = accent;
        ctx.strokeStyle = accent;
        if (filled) {
          // Thin ring around the with-interest break-even, like the home page chart.
          ctx.lineWidth = 0.75 * r;
          ctx.beginPath();
          ctx.arc(x, y, 7 * r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, (filled ? 2.75 : 2) * r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      plot.current = new uPlot(
        {
          width: box.current.clientWidth,
          height: HEIGHT,
          legend: { show: false },
          cursor: { drag: { x: false, y: false }, points: { size: 7 } },
          scales: { x: { time: false } },
          axes: [
            {
              stroke: muted,
              grid: { show: false },
              ticks: { stroke: line, width: 0.6, size: 4 },
              incrs: [12, 24, 60],
              values: (_u, ticks) =>
                ticks.map((v) => (v % 12 === 0 ? t(locale, 'unit.yearsShort', { n: v / 12 }) : '')),
            },
            {
              stroke: muted,
              grid: { stroke: line, width: 0.6, dash: [2, 4] },
              ticks: { show: false },
              size: 60,
              values: (_u, ticks) => ticks.map(lakh),
            },
          ],
          series: [
            {},
            { stroke: ink, width: 1.25 },
            { stroke: muted, width: 1, dash: [4, 4] },
            { stroke: 'transparent', width: 0, points: { show: false } },
            { stroke: 'transparent', width: 0, points: { show: false } },
          ],
          bands: [{ series: [4, 3], fill: `${accent}22` }],
          hooks: {
            drawClear: [
              (u) => {
                const y = u.valToPos(0, 'y', true);
                const ctx = u.ctx;
                ctx.save();
                ctx.strokeStyle = strong;
                ctx.lineWidth = 0.75 * devicePixelRatio;
                ctx.beginPath();
                ctx.moveTo(u.bbox.left, y);
                ctx.lineTo(u.bbox.left + u.bbox.width, y);
                ctx.stroke();
                ctx.restore();
              },
            ],
            draw: [
              (u) => {
                if (netNoInterest) dot(u, breakevenNoInterest, netNoInterest, false);
                dot(u, breakevenWithInterest, netWithInterest, true);
              },
            ],
          },
        },
        [
          months,
          netWithInterest,
          netNoInterest ?? netWithInterest.map(() => null),
          bandLow ?? netWithInterest,
          bandHigh ?? netWithInterest,
        ],
        box.current,
      );

      setLoaded(true);
      resize = new ResizeObserver(() => {
        if (box.current) plot.current?.setSize({ width: box.current.clientWidth, height: HEIGHT });
      });
      resize.observe(box.current);
    };

    void build();
    const themeWatch = new MutationObserver(() => void build());
    themeWatch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      cancelled = true;
      resize?.disconnect();
      themeWatch.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
  }, [
    near,
    netWithInterest,
    netNoInterest,
    bandLow,
    bandHigh,
    breakevenWithInterest,
    breakevenNoInterest,
    locale,
  ]);

  return (
    <figure>
      <figcaption class="font-display text-xl font-medium">{title}</figcaption>
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
        <span class="inline-flex items-center gap-2">
          <span class="h-px w-5 bg-ink" />
          {legend.main}
        </span>
        {legend.secondary && netNoInterest && (
          <span class="inline-flex items-center gap-2">
            <span class="w-5 border-t border-dashed border-ink-subtle" />
            {legend.secondary}
          </span>
        )}
        {bandLow && legend.band && (
          <span class="inline-flex items-center gap-2">
            <span class="h-3 w-5 rounded-sm bg-accent/15" />
            {legend.band}
          </span>
        )}
      </div>
      <div class="relative mt-4" style={{ height: `${HEIGHT}px` }} aria-hidden="true">
        <div ref={box} class="h-full w-full" />
        {!loaded && !failed && <div class="skeleton absolute inset-0" />}
        {failed && (
          <p class="absolute inset-0 flex items-center justify-center rounded-lg bg-surface px-6 text-center text-sm text-ink-muted">
            {t(locale, 'chart.failed')}
          </p>
        )}
      </div>
    </figure>
  );
}
