import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax, smallSavings } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { useIdleValue } from '@/lib/useIdleValue';
import { monthlySaving, sipBreakEven } from '@/models/monthlySaving';
import CompareBars from '@/components/tool/CompareBars';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** The guide's ₹10,000 a month for 15 years, with your own amount and fund return. */
export default function SipWidget() {
  const [monthly, setMonthly] = useState(10_000);
  const [sipReturn, setSipReturn] = useState(0.1);
  const input = {
    monthly,
    years: 15,
    sipReturn,
    ppfRate: smallSavings.ppf.rate,
    rdRate: 0.07,
    taxRate: 0.312,
    inflation: 0.06,
  };
  const r = useMemo(() => monthlySaving(input, incomeTax, smallSavings.ppf), [monthly, sipReturn]);
  const edge = useIdleValue(() => sipBreakEven(input, incomeTax, smallSavings.ppf), [monthly]);
  const after = (tax: number) => t('en', 'guide.afterTax', { amount: formatMoney(tax) });
  return (
    <Frame title={t('en', 'guide.sip.title')} toolPath="/tools/sip-vs-ppf-vs-fd/">
      <Inputs>
        <Slider
          label={t('en', 'guide.sip.monthly')}
          value={monthly}
          display={formatINR(monthly)}
          min={1_000}
          max={12_500}
          step={500}
          onChange={setMonthly}
        />
        <Slider
          label={t('en', 'guide.sip.return')}
          value={sipReturn}
          display={formatPercent(sipReturn)}
          min={0.04}
          max={0.15}
          step={0.005}
          onChange={setSipReturn}
        />
      </Inputs>
      <Results items={[{ label: t('en', 'guide.sip.saved'), value: short(r.deposited) }]}>
        <div class="mt-4">
          <CompareBars
            caption={t('en', 'guide.sip.caption')}
            bare
            items={[
              {
                label: t('en', 'guide.sip.sip'),
                value: r.sip.net,
                display: formatMoney(r.sip.net),
                tax: r.sip.tax,
                note: after(r.sip.tax),
                best: r.best === 'sip',
              },
              {
                label: t('en', 'guide.sip.ppf'),
                value: r.ppf.net,
                display: formatMoney(r.ppf.net),
                note: t('en', 'guide.taxFree'),
                best: r.best === 'ppf',
              },
              {
                label: t('en', 'guide.sip.rd'),
                value: r.rd.net,
                display: formatMoney(r.rd.net),
                tax: r.rd.tax,
                note: after(r.rd.tax),
                best: r.best === 'rd',
              },
            ]}
          />
        </div>
        {edge && (
          <Verdict>
            {t('en', 'guide.sip.edge', {
              rate: formatPercent(Number(edge.threshold.toFixed(4))),
            })}
          </Verdict>
        )}
      </Results>
    </Frame>
  );
}
