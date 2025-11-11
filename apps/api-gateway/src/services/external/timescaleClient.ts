import { timescalePool } from '../../utils/db.js';
import { NotFoundError } from '../../utils/errors.js';

interface AggregateRow {
  meter_id: string;
  region: string;
  window_start: Date;
  avg_power_kw: number;
  max_power_kw: number;
  min_power_kw: number;
  energy_kwh_sum: number;
  voltage_avg: number;
  count: number;
}

interface MeterStats {
  total_consumption_kwh: number;
  avg_power_kw: number;
  max_power_kw: number;
  min_power_kw: number;
  data_points: number;
}

interface DailyBreakdown {
  date: string;
  total_kwh: number;
  avg_kw: number;
  peak_kw: number;
}

interface MonthlyBreakdown {
  month: string;
  total_kwh: number;
  avg_kw: number;
  peak_kw: number;
}

interface RegionalStats {
  region: string;
  total_consumption_kwh: number;
  active_meters: number;
  avg_consumption_per_meter: number;
  peak_load_kw: number;
}

interface TopConsumer {
  meter_id: string;
  total_kwh: number;
  avg_kw: number;
  rank: number;
}

// * Get latest reading for a specific meter
export const getLatestReading = async (meterId: string): Promise<AggregateRow | null> => {
  const query = `
    SELECT meter_id, region, window_start, avg_power_kw, max_power_kw, min_power_kw, energy_kwh_sum, voltage_avg, count
    FROM aggregates_1m
    WHERE meter_id = $1
    ORDER BY window_start DESC
    LIMIT 1
  `;

  const result = await timescalePool.query<AggregateRow>(query, [meterId]);
  return result.rows[0] || null;
};

// * Get historical aggregates for a meter
export const getMeterHistory = async (meterId: string, resolution: '1m' | '15m', startTime: Date, endTime: Date): Promise<AggregateRow[]> => {
  const tableName = resolution === '1m' ? 'aggregates_1m' : 'aggregates_15m';

  const query = `
    SELECT meter_id, region, window_start, avg_power_kw, max_power_kw, min_power_kw, energy_kwh_sum, voltage_avg, count
    FROM ${tableName}
    WHERE meter_id = $1
      AND window_start >= $2
      AND window_start <= $3
    ORDER BY window_start ASC
  `;

  const result = await timescalePool.query<AggregateRow>(query, [meterId, startTime, endTime]);
  return result.rows;
};

// * Get consumption statistics for a meter
export const getMeterStats = async (meterId: string, startTime: Date, endTime: Date): Promise<MeterStats> => {
  const query = `
    SELECT 
      SUM(energy_kwh_sum) as total_consumption_kwh,
      AVG(avg_power_kw) as avg_power_kw,
      MAX(max_power_kw) as max_power_kw,
      MIN(min_power_kw) as min_power_kw,
      SUM(count) as data_points
    FROM aggregates_15m
    WHERE meter_id = $1
      AND window_start >= $2
      AND window_start <= $3
  `;

  const result = await timescalePool.query(query, [meterId, startTime, endTime]);
  if (!result.rows[0] || result.rows[0].data_points === null)
    throw new NotFoundError('No data found for this meter in the specified time range');

  return {
    total_consumption_kwh: parseFloat(result.rows[0].total_consumption_kwh) || 0,
    avg_power_kw: parseFloat(result.rows[0].avg_power_kw) || 0, max_power_kw: parseFloat(result.rows[0].max_power_kw) || 0,
    min_power_kw: parseFloat(result.rows[0].min_power_kw) || 0, data_points: parseInt(result.rows[0].data_points) || 0
  };
};

// * Get daily breakdown for a meter
export const getDailyBreakdown = async (meterId: string, startDate: Date, endDate: Date): Promise<DailyBreakdown[]> => {
  const query = `
    SELECT 
      DATE(window_start) as date,
      SUM(energy_kwh_sum) as total_kwh,
      AVG(avg_power_kw) as avg_kw,
      MAX(max_power_kw) as peak_kw
    FROM aggregates_15m
    WHERE meter_id = $1
      AND window_start >= $2
      AND window_start <= $3
    GROUP BY DATE(window_start)
    ORDER BY date ASC
  `;

  const result = await timescalePool.query(query, [meterId, startDate, endDate]);
  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    total_kwh: parseFloat(row.total_kwh) || 0,
    avg_kw: parseFloat(row.avg_kw) || 0,
    peak_kw: parseFloat(row.peak_kw) || 0
  }));
};

// * Get monthly breakdown for a meter
export const getMonthlyBreakdown = async (meterId: string, startDate: Date, endDate: Date): Promise<MonthlyBreakdown[]> => {
  const query = `
    SELECT 
      TO_CHAR(window_start, 'YYYY-MM') as month,
      SUM(energy_kwh_sum) as total_kwh,
      AVG(avg_power_kw) as avg_kw,
      MAX(max_power_kw) as peak_kw
    FROM aggregates_15m
    WHERE meter_id = $1
      AND window_start >= $2
      AND window_start <= $3
    GROUP BY TO_CHAR(window_start, 'YYYY-MM')
    ORDER BY month ASC
  `;

  const result = await timescalePool.query(query, [meterId, startDate, endDate]);
  return result.rows.map(row => ({
    month: row.month,
    total_kwh: parseFloat(row.total_kwh) || 0,
    avg_kw: parseFloat(row.avg_kw) || 0,
    peak_kw: parseFloat(row.peak_kw) || 0,
  }));
};

// * Get regional statistics
export const getRegionalStats = async (region: string, startTime: Date, endTime: Date): Promise<RegionalStats> => {
  const query = `
    SELECT 
      region,
      SUM(energy_kwh_sum) as total_consumption_kwh,
      COUNT(DISTINCT meter_id) as active_meters,
      SUM(energy_kwh_sum) / NULLIF(COUNT(DISTINCT meter_id), 0) as avg_consumption_per_meter,
      MAX(max_power_kw) as peak_load_kw
    FROM aggregates_15m
    WHERE region = $1
      AND window_start >= $2
      AND window_start <= $3
    GROUP BY region
  `;

  const result = await timescalePool.query(query, [region, startTime, endTime]);
  if (result.rows.length === 0)
    throw new NotFoundError('No data found for this region in the specified time range');

  const row = result.rows[0];
  return {
    region: row.region,
    total_consumption_kwh: parseFloat(row.total_consumption_kwh) || 0,
    active_meters: parseInt(row.active_meters) || 0,
    avg_consumption_per_meter: parseFloat(row.avg_consumption_per_meter) || 0,
    peak_load_kw: parseFloat(row.peak_load_kw) || 0,
  };
};

// * Get top consumers in a region
export const getTopConsumers = async (region: string, startTime: Date, endTime: Date, limit: number = 10): Promise<TopConsumer[]> => {
  const query = `
    SELECT 
      meter_id,
      SUM(energy_kwh_sum) as total_kwh,
      AVG(avg_power_kw) as avg_kw,
      ROW_NUMBER() OVER (ORDER BY SUM(energy_kwh_sum) DESC) as rank
    FROM aggregates_15m
    WHERE region = $1
      AND window_start >= $2
      AND window_start <= $3
    GROUP BY meter_id
    ORDER BY total_kwh DESC
    LIMIT $4
  `;

  const result = await timescalePool.query(query, [region, startTime, endTime, limit]);
  return result.rows.map(row => ({
    meter_id: row.meter_id,
    total_kwh: parseFloat(row.total_kwh) || 0,
    avg_kw: parseFloat(row.avg_kw) || 0,
    rank: parseInt(row.rank),
  }));
};

// * Get real-time regional load
export const getRealtimeRegionalLoad = async (region: string): Promise<{ region: string; current_load_kw: number; active_meters: number; timestamp: Date; }> => {
  const query = `
    SELECT 
      region,
      SUM(avg_power_kw) as current_load_kw,
      COUNT(DISTINCT meter_id) as active_meters,
      MAX(window_start) as timestamp
    FROM aggregates_1m
    WHERE region = $1
      AND window_start >= NOW() - INTERVAL '5 minutes'
    GROUP BY region
  `;

  const result = await timescalePool.query(query, [region]);
  if (result.rows.length === 0)
    throw new NotFoundError('No recent data found for this region');

  const row = result.rows[0];
  return {
    region: row.region,
    current_load_kw: parseFloat(row.current_load_kw) || 0,
    active_meters: parseInt(row.active_meters) || 0,
    timestamp: row.timestamp,
  };
};

// * Compare two time periods for a meter
export const comparePeriods = async (meterId: string, period1Start: Date, period1End: Date, period2Start: Date, period2End: Date):
  Promise<{ period1: MeterStats; period2: MeterStats; change_kwh: number; change_percent: number; }> => {
  const [stats1, stats2] = await Promise.all([
    getMeterStats(meterId, period1Start, period1End),
    getMeterStats(meterId, period2Start, period2End),
  ]);

  const change_kwh = stats2.total_consumption_kwh - stats1.total_consumption_kwh;
  const change_percent = stats1.total_consumption_kwh > 0 ? (change_kwh / stats1.total_consumption_kwh) * 100 : 0;

  return { period1: stats1, period2: stats2, change_kwh, change_percent };
};
