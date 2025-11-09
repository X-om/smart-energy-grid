/**
 * Aggregate data models for time-series analytics.
 * Used by stream processor and analytics services.
 */

/**
 * Base structure for all time-windowed aggregations.
 * Contains common fields for statistical summaries of telemetry data.
 */
export interface AggregateBase {
  /** Unique identifier of the meter */
  meterId: string;

  /** Geographic region of the meter */
  region: string;

  /** ISO 8601 timestamp marking the start of the aggregation window */
  windowStart: string;

  /** ISO 8601 timestamp marking the end of the aggregation window */
  windowEnd: string;

  /** Average power consumption in kilowatts during the window */
  avgPowerKw: number;

  /** Maximum power consumption in kilowatts during the window */
  maxPowerKw: number;

  /** Total energy consumed in kilowatt-hours during the window */
  energyKwhSum: number;

  /** Number of telemetry readings included in this aggregate */
  count: number;
}

/**
 * 1-minute aggregation window.
 * Used for near real-time analytics and dashboards.
 */
export type Aggregate1m = AggregateBase & {
  /** Granularity identifier for 1-minute aggregates */
  granularity: '1m';
};

/**
 * 15-minute aggregation window.
 * Used for historical analysis and billing calculations.
 */
export type Aggregate15m = AggregateBase & {
  /** Granularity identifier for 15-minute aggregates */
  granularity: '15m';
};

/**
 * Union type for all aggregate types.
 * Useful for generic aggregate handling.
 */
export type Aggregate = Aggregate1m | Aggregate15m;

/**
 * Regional aggregate for a geographic region.
 * Aggregates data from all meters within a region.
 */
export interface RegionalAggregate {
  region: string;
  timestamp: string;
  meter_count: number;
  total_consumption: number;
  avg_consumption: number;
  max_consumption: number;
  min_consumption: number;
  load_percentage: number;
  active_meters: string[];
}

/**
 * Type guard to check if an object is a valid Aggregate1m
 */
export function isAggregate1m(obj: unknown): obj is Aggregate1m {
  const agg = obj as Aggregate1m;
  return (
    typeof agg === 'object' &&
    agg !== null &&
    agg.granularity === '1m' &&
    typeof agg.meterId === 'string' &&
    typeof agg.avgPowerKw === 'number'
  );
}

/**
 * Type guard to check if an object is a valid Aggregate15m
 */
export function isAggregate15m(obj: unknown): obj is Aggregate15m {
  const agg = obj as Aggregate15m;
  return (
    typeof agg === 'object' &&
    agg !== null &&
    agg.granularity === '15m' &&
    typeof agg.meterId === 'string' &&
    typeof agg.avgPowerKw === 'number'
  );
}

/**
 * Type guard to check if an object is a valid RegionalAggregate
 */
export function isRegionalAggregate(obj: unknown): obj is RegionalAggregate {
  const agg = obj as RegionalAggregate;
  return (
    typeof agg === 'object' &&
    agg !== null &&
    typeof agg.region === 'string' &&
    typeof agg.timestamp === 'string' &&
    typeof agg.meter_count === 'number' &&
    typeof agg.total_consumption === 'number' &&
    typeof agg.load_percentage === 'number'
  );
}
