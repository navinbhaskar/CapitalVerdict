import { describe, expect, it } from 'vitest';
import {
  solarSubsidyFor,
  stateOfCity,
  tariffFor,
  verifiedCityIds,
  verifiedFuelPrices,
} from './index';

describe('cities offered', () => {
  it('only cities with both prices verified can be chosen', () => {
    expect([...verifiedCityIds].sort()).toEqual(
      ['ahmedabad', 'delhi', 'hyderabad', 'kolkata', 'lucknow', 'mumbai', 'pune'].sort(),
    );
    expect(verifiedFuelPrices('bengaluru')).toBeNull();
    expect(verifiedFuelPrices('chennai')).toBeNull();
  });

  it('the metros carry the prices from their sources', () => {
    expect(verifiedFuelPrices('mumbai')).toEqual({ petrol: 111.21, cng: 89 });
    expect(verifiedFuelPrices('hyderabad')).toEqual({ petrol: 116.15, cng: 114.5 });
  });

  it('a state without a tariff or solar data falls back to the visitor entering them', () => {
    expect(stateOfCity('pune')).toBe('MH');
    expect(tariffFor('MH')).toBeNull();
    expect(solarSubsidyFor('MH', 3)).toBeNull();
    expect(tariffFor('DL')).not.toBeNull();
  });
});
