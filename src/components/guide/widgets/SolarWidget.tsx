import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short } from '@/lib/formatTool';
import { formatDuration } from '@/lib/duration';
import { simpleTariff } from '@/engine/tariff';
import { solarPayback } from '@/models/solar';
import { Frame, Inputs, Results, Slider } from './parts';

/** The guide's 3 kW example with your own cost, bill and roof. Subsidy is yours to enter. */
export default function SolarWidget() {
  const [kw, setKw] = useState(3);
  const [cost, setCost] = useState(180_000);
  const [units, setUnits] = useState(300);
  const [price, setPrice] = useState(7);
  const [subsidy, setSubsidy] = useState(0);
  const r = useMemo(
    () =>
      solarPayback(
        {
          systemKW: kw,
          grossCost: cost,
          subsidy: Math.min(subsidy, cost),
          generationPerKWPerDay: 4,
          degradationPerYear: 0.005,
          monthlyConsumptionKWh: units,
          tariff: simpleTariff(price, 0),
          sanctionedLoadKW: Math.max(kw, 1),
          tariffRisePerYear: 0,
          exportRatePerKWh: 0,
          inverter: null,
          horizonYears: 25,
        },
        { withIrr: false },
      ),
    [kw, cost, units, price, subsidy],
  );
  return (
    <Frame title={t('en', 'guide.solar.title')} toolPath="/tools/solar/">
      <Inputs>
        <Slider
          label={t('en', 'guide.solar.size')}
          value={kw}
          display={`${kw} kW`}
          min={1}
          max={10}
          step={0.5}
          onChange={setKw}
        />
        <Slider
          label={t('en', 'guide.solar.cost')}
          value={cost}
          display={short(cost)}
          min={50_000}
          max={700_000}
          step={5_000}
          onChange={setCost}
        />
        <Slider
          label={t('en', 'guide.solar.units')}
          value={units}
          display={t('en', 'guide.solar.unitsValue', { n: units })}
          min={50}
          max={1_000}
          step={10}
          onChange={setUnits}
        />
        <Slider
          label={t('en', 'guide.solar.price')}
          value={price}
          display={`₹${price.toFixed(2)}`}
          min={3}
          max={12}
          step={0.25}
          onChange={setPrice}
        />
        <Slider
          label={t('en', 'guide.solar.subsidy')}
          value={subsidy}
          display={formatINR(subsidy)}
          min={0}
          max={150_000}
          step={5_000}
          onChange={setSubsidy}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.solar.saves'), value: formatINR(r.firstYearSaving) },
          {
            label: t('en', 'guide.solar.payback'),
            value: r.payback
              ? formatDuration('en', r.payback.months)
              : t('en', 'guide.solar.never'),
            main: true,
          },
          { label: t('en', 'guide.solar.net'), value: formatMoney(r.netAtHorizon) },
        ]}
      />
      <p class="mt-3 text-xs text-ink-muted">{t('en', 'guide.solar.assume')}</p>
    </Frame>
  );
}
