import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { prepayOrInvest, type PrepayInput } from '@/models/prepay';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** The guide's ₹40 lakh loan: prepay any amount, see both choices side by side. */
export default function LowerEmiWidget() {
  const [lump, setLump] = useState(500_000);
  const [rate, setRate] = useState(0.09);
  const base: PrepayInput = {
    outstanding: 4_000_000,
    loanRate: rate,
    yearsLeft: 20,
    lumpSum: lump,
    yearlyAmount: 0,
    mode: 'reduceTenure',
    investmentReturn: 0.08,
    prepaymentCharge: 0,
    interestTaxRate: 0,
    interestDeductionCap: 0,
    inflation: 0.06,
  };
  const [keep, lower] = useMemo(
    () => [prepayOrInvest(base), prepayOrInvest({ ...base, mode: 'reduceEmi' })],
    [lump, rate],
  );
  return (
    <Frame title={t('en', 'guide.lowerEmi.title')} toolPath="/tools/prepay-or-invest/">
      <Inputs>
        <Slider
          label={t('en', 'guide.lowerEmi.lump')}
          value={lump}
          display={short(lump)}
          min={100_000}
          max={2_000_000}
          step={50_000}
          onChange={setLump}
        />
        <Slider
          label={t('en', 'guide.loanRate')}
          value={rate}
          display={`${Number((rate * 100).toFixed(2))}%`}
          min={0.07}
          max={0.12}
          step={0.0025}
          onChange={setRate}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', 'guide.lowerEmi.keepSaves'),
            value: formatMoney(keep.interestSaved),
            main: true,
          },
          { label: t('en', 'guide.lowerEmi.lowerSaves'), value: formatMoney(lower.interestSaved) },
        ]}
      >
        <Verdict>
          {t('en', 'guide.lowerEmi.verdict', {
            sooner: formatDuration('en', keep.monthsSaved),
            emi: formatINR(lower.emiAfterLump),
            less: formatINR(keep.emi - lower.emiAfterLump),
          })}
        </Verdict>
      </Results>
    </Frame>
  );
}
