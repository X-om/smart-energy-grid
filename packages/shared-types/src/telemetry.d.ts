export interface TelemetryReading {
    readingId: string;
    meterId: string;
    userId?: string;
    timestamp: string;
    powerKw: number;
    energyKwh?: number;
    voltage?: number;
    region: string;
    seq?: number;
    status?: 'OK' | 'ERROR';
    metadata?: Record<string, unknown>;
}
export declare const isTelemetryReading: (obj: unknown) => obj is TelemetryReading;
//# sourceMappingURL=telemetry.d.ts.map