/**
 * The car example appears in four places: the home page card, the car tool before a city is chosen,
 * the tool page's worked example and the CNG guides. They must give the same answer, at the same
 * verified prices. A stale price in any one of them fails here.
 */
import { describe, expect, it } from 'vitest';
import { verifiedFuelPrices } from '@/data';
import { cngCase, cngFigures } from '@/content/guideFigures';
import { carFuelFlips, compareCarFuel } from './carFuel';
import { EXAMPLE_PRICE_CITY, carFuelCurrentExample, carFuelExample } from './carFuel.example';
import { CAR_FUEL_START_FORM, toCarFuelInput } from './carFuelForm';
import { CAR_ASK_START, HERO_PRICE_CITY, carAsk } from './heroAsk';

const prices = verifiedFuelPrices(EXAMPLE_PRICE_CITY)!;
const tool = toCarFuelInput(CAR_FUEL_START_FORM, 'cng')!;
const worked = carFuelCurrentExample();

describe('one car example everywhere', () => {
  it('every place uses the example city and its verified prices', () => {
    expect(prices).not.toBeNull();
    expect(HERO_PRICE_CITY).toBe(EXAMPLE_PRICE_CITY);
    expect(CAR_FUEL_START_FORM.petrolPrice).toBe(prices.petrol);
    expect(CAR_FUEL_START_FORM.cngPrice).toBe(prices.cng);
    expect(worked.base.energyPrice).toBe(prices.petrol);
    expect(worked.alternative.energyPrice).toBe(prices.cng);
    expect(cngCase).toEqual(worked);
  });

  it('the tool starts with the same cars, distance and premium as the home page', () => {
    expect(tool.monthlyKm).toBe(CAR_ASK_START.km);
    expect(tool.extraPrice).toBe(CAR_ASK_START.extra);
    expect(tool.interestRate).toBe(worked.interestRate);
  });

  it('home page, tool, worked example and guide: same payback, net and flip distance', () => {
    const home = carAsk(CAR_ASK_START)!;
    const fromTool = compareCarFuel(tool);
    const fromWorked = compareCarFuel(worked);
    const fromGuide = compareCarFuel(cngCase);
    const months = fromWorked.breakevenWithInterest!.months;
    expect(fromTool.breakevenWithInterest!.months).toBe(months);
    expect(fromGuide.breakevenWithInterest!.months).toBe(months);
    expect(home.verdict.kind).not.toBe('never');
    expect(fromTool.netAt10Years!.withInterest).toBeCloseTo(
      fromWorked.netAt10Years!.withInterest,
      6,
    );
    expect(home.dearerNet).toBeCloseTo(fromWorked.netAt10Years!.withInterest, 6);
    const flip = carFuelFlips(tool, ['monthlyKm'])[0]!;
    expect(home.flipKm!.threshold).toBeCloseTo(flip.threshold, 6);
    expect(cngFigures).toBeDefined();
  });

  it('the frozen fixture keeps its September price, for the model tests and the price-update guide only', () => {
    expect(carFuelExample.alternative.energyPrice).toBe(95.75);
    expect(worked.alternative.energyPrice).not.toBe(carFuelExample.alternative.energyPrice);
  });
});
