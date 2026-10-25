import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { useIdleValue } from '@/lib/useIdleValue';
import { prepayFlips, prepayOrInvest, type PrepayInput } from '@/models/prepay';
import CompareBars from '@/components/tool/CompareBars';
import { Choice, Frame, Inputs, Results, Slider, Verdict } from './parts';

/** The guide's ₹40 lakh loan and ₹5 lakh: your return, with or without the interest deduction. */
export default function PrepayWidget() {
  const [ret, setRet] = useState(0.08);
  const [deduct, setDeduct] = useState<'no' | 'yes'>('no');
  const input: PrepayInput = {
    outstanding: 4_000_000,
    loanRate: 0.09,
    yearsLeft: 20,
    lumpSum: 500_000,
    yearlyAmount: 0,
    mode: 'reduceTenure',
    investmentReturn: ret,
    prepaymentCharge: 0,
    interestTaxRate: deduct === 'yes' ? 0.312 : 0,
    interestDeductionCap: deduct === 'yes' ? 200_000 : 0,
    inflation: 0.06,
  };
  const r = useMemo(() => prepayOrInvest(input), [ret, deduct]);
  const edge = useIdleValue(() => prepayFlips(input, ['investmentReturn'])[0] ?? null, [deduct]);
  const d = r.atEnd.difference;
  return (
    <Frame title={t('en', 'guide.prepay.title')} toolPath="/tools/prepay-or-invest/">
      <Inputs>
        <Slider
          label={t('en', 'guide.prepay.return')}
          value={ret}
          display={formatPercent(ret)}
          min={0.04}
          max={0.14}
          step={0.0025}
          onChange={setRet}
        />
        <Choice<'no' | 'yes'>
          label={t('en', 'guide.prepay.deduct')}
          value={deduct}
          onChange={setDeduct}
          options={[
            { value: 'no', label: t('en', 'guide.prepay.deductNo') },
            { value: 'yes', label: t('en', 'guide.prepay.deductYes') },
          ]}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', d >= 0 ? 'guide.prepay.prepayAhead' : 'guide.prepay.investAhead'),
            value: formatMoney(Math.abs(d)),
            main: true,
          },
        ]}
      >
        <div class="mt-4">
          <CompareBars
            caption={t('en', 'guide.prepay.caption')}
            bare
            items={[
              {
                label: t('en', 'guide.prepay.prepay'),
                value: r.atEnd.prepay,
                display: formatMoney(r.atEnd.prepay),
                best: d >= 0,
              },
              {
                label: t('en', 'guide.prepay.invest'),
                value: r.atEnd.invest,
                display: formatMoney(r.atEnd.invest),
                best: d < 0,
              },
            ]}
          />
        </div>
        {edge && (
          <Verdict>
            {t('en', 'guide.prepay.edge', {
              rate: formatPercent(Number(edge.threshold.toFixed(4))),
            })}
          </Verdict>
        )}
      </Results>
    </Frame>
  );
}
