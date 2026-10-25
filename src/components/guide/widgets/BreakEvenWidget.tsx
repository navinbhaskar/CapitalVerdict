import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { payback } from '@/models/payback';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** Any pay-more-now, save-later choice: the simple and the honest break-even. */
export default function BreakEvenWidget() {
  const [extra, setExtra] = useState(90_000);
  const [saving, setSaving] = useState(2_778);
  const [rate, setRate] = useState(0.09);
  const r = payback(extra, saving, rate, 360);
  // As in the tools: the simple answer to the nearest month, the honest one as the month it is reached.
  const simple = r.noInterest ? Math.round(r.noInterest.fractionalMonth) : null;
  const months = (n: number | null) =>
    n === null ? t('en', 'guide.breakEven.never') : t('en', 'guide.months', { n });
  return (
    <Frame title={t('en', 'guide.breakEven.title')}>
      <Inputs>
        <Slider
          label={t('en', 'guide.breakEven.extra')}
          value={extra}
          display={short(extra)}
          min={5_000}
          max={500_000}
          step={5_000}
          onChange={setExtra}
        />
        <Slider
          label={t('en', 'guide.breakEven.saving')}
          value={saving}
          display={formatINR(saving)}
          min={100}
          max={20_000}
          step={50}
          onChange={setSaving}
        />
        <Slider
          label={t('en', 'guide.breakEven.rate')}
          value={rate}
          display={formatPercent(rate)}
          min={0}
          max={0.15}
          step={0.005}
          onChange={setRate}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.breakEven.simple'), value: months(simple) },
          {
            label: t('en', 'guide.breakEven.honest'),
            value: months(r.withInterest?.month ?? null),
            main: true,
          },
        ]}
      >
        {r.withInterest && simple !== null && r.withInterest.month > simple && (
          <Verdict>
            {t('en', 'guide.breakEven.gap', {
              n: r.withInterest.month - simple,
              owed: formatINR(r.owed[r.withInterest.month]!),
            })}
          </Verdict>
        )}
      </Results>
    </Frame>
  );
}
