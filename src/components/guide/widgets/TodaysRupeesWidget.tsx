import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatMoney, formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { realRate, toTodaysRupees } from '@/engine/timeValue';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A future amount in today's rupees, and a return after inflation. */
export default function TodaysRupeesWidget() {
  const [amount, setAmount] = useState(10_000_000);
  const [years, setYears] = useState(15);
  const [inflation, setInflation] = useState(0.06);
  const [ret, setRet] = useState(0.08);
  const today = toTodaysRupees(amount, inflation, years * 12);
  const real = realRate(ret, inflation);
  const signed = `${real > 0.00005 ? '+' : real < -0.00005 ? '−' : ''}${formatPercent(Number(Math.abs(real).toFixed(4)))}`;
  return (
    <Frame title={t('en', 'guide.todays.title')}>
      <Inputs>
        <Slider
          label={t('en', 'guide.todays.amount')}
          value={amount}
          display={short(amount)}
          min={500_000}
          max={50_000_000}
          step={500_000}
          onChange={setAmount}
        />
        <Slider
          label={t('en', 'guide.todays.years')}
          value={years}
          display={t('en', 'duration.years', { n: years })}
          min={1}
          max={40}
          step={1}
          onChange={setYears}
        />
        <Slider
          label={t('en', 'guide.inflation')}
          value={inflation}
          display={formatPercent(inflation)}
          min={0.02}
          max={0.1}
          step={0.0025}
          onChange={setInflation}
        />
        <Slider
          label={t('en', 'guide.todays.return')}
          value={ret}
          display={formatPercent(ret)}
          min={0}
          max={0.15}
          step={0.0025}
          onChange={setRet}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.todays.worth'), value: formatMoney(today), main: true },
          { label: t('en', 'guide.todays.real'), value: signed },
        ]}
      >
        <Verdict>
          {t('en', 'guide.todays.verdict', {
            amount: short(amount),
            n: years,
            today: formatMoney(today),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
