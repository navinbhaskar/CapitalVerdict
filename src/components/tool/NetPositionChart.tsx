import { useEffect, useRef, useState } from 'preact/hooks';
import type uPlotType from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { t, type Locale } from '@/i18n/t';

interface Props {
  locale: Locale;
  title: string;
  /** Index = month (0 … horizon). Net = cumulative saving − extra price (± interest). */
  netWithInterest: number[];
  netNoInterest: number[];
  /** Scenario envelope for the with-interest line. */
  bandLow: number[];
  bandHigh: number[];
  breakevenWithInterest: number | null;
  breakevenNoInterest: number | null;
}

const HEIGHT = 300;
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
    breakevenNoInterest,
  } = props;
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlotType | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver | undefined;

    const build = async () => {
      const { default: uPlot } = await import('uplot');
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
        if (filled) {
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(x, y, 11 * r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(x, y, (filled ? 5 : 3.5) * r, 0, Math.PI * 2);
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
              ticks: { stroke: line },
              incrs: [12, 24, 60],
              values: (_u, ticks) =>
                ticks.map((v) => (v % 12 === 0 ? t(locale, 'unit.yearsShort', { n: v / 12 }) : '')),
            },
            {
              stroke: muted,
              grid: { stroke: line, width: 1 },
              ticks: { show: false },
              size: 60,
              values: (_u, ticks) => ticks.map(lakh),
            },
          ],
          series: [
            {},
            { stroke: ink, width: 2.25 },
            { stroke: muted, width: 2, dash: [6, 6] },
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
                ctx.lineWidth = 1.5 * devicePixelRatio;
                ctx.beginPath();
                ctx.moveTo(u.bbox.left, y);
                ctx.lineTo(u.bbox.left + u.bbox.width, y);
                ctx.stroke();
                ctx.restore();
              },
            ],
            draw: [
              (u) => {
                dot(u, breakevenNoInterest, netNoInterest, false);
                dot(u, breakevenWithInterest, netWithInterest, true);
              },
            ],
          },
        },
        [months, netWithInterest, netNoInterest, bandLow, bandHigh],
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
      <figcaption class="font-display text-xl font-semibold">{title}</figcaption>
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
        <span class="inline-flex items-center gap-2">
          <span class="h-0.5 w-5 rounded bg-ink" />
          {t(locale, 'chart.netWithInterest')}
        </span>
        <span class="inline-flex items-center gap-2">
          <span class="w-5 border-t-2 border-dashed border-ink-subtle" />
          {t(locale, 'chart.netNoInterest')}
        </span>
        <span class="inline-flex items-center gap-2">
          <span class="h-3 w-5 rounded-sm bg-accent/15" />
          {t(locale, 'chart.netBand')}
        </span>
      </div>
      <div class="relative mt-4" style={{ height: `${HEIGHT}px` }} aria-hidden="true">
        <div ref={box} class="h-full w-full" />
        {!loaded && <div class="skeleton absolute inset-0" />}
      </div>
    </figure>
  );
}
