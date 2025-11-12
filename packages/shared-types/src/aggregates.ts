
export interface AggregateBase {
  meterId: string;
  region: string;
  windowStart: string;
  windowEnd: string;
  avgPowerKw: number;
  maxPowerKw: number;
  energyKwhSum: number;
  count: number;
}

export type Aggregate1m = AggregateBase & {
  granularity: '1m';
};

export type Aggregate15m = AggregateBase & {
  granularity: '15m';
};

export type Aggregate = Aggregate1m | Aggregate15m;

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
