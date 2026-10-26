import { describe, expect, it } from 'vitest';
import { centralEv2wIncentive, evTwoWheeler, stateEv2wIncentive } from './index';

const TODAY = '2026-10-26';

describe('central incentive on an electric scooter (PM E-DRIVE, S.O. 4424(E))', () => {
  it('₹2,500 a kWh, capped at ₹5,000', () => {
    // 1.5 kWh × 2,500 = 3,750, under the cap; 3 kWh × 2,500 = 7,500, capped at 5,000.
    expect(centralEv2wIncentive(1.5, TODAY)).toBe(3_750);
    expect(centralEv2wIncentive(3, TODAY)).toBe(5_000);
  });

  it('no more than 15% of the ex-factory price, and nil above ₹1.5 lakh ex-factory', () => {
    // 3 kWh on a ₹30,000 ex-factory scooter: 15% = 4,500, under the 5,000 cap.
    expect(centralEv2wIncentive(3, TODAY, 30_000)).toBe(4_500);
    expect(centralEv2wIncentive(3, TODAY, 150_000)).toBe(5_000);
    expect(centralEv2wIncentive(3, TODAY, 150_001)).toBe(0);
  });

  it('runs from 1 April 2025 to 31 March 2028', () => {
    expect(centralEv2wIncentive(3, '2028-03-31')).toBe(5_000);
    expect(centralEv2wIncentive(3, '2028-04-01')).toBe(0);
    expect(evTwoWheeler.central.paidAs).toBe('upfront');
  });
});

describe('Delhi incentive on an electric scooter (Delhi EV Policy 2026, para 4.2)', () => {
  it('year one: ₹10,000 a kWh up to ₹30,000', () => {
    // 2.5 kWh × 10,000 = 25,000; 3.4 kWh × 10,000 = 34,000, capped at 30,000.
    expect(stateEv2wIncentive('DL', 2.5, 120_000, TODAY)).toBe(25_000);
    expect(stateEv2wIncentive('DL', 3.4, 120_000, TODAY)).toBe(30_000);
  });

  it('later years pay less: ₹6,600 a kWh up to ₹20,000, then ₹3,300 up to ₹10,000', () => {
    // 2.5 kWh: 16,500 in year two; 8,250 in year three.
    expect(stateEv2wIncentive('DL', 2.5, 120_000, '2027-07-01')).toBe(16_500);
    expect(stateEv2wIncentive('DL', 2.5, 120_000, '2028-07-01')).toBe(8_250);
    expect(stateEv2wIncentive('DL', 2.5, 120_000, '2029-07-01')).toBe(0);
  });

  it('nil above ₹2.25 lakh ex-showroom, and nil in a state without one', () => {
    expect(stateEv2wIncentive('DL', 3, 225_000, TODAY)).toBe(30_000);
    expect(stateEv2wIncentive('DL', 3, 225_001, TODAY)).toBe(0);
    expect(stateEv2wIncentive('UP', 3, 120_000, TODAY)).toBe(0);
  });

  it('a ₹10,000 scrapping bonus and a full road-tax waiver', () => {
    const dl = evTwoWheeler.states.find((s) => s.state === 'DL')!;
    expect(dl.purchase.paidAs).toBe('bankTransfer');
    expect(dl.scrapping?.amount).toBe(10_000);
    expect(dl.roadTaxWaiver?.share).toBe(1);
  });
});
