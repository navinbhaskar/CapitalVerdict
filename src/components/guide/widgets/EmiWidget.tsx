import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { amortise, emi as emiOf, type Prepayment } from '@/engine/loan';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A loan's EMI, its first-month split, and what a yearly prepayment (EMI kept) saves. */
export default function EmiWidget() {
  const [amount, setAmount] = useState(4_000_000);
  const [rate, setRate] = useState(0.09);
  const [years, setYears] = useState(20);
  const [extra, setExtra] = useState(0);
  const months = years * 12;
  const r = useMemo(() => {
    const plain = amortise(amount, rate, months);
    const prepayments: Prepayment[] = [];
    for (let m = 12; m < months; m += 12) prepayments.push({ month: m, amount: extra });
    const faster = extra > 0 ? amortise(amount, rate, months, { prepayments }) : plain;
    return { plain, faster };
  }, [amount, rate, years, extra]);
  const emi = emiOf(amount, rate, months);
  const firstInterest = amount * (rate / 12);
  return (
    <Frame title={t('en', 'guide.emi.title')} toolPath="/tools/prepay-or-invest/">
      <Inputs>
        <Slider
          label={t('en', 'guide.emi.amount')}
          value={amount}
          display={short(amount)}
          min={500_000}
          max={20_000_000}
          step={100_000}
          onChange={setAmount}
        />
        <Slider
          label={t('en', 'guide.loanRate')}
          value={rate}
          display={formatPercent(rate)}
          min={0.06}
          max={0.13}
          step={0.0025}
          onChange={setRate}
        />
        <Slider
          label={t('en', 'guide.emi.years')}
          value={years}
          display={t('en', 'duration.years', { n: years })}
          min={5}
          max={30}
          step={1}
          onChange={setYears}
        />
        <Slider
          label={t('en', 'guide.emi.extra')}
          value={extra}
          display={formatINR(extra)}
          min={0}
          max={500_000}
          step={10_000}
          onChange={setExtra}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.emi.emi'), value: formatINR(emi), main: true },
          { label: t('en', 'guide.emi.interest'), value: formatMoney(r.faster.totalInterest) },
          {
            label: t('en', 'guide.emi.ends'),
            value: t('en', 'guide.emi.year', { n: Math.ceil(r.faster.monthsTaken / 12) }),
          },
        ]}
      >
        <Verdict>
          {t('en', 'guide.emi.first', {
            interest: formatINR(firstInterest),
            principal: formatINR(emi - firstInterest),
          })}{' '}
          {extra > 0 &&
            t('en', 'guide.emi.saved', {
              amount: formatMoney(r.plain.totalInterest - r.faster.totalInterest),
            })}
        </Verdict>
      </Results>
    </Frame>
  );
}
