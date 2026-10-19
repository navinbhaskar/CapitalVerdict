import type { CarFuelInput } from './carFuel';

/**
 * The worked example from the project spec: petrol ₹101.86/L @ 18 km/L vs CNG ₹95.75/kg @ 26 km/kg,
 * 1,800 km a month, ₹90,000 extra price at 9% a year, flat prices, no extra upkeep.
 * Prices are illustrative, not current market data.
 */
export const carFuelExample: CarFuelInput = {
  monthlyKm: 1800,
  horizonMonths: 120,
  base: { mileage: 18, energyPrice: 101.86, annualPriceRise: 0, annualUpkeep: 0 },
  alternative: { mileage: 26, energyPrice: 95.75, annualPriceRise: 0, annualUpkeep: 0 },
  extraPrice: 90_000,
  interestRate: 0.09,
};
