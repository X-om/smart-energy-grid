/**
 * Tariff pricing models for dynamic electricity pricing.
 * Used by tariff service and billing calculations.
 */

/**
 * Represents a tariff update event in the system.
 * Tariffs are dynamically adjusted based on grid load and other factors.
 */
export interface TariffUpdate {
  /** Unique identifier for this tariff update (UUID v4) */
  tariffId: string;

  /** Geographic region affected by this tariff */
  region: string;

  /** ISO 8601 timestamp when this tariff becomes effective */
  effectiveFrom: string;

  /** Price per kilowatt-hour in local currency (e.g., USD) */
  pricePerKwh: number;

  /** Optional explanation for the tariff change */
  reason?: string;

  /** Indicates whether the update was automatically triggered or manually set */
  triggeredBy: 'AUTO' | 'MANUAL';

  /** ISO 8601 timestamp when this tariff was created */
  createdAt: string;
}

/**
 * Tariff schedule for a specific time period.
 * Used for historical tariff lookups and billing.
 */
export interface TariffSchedule {
  /** Unique identifier for the schedule */
  scheduleId: string;

  /** Geographic region */
  region: string;

  /** Start of the schedule period */
  validFrom: string;

  /** End of the schedule period (null for ongoing) */
  validTo: string | null;

  /** Price per kilowatt-hour */
  pricePerKwh: number;

  /** Schedule type (peak, off-peak, standard) */
  type: 'PEAK' | 'OFF_PEAK' | 'STANDARD';
}

/**
 * Type guard to check if an object is a valid TariffUpdate
 */
export function isTariffUpdate(obj: unknown): obj is TariffUpdate {
  const tariff = obj as TariffUpdate;
  return (
    typeof tariff === 'object' &&
    tariff !== null &&
    typeof tariff.tariffId === 'string' &&
    typeof tariff.region === 'string' &&
    typeof tariff.effectiveFrom === 'string' &&
    typeof tariff.pricePerKwh === 'number' &&
    (tariff.triggeredBy === 'AUTO' || tariff.triggeredBy === 'MANUAL')
  );
}
