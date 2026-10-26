import { useMemo, useState } from 'preact/hooks';
import { t } from '@/i18n/t';
import { formatINR } from '@/lib/format';
import { formatMoney, formatMoneyShort as short } from '@/lib/formatTool';
import { compareCarFuel } from '@/models/carFuel';
import { carFuelCurrentExample } from '@/models/carFuel.example';
import { Frame, Inputs, Results, Slider, Verdict } from './parts';

/** The guide's petrol and CNG cars, starting at the example city's verified prices: your distance, prices and gap. */
export default function CngWidget() {
  const example = carFuelCurrentExample();
  const [km, setKm] = useState(example.monthlyKm);
  const [cng, setCng] = useState(example.alternative.energyPrice);
  const [petrol, setPetrol] = useState(example.base.energyPrice);
  const [extra, setExtra] = useState(example.extraPrice);
  const r = useMemo(
    () =>
      compareCarFuel({
        ...example,
        monthlyKm: km,
        extraPrice: extra,
        base: { ...example.base, energyPrice: petrol },
        alternative: { ...example.alternative, energyPrice: cng },
      }),
    [km, cng, petrol, extra],
  );
  const net = r.netAt10Years!.withInterest;
  return (
    <Frame title={t('en', 'guide.cng.title')} toolPath="/tools/car-fuel/">
      <Inputs>
        <Slider
          label={t('en', 'guide.cng.km')}
          value={km}
          display={`${formatINR(km).slice(1)} km`}
          min={300}
          max={4_000}
          step={50}
          onChange={setKm}
        />
        <Slider
          label={t('en', 'guide.cng.extra')}
          value={extra}
          display={short(extra)}
          min={20_000}
          max={200_000}
          step={5_000}
          onChange={setExtra}
        />
        <Slider
          label={t('en', 'guide.cng.cngPrice')}
          value={cng}
          display={`₹${cng.toFixed(2)}`}
          min={60}
          max={130}
          step={0.25}
          onChange={setCng}
        />
        <Slider
          label={t('en', 'guide.cng.petrolPrice')}
          value={petrol}
          display={`₹${petrol.toFixed(2)}`}
          min={80}
          max={120}
          step={0.25}
          onChange={setPetrol}
        />
      </Inputs>
      <Results
        items={[
          { label: t('en', 'guide.cng.saves'), value: formatINR(r.firstMonthSaving) },
          {
            label: t('en', 'guide.cng.payback'),
            value: r.breakevenWithInterest
              ? t('en', 'guide.months', { n: r.breakevenWithInterest.months })
              : t('en', 'guide.cng.never'),
            main: true,
          },
          {
            label: t('en', net >= 0 ? 'guide.cng.ahead' : 'guide.cng.behind'),
            value: formatMoney(Math.abs(net)),
          },
        ]}
      >
        <Verdict>
          {t('en', 'guide.cng.perKm', {
            petrol: `₹${r.costPerKm.base.toFixed(2)}`,
            cng: `₹${r.costPerKm.alternative.toFixed(2)}`,
          })}
        </Verdict>
      </Results>
      <p class="mt-3 text-xs text-ink-muted">{t('en', 'guide.cng.assume')}</p>
    </Frame>
  );
}
