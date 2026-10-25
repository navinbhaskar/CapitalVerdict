import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { flatToReducing } from '@/models/flatRate';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A flat-rate quote turned into the reducing-balance rate it really charges. */
export default function FlatRateWidget() {
  const [amount, setAmount] = useState(800_000);
  const [flat, setFlat] = useState(0.05);
  const [years, setYears] = useState(5);
  const interest = amount * flat * years;
  const emi = (amount + interest) / (years * 12);
  const real = flatToReducing(flat, years);
  return (
    <Frame title={t('en', 'guide.flat.title')} toolPath="/tools/cash-or-car-loan/">
      <Inputs>
        <Slider
          label={t('en', 'guide.flat.amount')}
          value={amount}
          display={short(amount)}
          min={100_000}
          max={2_500_000}
          step={50_000}
          onChange={setAmount}
        />
        <Slider
          label={t('en', 'guide.flat.rate')}
          value={flat}
          display={formatPercent(flat)}
          min={0.02}
          max={0.12}
          step={0.0025}
          onChange={setFlat}
        />
        <Slider
          label={t('en', 'guide.flat.years')}
          value={years}
          display={t('en', years === 1 ? 'duration.year' : 'duration.years', { n: years })}
          min={1}
          max={7}
          step={1}
          onChange={setYears}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.flat.emi'), value: formatINR(emi) },
          { label: t('en', 'guide.flat.interest'), value: formatMoney(interest) },
          {
            label: t('en', 'guide.flat.real'),
            value: formatPercent(Number(real.toFixed(4))),
            main: true,
          },
        ]}
      >
        <Verdict>
          {t('en', 'guide.flat.verdict', {
            flat: formatPercent(flat),
            real: formatPercent(Number(real.toFixed(4))),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
