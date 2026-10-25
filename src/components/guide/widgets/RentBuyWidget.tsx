import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatPercent } from '@/lib/formatTool';
import { rentVsBuy } from '@/models/rentBuy';
import { RENT_BUY_EXAMPLE_FORM, toRentBuyInput } from '@/models/rentBuyForm';
import CompareBars from '@/components/tool/CompareBars';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** The guide's ₹50 lakh home: the two numbers nobody knows, and the rent. */
export default function RentBuyWidget() {
  const base = toRentBuyInput(RENT_BUY_EXAMPLE_FORM)!;
  const [growth, setGrowth] = useState(base.appreciation);
  const [ret, setRet] = useState(base.investmentReturn);
  const [rent, setRent] = useState(base.monthlyRent);
  const r = useMemo(
    () => rentVsBuy({ ...base, appreciation: growth, investmentReturn: ret, monthlyRent: rent }),
    [growth, ret, rent],
  );
  const d = r.atHorizon.difference;
  return (
    <Frame title={t('en', 'guide.rentBuy.title')} toolPath="/tools/rent-vs-buy/">
      <Inputs>
        <Slider
          label={t('en', 'guide.rentBuy.growth')}
          value={growth}
          display={formatPercent(growth)}
          min={0}
          max={0.12}
          step={0.0025}
          onChange={setGrowth}
        />
        <Slider
          label={t('en', 'guide.rentBuy.return')}
          value={ret}
          display={formatPercent(ret)}
          min={0.03}
          max={0.14}
          step={0.0025}
          onChange={setRet}
        />
        <Slider
          label={t('en', 'guide.rentBuy.rent')}
          value={rent}
          display={formatINR(rent)}
          min={5_000}
          max={40_000}
          step={500}
          onChange={setRent}
        />
      </Inputs>
      <Results
        items={[
          {
            label: t('en', d >= 0 ? 'guide.rentBuy.buyAhead' : 'guide.rentBuy.rentAhead'),
            value: formatMoney(Math.abs(d)),
            main: true,
          },
          {
            label: t('en', 'guide.rentBuy.today'),
            value: formatMoney(Math.abs(r.atHorizon.differenceToday)),
          },
        ]}
      >
        <div class="mt-4">
          <CompareBars
            caption={t('en', 'guide.rentBuy.caption')}
            bare
            items={[
              {
                label: t('en', 'guide.rentBuy.buy'),
                value: r.atHorizon.buyer,
                display: formatMoney(r.atHorizon.buyer),
                best: d >= 0,
              },
              {
                label: t('en', 'guide.rentBuy.rentInvest'),
                value: r.atHorizon.renter,
                display: formatMoney(r.atHorizon.renter),
                best: d < 0,
              },
            ]}
          />
        </div>
        <Verdict>{t('en', 'guide.rentBuy.assume')}</Verdict>
      </Results>
    </Frame>
  );
}
