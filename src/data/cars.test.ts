import { describe, expect, it } from 'vitest';
import { carRoadTax, idvDepreciationShare, thirdPartyPremium } from './index';

describe('insured value by age (India Motor Tariff schedule)', () => {
  it('5% to six months, then 15%, 20%, 30%, 40%, 50% to five years', () => {
    expect(idvDepreciationShare(6)).toBe(0.05);
    expect(idvDepreciationShare(7)).toBe(0.15);
    expect(idvDepreciationShare(24)).toBe(0.2);
    expect(idvDepreciationShare(36)).toBe(0.3);
    expect(idvDepreciationShare(37)).toBe(0.4);
    expect(idvDepreciationShare(60)).toBe(0.5);
  });

  it('beyond five years it is agreed, so there is no figure', () => {
    expect(idvDepreciationShare(61)).toBeNull();
  });
});

describe('third-party premium (G.S.R. 394(E), 2022)', () => {
  it('₹2,094 up to 1000 cc, ₹3,416 to 1500 cc, ₹7,897 above', () => {
    expect(thirdPartyPremium(998)).toBe(2_094);
    expect(thirdPartyPremium(1_000)).toBe(2_094);
    expect(thirdPartyPremium(1_197)).toBe(3_416);
    expect(thirdPartyPremium(1_498)).toBe(3_416);
    expect(thirdPartyPremium(1_956)).toBe(7_897);
  });
});

describe('Delhi road tax (Delhi Motor Vehicles Taxation Act, Schedule I, Part B)', () => {
  it('4% to ₹6 lakh, 7% to ₹10 lakh, 10% above, on the whole price', () => {
    // ₹5 lakh × 4% = ₹20,000; ₹8 lakh × 7% = ₹56,000; ₹12 lakh × 10% = ₹1.2 lakh.
    expect(carRoadTax('DL', 500_000)).toBeCloseTo(20_000, 6);
    expect(carRoadTax('DL', 600_000)).toBeCloseTo(24_000, 6);
    expect(carRoadTax('DL', 800_000)).toBeCloseTo(56_000, 6);
    expect(carRoadTax('DL', 1_200_000)).toBeCloseTo(120_000, 6);
  });

  it('no figure for a state without verified rates', () => {
    expect(carRoadTax('MH', 800_000)).toBeNull();
  });
});
