import { useEffect, useRef } from 'preact/hooks';
import type uPlotType from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { t, type Locale } from '@/i18n/t';
import { formatMoney } from '@/lib/formatTool';

interface Props {
  locale: Locale;
  /** Index = month (0 … horizon). */
  saving: number[];
  cost: number[];
  bandLow: number[];
  bandHigh: number[];
  breakevenMonth: number | null;
}

const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Cumulative fuel saving vs extra price with interest, with the scenario band behind it.
 * uPlot loads lazily so it never blocks the first render. A data table follows for screen readers
 * and anyone who prefers numbers.
 */
export default function CumulativeChart(props: Props) {
  const { locale, saving, cost, bandLow, bandHigh, breakevenMonth } = props;
  const box = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlotType | null>(null);
  const months = saving.map((_, m) => m);

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
      const accent = cssVar('--color-accent');
      const lakh = (v: number) => t(locale, 'unit.lakhShort', { n: Number((v / 1e5).toFixed(1)) });

      plot.current = new uPlot(
        {
          width: box.current.clientWidth,
          height: 280,
          legend: { show: false },
          cursor: { drag: { x: false, y: false }, points: { size: 7 } },
          scales: { x: { time: false } },
          axes: [
            {
              stroke: muted,
              grid: { show: false },
              ticks: { stroke: line },
              values: (_u, ticks) =>
                ticks.map((v) => (v % 12 === 0 ? t(locale, 'unit.yearsShort', { n: v / 12 }) : '')),
              incrs: [12, 24, 60],
            },
            {
              stroke: muted,
              grid: { stroke: line, width: 1 },
              ticks: { show: false },
              size: 56,
              values: (_u, ticks) => ticks.map(lakh),
            },
          ],
          series: [
            {},
            { label: t(locale, 'chart.saving'), stroke: ink, width: 2.25 },
            { label: t(locale, 'chart.cost'), stroke: muted, width: 2, dash: [6, 6] },
            { label: 'low', stroke: 'transparent', width: 0, points: { show: false } },
            { label: 'high', stroke: 'transparent', width: 0, points: { show: false } },
          ],
          bands: [{ series: [4, 3], fill: `${accent}22` }],
          hooks: {
            draw: [
              (u) => {
                if (breakevenMonth === null) return;
                const x = u.valToPos(breakevenMonth, 'x', true);
                const y = u.valToPos(saving[breakevenMonth]!, 'y', true);
                const ctx = u.ctx;
                ctx.save();
                ctx.fillStyle = accent;
                ctx.globalAlpha = 0.18;
                ctx.beginPath();
                ctx.arc(x, y, 11 * devicePixelRatio, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(x, y, 5 * devicePixelRatio, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              },
            ],
          },
        },
        [months, saving, cost, bandLow, bandHigh],
        box.current,
      );

      resize = new ResizeObserver(() => {
        if (box.current) plot.current?.setSize({ width: box.current.clientWidth, height: 280 });
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
  }, [saving, cost, bandLow, bandHigh, breakevenMonth, locale]);

  const yearRows = months.filter((m) => m > 0 && m % 12 === 0);

  return (
    <figure>
      <figcaption class="text-lg font-semibold">{t(locale, 'chart.title')}</figcaption>
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
        <span class="inline-flex items-center gap-2">
          <span class="h-0.5 w-5 rounded bg-ink" />
          {t(locale, 'chart.saving')}
        </span>
        <span class="inline-flex items-center gap-2">
          <span class="w-5 border-t-2 border-dashed border-ink-subtle" />
          {t(locale, 'chart.cost')}
        </span>
        <span class="inline-flex items-center gap-2">
          <span class="h-3 w-5 rounded-sm bg-accent/15" />
          {t(locale, 'chart.band')}
        </span>
      </div>
      <div ref={box} class="mt-4 h-[280px] w-full" aria-hidden="true" />
      <details class="mt-4 text-sm">
        <summary class="inline-flex min-h-11 cursor-pointer items-center font-medium text-accent-strong">
          {t(locale, 'chart.showTable')}
        </summary>
        <div class="mt-2 overflow-x-auto">
          <table class="w-full min-w-[20rem] text-left num">
            <thead class="text-ink-muted">
              <tr class="border-b border-line">
                <th scope="col" class="py-2 pr-4 font-medium">
                  {t(locale, 'chart.year')}
                </th>
                <th scope="col" class="py-2 pr-4 font-medium">
                  {t(locale, 'chart.saving')}
                </th>
                <th scope="col" class="py-2 font-medium">
                  {t(locale, 'chart.cost')}
                </th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((m) => (
                <tr key={m} class="border-b border-line">
                  <th scope="row" class="py-2 pr-4 font-normal">
                    {m / 12}
                  </th>
                  <td class="py-2 pr-4">{formatMoney(saving[m]!)}</td>
                  <td class="py-2">{formatMoney(cost[m]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
