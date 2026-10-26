import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { smallSavings } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { payoutScaleAt, planReturn } from '@/models/planReturn';
import { Choice, Frame, Inputs, Results, Slider, Verdict } from './parts';

const PPF = smallSavings.ppf.rate;

/** Premiums for some years, then a monthly income: what the plan really earns a year. */
export default function PlanWidget() {
  const [premium, setPremium] = useState(50_000);
  const [payYears, setPayYears] = useState(15);
  const [income, setIncome] = useState(5_000);
  const [incomeYears, setIncomeYears] = useState(25);
  const [returned, setReturned] = useState<'yes' | 'no'>('yes');
  const r = useMemo(
    () =>
      planReturn({
        premium,
        payFrequency: 'yearly',
        payYears,
        income,
        incomeFrequency: 'monthly',
        incomeStartYear: payYears + 1,
        incomeYears,
        lumpSums:
          returned === 'yes' ? [{ amount: premium * payYears, year: payYears + incomeYears }] : [],
        taxRate: 0,
        inflation: 0.06,
      }),
    [premium, payYears, income, incomeYears, returned],
  );
  const scale = payoutScaleAt(r, PPF);
  return (
    <Frame title={t('en', 'guide.plan.title')} toolPath="/tools/plan-return/">
      <Inputs>
        <Slider
          label={t('en', 'guide.plan.premium')}
          value={premium}
          display={formatINR(premium)}
          min={10_000}
          max={500_000}
          step={5_000}
          onChange={setPremium}
        />
        <Slider
          label={t('en', 'guide.plan.payYears')}
          value={payYears}
          display={t('en', 'duration.years', { n: payYears })}
          min={5}
          max={25}
          step={1}
          onChange={setPayYears}
        />
        <Slider
          label={t('en', 'guide.plan.income')}
          value={income}
          display={formatINR(income)}
          min={1_000}
          max={50_000}
          step={500}
          onChange={setIncome}
        />
        <Slider
          label={t('en', 'guide.plan.incomeYears')}
          value={incomeYears}
          display={t('en', 'duration.years', { n: incomeYears })}
          min={5}
          max={40}
          step={1}
          onChange={setIncomeYears}
        />
        <Choice
          label={t('en', 'guide.plan.returned')}
          options={[
            { value: 'yes', label: t('en', 'guide.plan.returnedYes') },
            { value: 'no', label: t('en', 'guide.plan.returnedNo') },
          ]}
          value={returned}
          onChange={setReturned}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', 'guide.plan.return'),
            value: r.annualReturn === null ? '–' : formatPercent(Number(r.annualReturn.toFixed(4))),
            main: true,
          },
          {
            label: t('en', 'guide.plan.times'),
            value: t('en', 'guide.plan.timesValue', { n: (r.received / r.paid).toFixed(1) }),
          },
          {
            label: t('en', 'guide.plan.ppf', { rate: formatPercent(PPF) }),
            value: scale === null ? '–' : formatINR(income * scale),
          },
        ]}
      >
        <Verdict>
          {t('en', 'guide.plan.verdict', {
            paid: formatMoney(r.paid),
            received: formatMoney(r.received),
            year: r.paybackYear ?? '–',
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
