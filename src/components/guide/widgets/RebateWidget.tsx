import { useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoneyShort as short, formatPercent } from '@/lib/formatTool';
import { regimeTax } from '@/models/taxRegime';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** A salary around ₹12 lakh: the slab tax, what the rebate or marginal relief takes off, the tax. */
export default function RebateWidget() {
  const [salary, setSalary] = useState(1_300_000);
  const r = regimeTax(
    'new',
    { salary, otherIncome: 0, oldDeductions: 0, newDeductions: 0 },
    incomeTax,
  );
  const limit = incomeTax.regimes.new.rebate.incomeLimit;
  const note =
    r.taxable <= limit
      ? t('en', 'guide.rebate.covered')
      : r.rebate > 0
        ? t('en', 'guide.rebate.relief', { amount: formatINR(r.rebate) })
        : t('en', 'guide.rebate.none');
  return (
    <Frame title={t('en', 'guide.rebate.title')} toolPath="/tools/old-or-new-tax-regime/">
      <Inputs>
        <Slider
          label={t('en', 'guide.salary')}
          value={salary}
          display={short(salary)}
          min={1_000_000}
          max={1_600_000}
          step={5_000}
          onChange={setSalary}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.rebate.taxable'), value: short(r.taxable) },
          { label: t('en', 'guide.rebate.slabTax'), value: formatINR(r.slabTax) },
          {
            label: t('en', 'guide.rebate.pay'),
            value: r.total === 0 ? t('en', 'guide.nil') : formatINR(r.total),
            main: true,
          },
        ]}
      >
        <Verdict>
          {note}{' '}
          {r.total > 0 &&
            t('en', 'guide.rebate.share', {
              pct: formatPercent(Number((r.total / salary).toFixed(4))),
            })}
        </Verdict>
      </Results>
    </Frame>
  );
}
