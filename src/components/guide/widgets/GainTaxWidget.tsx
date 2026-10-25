import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { Choice, Frame, Inputs, Results, Slider, Verdict } from './parts';

type Held = 'short' | 'long';

/** Tax on an equity fund gain: short- or long-term, sold in one year or split over two. */
export default function GainTaxWidget() {
  const [gain, setGain] = useState(300_000);
  const [held, setHeld] = useState<Held>('long');
  const [years, setYears] = useState<1 | 2>(1);
  const cg = incomeTax.capitalGains;
  const cess = 1 + incomeTax.cessRate;
  const perYear = gain / years;
  const tax =
    held === 'short'
      ? gain * cg.equityShortTermRate * cess
      : years * Math.max(0, perYear - cg.equityLongTermExemption) * cg.longTermRate * cess;
  return (
    <Frame title={t('en', 'guide.gain.title')} toolPath="/tools/sip-vs-ppf-vs-fd/">
      <Inputs>
        <Slider
          label={t('en', 'guide.gain.amount')}
          value={gain}
          display={short(gain)}
          min={0}
          max={1_000_000}
          step={5_000}
          onChange={setGain}
        />
        <Choice<Held>
          label={t('en', 'guide.gain.held')}
          value={held}
          onChange={setHeld}
          options={[
            { value: 'short', label: t('en', 'guide.gain.short') },
            { value: 'long', label: t('en', 'guide.gain.long') },
          ]}
        />
        {held === 'long' && (
          <Choice<1 | 2>
            label={t('en', 'guide.gain.when')}
            value={years}
            onChange={setYears}
            options={[
              { value: 1, label: t('en', 'guide.gain.oneYear') },
              { value: 2, label: t('en', 'guide.gain.twoYears') },
            ]}
          />
        )}
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.gain.tax'), value: formatINR(tax), main: true },
          { label: t('en', 'guide.gain.keep'), value: short(gain - tax) },
          {
            label: t('en', 'guide.gain.share'),
            value: gain > 0 ? formatPercent(Number((tax / gain).toFixed(4))) : '0%',
          },
        ]}
      >
        {held === 'long' && (
          <Verdict>
            {t('en', 'guide.gain.exempt', {
              amount: short(Math.min(perYear, cg.equityLongTermExemption) * years),
            })}
          </Verdict>
        )}
      </Results>
    </Frame>
  );
}
