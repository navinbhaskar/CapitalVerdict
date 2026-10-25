import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatDuration } from '@/lib/duration';
import { acPayback } from '@/models/ac';
import { Frame, Inputs, Results, Slider } from './parts';

/** The guide's two ACs: how much you run it and what you pay a unit decide the payback. */
export default function AcWidget() {
  const [usage, setUsage] = useState(1);
  const [price, setPrice] = useState(7);
  const r = useMemo(
    () =>
      acPayback({
        basicPrice: 35_000,
        efficientPrice: 45_000,
        basicUnits: 1_100,
        efficientUnits: 750,
        usage,
        pricePerUnit: price,
        tariffRise: 0.03,
        interestRate: 0.09,
        years: 10,
      }),
    [usage, price],
  );
  return (
    <Frame title={t('en', 'guide.ac.title')} toolPath="/tools/ac-payback/">
      <Inputs>
        <Slider
          label={t('en', 'guide.ac.usage')}
          value={usage}
          display={`${Math.round(usage * 100)}%`}
          min={0.25}
          max={2}
          step={0.05}
          onChange={setUsage}
        />
        <Slider
          label={t('en', 'guide.ac.price')}
          value={price}
          display={`₹${price.toFixed(2)}`}
          min={4}
          max={12}
          step={0.25}
          onChange={setPrice}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.ac.saves'), value: formatINR(r.firstYearSaving) },
          {
            label: t('en', 'guide.ac.payback'),
            value: r.breakevenWithInterest
              ? formatDuration('en', r.breakevenWithInterest.months)
              : t('en', 'guide.ac.never'),
            main: true,
          },
          {
            label: t('en', r.netGain >= 0 ? 'guide.ac.ahead' : 'guide.ac.behind'),
            value: formatINR(Math.abs(r.netGain)),
          },
        ]}
      />
    </Frame>
  );
}
