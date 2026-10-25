import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { toTodaysRupees } from '@/engine/timeValue';
import { Choice, Frame, Inputs, Results, Slider, Verdict } from './parts';

const SLABS = [0, 0.05, 0.1, 0.2, 0.3] as const;

/** An FD's rate after tax at your slab, then after inflation, and ₹10 lakh after 10 years. */
export default function FdWidget() {
  const [slab, setSlab] = useState<number>(0.3);
  const [rate, setRate] = useState(0.07);
  const [inflation, setInflation] = useState(0.06);
  const tax = slab * (1 + incomeTax.cessRate);
  const after = rate * (1 - tax);
  const real = (1 + after) / (1 + inflation) - 1;
  const end = 1_000_000 * Math.pow(1 + after, 10);
  const today = toTodaysRupees(end, inflation, 120);
  const signed = (r: number) =>
    `${r > 0.00005 ? '+' : r < -0.00005 ? '−' : ''}${formatPercent(Number(Math.abs(r).toFixed(4)))}`;
  return (
    <Frame title={t('en', 'guide.fd.title')} toolPath="/tools/plot-vs-fd-vs-mutual-fund/">
      <Inputs>
        <Choice<number>
          label={t('en', 'guide.fd.slab')}
          value={slab}
          onChange={setSlab}
          options={SLABS.map((s) => ({
            value: s,
            label: s === 0 ? t('en', 'guide.fd.noTax') : formatPercent(s),
          }))}
        />
        <Slider
          label={t('en', 'guide.fd.rate')}
          value={rate}
          display={formatPercent(rate)}
          min={0.05}
          max={0.09}
          step={0.001}
          onChange={setRate}
        />
        <Slider
          label={t('en', 'guide.inflation')}
          value={inflation}
          display={formatPercent(inflation)}
          min={0.03}
          max={0.09}
          step={0.005}
          onChange={setInflation}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', 'guide.fd.after'),
            value: formatPercent(Number(after.toFixed(4))),
          },
          { label: t('en', 'guide.fd.real'), value: signed(real), main: true },
          { label: t('en', 'guide.fd.today'), value: formatMoney(today) },
        ]}
      >
        <Verdict>
          {t('en', real < 0 ? 'guide.fd.losing' : 'guide.fd.gaining', {
            end: formatMoney(end),
            today: formatMoney(today),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
