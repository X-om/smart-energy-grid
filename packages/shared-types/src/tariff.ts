export interface TariffUpdate {
  tariffId: string;
  region: string;
  effectiveFrom: string;
  pricePerKwh: number;
  reason?: string;
  triggeredBy: 'AUTO' | 'MANUAL';
  createdAt: string;
}

export interface TariffSchedule {
  scheduleId: string;
  region: string;
  validFrom: string;
  validTo: string | null;
  pricePerKwh: number;
  type: 'PEAK' | 'OFF_PEAK' | 'STANDARD';
}

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
