import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { useIdleValue } from '@/lib/useIdleValue';
import { fundPlan, maxWithdrawal } from '@/models/fund';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A retirement corpus paying a monthly withdrawal: does it last, and what is the most it can pay? */
export default function SwpWidget() {
  const [corpus, setCorpus] = useState(5_000_000);
  const [withdrawal, setWithdrawal] = useState(30_000);
  const [rise, setRise] = useState(0.06);
  const [ret, setRet] = useState(0.1);
  const [years, setYears] = useState(25);
  const input = {
    lumpSum: corpus,
    monthly: 0,
    stepUp: 0,
    withdrawal,
    withdrawalRise: rise,
    years,
    annualReturn: ret,
    inflation: 0.06,
  };
  const r = useMemo(() => fundPlan(input, incomeTax), [corpus, withdrawal, rise, ret, years]);
  const max = useIdleValue(() => maxWithdrawal(input, incomeTax), [corpus, rise, ret, years]);
  return (
    <Frame title={t('en', 'guide.swp.title')} toolPath="/tools/swp-calculator/">
      <Inputs>
        <Slider
          label={t('en', 'guide.swp.corpus')}
          value={corpus}
          display={short(corpus)}
          min={500_000}
          max={50_000_000}
          step={100_000}
          onChange={setCorpus}
        />
        <Slider
          label={t('en', 'fund.in.withdrawal')}
          value={withdrawal}
          display={formatINR(withdrawal)}
          min={5_000}
          max={300_000}
          step={1_000}
          onChange={setWithdrawal}
        />
        <Slider
          label={t('en', 'fund.in.withdrawalRise')}
          value={rise}
          display={formatPercent(rise)}
          min={0}
          max={0.1}
          step={0.005}
          onChange={setRise}
        />
        <Slider
          label={t('en', 'fund.in.annualReturn')}
          value={ret}
          display={formatPercent(ret)}
          min={0.04}
          max={0.14}
          step={0.005}
          onChange={setRet}
        />
        <Slider
          label={t('en', 'guide.swp.years')}
          value={years}
          display={t('en', 'duration.years', { n: years })}
          min={5}
          max={40}
          step={1}
          onChange={setYears}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', 'guide.swp.lasts'),
            value:
              r.depletedMonth === null
                ? t('en', 'guide.swp.allYears')
                : formatDuration('en', r.depletedMonth - 1),
            main: true,
          },
          {
            label: t('en', 'guide.swp.left'),
            value: formatMoney(r.value),
          },
          {
            label: t('en', 'guide.swp.max'),
            value: max === null ? '…' : formatINR(max),
          },
        ]}
      >
        <Verdict>
          {t('en', 'guide.swp.verdict', {
            withdrawn: formatMoney(r.withdrawn),
            tax: formatMoney(r.withdrawalTax),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
