import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { fundPlan } from '@/models/fund';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A SIP kept flat against the same SIP raised every year, both after tax. */
export default function StepUpWidget() {
  const [monthly, setMonthly] = useState(10_000);
  const [stepUp, setStepUp] = useState(0.1);
  const [years, setYears] = useState(15);
  const [ret, setRet] = useState(0.1);
  const [flat, stepped] = useMemo(() => {
    const base = {
      lumpSum: 0,
      monthly,
      stepUp: 0,
      withdrawal: 0,
      withdrawalRise: 0,
      years,
      annualReturn: ret,
      inflation: 0.06,
    };
    return [fundPlan(base, incomeTax), fundPlan({ ...base, stepUp }, incomeTax)];
  }, [monthly, stepUp, years, ret]);
  return (
    <Frame title={t('en', 'guide.stepUp.title')} toolPath="/tools/sip-calculator/">
      <Inputs>
        <Slider
          label={t('en', 'fund.in.monthly')}
          value={monthly}
          display={formatINR(monthly)}
          min={1_000}
          max={100_000}
          step={1_000}
          onChange={setMonthly}
        />
        <Slider
          label={t('en', 'fund.in.stepUp')}
          value={stepUp}
          display={formatPercent(stepUp)}
          min={0}
          max={0.2}
          step={0.01}
          onChange={setStepUp}
        />
        <Slider
          label={t('en', 'fund.in.years')}
          value={years}
          display={t('en', 'duration.years', { n: years })}
          min={5}
          max={30}
          step={1}
          onChange={setYears}
        />
        <Slider
          label={t('en', 'fund.in.annualReturn')}
          value={ret}
          display={formatPercent(ret)}
          min={0.04}
          max={0.15}
          step={0.005}
          onChange={setRet}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.stepUp.flat'), value: formatMoney(flat.kept) },
          { label: t('en', 'guide.stepUp.stepped'), value: formatMoney(stepped.kept), main: true },
        ]}
      >
        <Verdict>
          {t('en', 'guide.stepUp.verdict', {
            invested: formatMoney(stepped.invested - flat.invested),
            more: formatMoney(stepped.kept - flat.kept),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
