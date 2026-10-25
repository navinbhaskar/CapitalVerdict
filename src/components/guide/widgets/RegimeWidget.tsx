import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatINR } from '@/lib/format';
import { formatMoneyShort as short } from '@/lib/formatTool';
import { breakEvenDeductions, compareRegimes } from '@/models/taxRegime';
import { useIdleValue } from '@/lib/useIdleValue';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** Salary and deductions in, both regimes' tax out, and the deductions the old one needs. */
export default function RegimeWidget() {
  const [salary, setSalary] = useState(1_500_000);
  const [deductions, setDeductions] = useState(250_000);
  const input = { salary, otherIncome: 0, oldDeductions: deductions, newDeductions: 0 };
  const r = useMemo(() => compareRegimes(input, incomeTax), [salary, deductions]);
  // Wrapped, so "not worked out yet" (null) differs from "the old regime cannot win" (edge null).
  const edge = useIdleValue(
    () => ({ at: breakEvenDeductions({ ...input, oldDeductions: 0 }, incomeTax) }),
    [salary],
  );
  const tax = (v: number) => (v === 0 ? t('en', 'guide.nil') : formatINR(v));
  return (
    <Frame title={t('en', 'guide.regime.title')} toolPath="/tools/old-or-new-tax-regime/">
      <Inputs>
        <Slider
          label={t('en', 'guide.salary')}
          value={salary}
          display={short(salary)}
          min={500_000}
          max={5_000_000}
          step={25_000}
          onChange={setSalary}
        />
        <Slider
          label={t('en', 'guide.regime.deductions')}
          value={deductions}
          display={short(deductions)}
          min={0}
          max={1_000_000}
          step={10_000}
          onChange={setDeductions}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.regime.new'), value: tax(r.new.total), main: r.better === 'new' },
          { label: t('en', 'guide.regime.old'), value: tax(r.old.total), main: r.better === 'old' },
        ]}
      >
        <Verdict>
          {r.saving < 1
            ? t('en', 'guide.regime.same')
            : t('en', r.better === 'new' ? 'guide.regime.newSaves' : 'guide.regime.oldSaves', {
                amount: formatINR(r.saving),
              })}{' '}
          {edge &&
            (edge.at === null
              ? t('en', 'guide.regime.never')
              : t('en', 'guide.regime.edge', { amount: formatINR(edge.at) }))}
        </Verdict>
      </Results>
    </Frame>
  );
}
