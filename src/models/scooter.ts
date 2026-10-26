/**
 * Electric or petrol scooter: does the e-scooter's cheaper running earn back its extra price?
 *
 * It is the car fuel comparison (carFuel.ts) at scooter scale, with three differences:
 * - Charging at home adds units to the home's electricity bill. Where the state's tariff is known
 *   (Delhi), the cost is the difference of two real bills, the home's other units with and without
 *   the scooter's, so slabs and the bill subsidy count: a home that crosses a subsidy band pays for
 *   the units it adds and for the subsidy it loses. Elsewhere it is the visitor's price per unit.
 *   That first-month cost per unit then rises with the tariff, as fuel prices do.
 * - The e-scooter price is the dealer's, which already has any central incentive taken off. A
 *   state incentive and a scrapping bonus, paid after registration, come off the extra price at
 *   the start (the few weeks' wait is not charged interest).
 * - A battery replacement, if expected, is a one-off cost in its year.
 */
import { bill, incrementalCost, type BillOptions, type Tariff } from '@/engine/tariff';
import { compareCarFuel, type CarFuelInput, type CarFuelResult } from './carFuel';

export interface ScooterInput {
  monthlyKm: number;
  years: number;
  petrol: {
    /** On-road price, ₹. */
    price: number;
    /** km per litre. */
    mileage: number;
    /** ₹ per litre today. */
    fuelPrice: number;
    /** Servicing and other running costs a year, ₹; 0 when not counted. */
    upkeep: number;
  };
  ev: {
    /** On-road price as quoted, after any central incentive, ₹. */
    price: number;
    /** km per unit (kWh) drawn from the wall. */
    kmPerUnit: number;
    upkeep: number;
    /** A battery replacement, if expected: ₹ and the year it happens. */
    battery?: { cost: number; year: number };
  };
  /** Price of the charging units: the home's real bill, or a flat price per unit. */
  electricity:
    | { kind: 'bill'; tariff: Tariff; otherUnitsPerMonth: number; options: BillOptions }
    | { kind: 'flat'; pricePerUnit: number };
  /** Paid back after registration, ₹: the state incentive and any scrapping bonus. */
  refunds: { state: number; scrapping: number };
  /** Yearly rises, decimal. */
  petrolPriceRise: number;
  tariffRise: number;
  /** Charged on the extra price (a loan, or what the money could earn). */
  interestRate: number;
}

export interface ScooterResult {
  /** Units the e-scooter draws a month. */
  unitsPerMonth: number;
  /** Charging cost in the first month, ₹. */
  chargingPerMonth: number;
  /** chargingPerMonth ÷ unitsPerMonth: what each charging unit really costs, ₹. */
  costPerUnit: number;
  /** The home's bill without and with the scooter, first month, ₹ (on a real bill only). */
  billWithout: number | null;
  billWith: number | null;
  /** Petrol in the first month, ₹. */
  petrolPerMonth: number;
  /** e-scooter price less the refunds, ₹. */
  evNetPrice: number;
  /** evNetPrice − petrol scooter price, ₹; negative when the e-scooter costs less to buy. */
  extraPrice: number;
  /** The car fuel comparison: petrol is the base, the e-scooter the alternative. */
  comparison: CarFuelResult;
  input: CarFuelInput;
}

export function compareScooters(input: ScooterInput): ScooterResult {
  if (!(input.ev.kmPerUnit > 0)) throw new RangeError('kmPerUnit must be positive');
  if (!(input.petrol.mileage > 0)) throw new RangeError('mileage must be positive');
  const unitsPerMonth = input.monthlyKm / input.ev.kmPerUnit;
  const e = input.electricity;
  let billWithout: number | null = null;
  let billWith: number | null = null;
  let chargingPerMonth: number;
  if (e.kind === 'bill') {
    chargingPerMonth = incrementalCost(e.otherUnitsPerMonth, unitsPerMonth, e.tariff, e.options);
    billWithout = bill(e.otherUnitsPerMonth, e.tariff, e.options).total;
    billWith = bill(e.otherUnitsPerMonth + unitsPerMonth, e.tariff, e.options).total;
  } else {
    chargingPerMonth = unitsPerMonth * e.pricePerUnit;
  }
  // With no riding there are no units; any positive price keeps the comparison valid.
  const costPerUnit = unitsPerMonth > 0 ? chargingPerMonth / unitsPerMonth : 0;

  const evNetPrice = input.ev.price - input.refunds.state - input.refunds.scrapping;
  const extraPrice = evNetPrice - input.petrol.price;
  const battery = input.ev.battery;
  const comparisonInput: CarFuelInput = {
    monthlyKm: input.monthlyKm,
    horizonMonths: input.years * 12,
    base: {
      mileage: input.petrol.mileage,
      energyPrice: input.petrol.fuelPrice,
      annualPriceRise: input.petrolPriceRise,
      annualUpkeep: input.petrol.upkeep,
    },
    alternative: {
      mileage: input.ev.kmPerUnit,
      energyPrice: costPerUnit,
      annualPriceRise: input.tariffRise,
      annualUpkeep: input.ev.upkeep,
      ...(battery && battery.cost > 0 && battery.year <= input.years
        ? { oneOff: { month: (battery.year - 1) * 12 + 1, amount: battery.cost } }
        : {}),
    },
    extraPrice,
    purchasePrices: { base: input.petrol.price, alternative: evNetPrice },
    interestRate: input.interestRate,
  };
  return {
    unitsPerMonth,
    chargingPerMonth,
    costPerUnit,
    billWithout,
    billWith,
    petrolPerMonth: (input.monthlyKm / input.petrol.mileage) * input.petrol.fuelPrice,
    evNetPrice,
    extraPrice,
    comparison: compareCarFuel(comparisonInput),
    input: comparisonInput,
  };
}
