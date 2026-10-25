import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { incomeTax } from '@/data';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { plotVs } from '@/models/plotVs';
import CompareBars from '@/components/tool/CompareBars';
import { Frame, Inputs, Results, Slider } from './parts';

/** The guide's ₹20 lakh plot: change the plot's growth and the fund's return. */
export default function PlotWidget() {
  const [growth, setGrowth] = useState(0.05);
  const [fund, setFund] = useState(0.1);
  const r = useMemo(
    () =>
      plotVs(
        {
          plotPrice: 2_000_000,
          stampDuty: 0.07,
          otherBuyCosts: 20_000,
          yearlyCost: 5_000,
          plotGrowth: growth,
          sellingCost: 0.02,
          fdRate: 0.07,
          taxRate: 0.312,
          fundReturn: fund,
          years: 10,
          inflation: 0.06,
        },
        incomeTax,
      ),
    [growth, fund],
  );
  const after = (tax: number) => t('en', 'guide.afterTax', { amount: formatMoney(tax) });
  return (
    <Frame title={t('en', 'guide.plot.title')} toolPath="/tools/plot-vs-fd-vs-mutual-fund/">
      <Inputs>
        <Slider
          label={t('en', 'guide.plot.growth')}
          value={growth}
          display={formatPercent(growth)}
          min={0}
          max={0.15}
          step={0.005}
          onChange={setGrowth}
        />
        <Slider
          label={t('en', 'guide.plot.fund')}
          value={fund}
          display={formatPercent(fund)}
          min={0.04}
          max={0.15}
          step={0.005}
          onChange={setFund}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', 'guide.plot.plotYearly'),
            value: formatPercent(Number(r.plot.yearlyReturn.toFixed(4))),
            main: r.best === 'plot',
          },
          {
            label: t('en', 'guide.plot.fundYearly'),
            value: formatPercent(Number(r.fund.yearlyReturn.toFixed(4))),
            main: r.best === 'fund',
          },
        ]}
      >
        <div class="mt-4">
          <CompareBars
            caption={t('en', 'guide.plot.caption')}
            bare
            items={[
              {
                label: t('en', 'guide.plot.plot'),
                value: r.plot.net,
                display: formatMoney(r.plot.net),
                tax: r.plot.tax,
                note: after(r.plot.tax),
                best: r.best === 'plot',
              },
              {
                label: t('en', 'guide.plot.fd'),
                value: r.fd.net,
                display: formatMoney(r.fd.net),
                tax: r.fd.tax,
                note: after(r.fd.tax),
                best: r.best === 'fd',
              },
              {
                label: t('en', 'guide.plot.fundLabel'),
                value: r.fund.net,
                display: formatMoney(r.fund.net),
                tax: r.fund.tax,
                note: after(r.fund.tax),
                best: r.best === 'fund',
              },
            ]}
          />
        </div>
      </Results>
    </Frame>
  );
}
