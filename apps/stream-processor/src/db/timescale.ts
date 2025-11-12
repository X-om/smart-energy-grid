import { Pool } from 'pg';
import { createLogger } from '../utils/logger';

const logger = createLogger('timescaledb');

export interface Aggregate1m {
  meterId: string;
  region: string;
  windowStart: Date;
  avgPowerKw: number;
  maxPowerKw: number;
  minPowerKw: number;
  energyKwhSum: number;
  voltageAvg: number;
  currentAvg: number;
  readingCount: number;
}
export interface Aggregate15m extends Aggregate1m { }

export interface RegionalAggregate1m {
  region: string;
  timestamp: string;
  meterCount: number;
  totalConsumption: number;
  avgConsumption: number;
  maxConsumption: number;
  minConsumption: number;
  loadPercentage: number;
  activeMeters: Array<string>;
}

export class TimescaleDBService {
  private static instance: TimescaleDBService;
  private pool: Pool;
  private connected: boolean = false;

  private constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
    this.setupEventHandlers();
  }

  public static getInstance(connectionString?: string): TimescaleDBService {
    if (!TimescaleDBService.instance && connectionString) TimescaleDBService.instance = new TimescaleDBService(connectionString);
    if (!TimescaleDBService.instance) throw new Error('TimescaleDBService must be initialized with connectionString first');
    return TimescaleDBService.instance;
  }

  // * Setup pool event handlers
  private setupEventHandlers() {
    this.pool.on('error', (err) => logger.error({ err }, 'Unexpected database pool error'));
    this.pool.on('connect', () => logger.debug('New database client connected'));
    this.pool.on('remove', () => logger.debug('Database client removed from pool'));
  }

  // * Connect to TimescaleDB
  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      logger.info('Connected to TimescaleDB - using centralized schema from init-timescale.sql');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to TimescaleDB');
      throw error;
    }
  }

  // * Upsert 1-minute aggregates into TimescaleDB
  public async upsertAggregates1m(aggregates: Aggregate1m[]): Promise<number> {
    if (aggregates.length === 0) return 0;
    try {
      const startTime = Date.now();
      const values = aggregates.map((_agg, idx) =>
        `($${idx * 10 + 1}, $${idx * 10 + 2}, $${idx * 10 + 3}, $${idx * 10 + 4}, $${idx * 10 + 5}, $${idx * 10 + 6}, $${idx * 10 + 7}, $${idx * 10 + 8}, $${idx * 10 + 9}, $${idx * 10 + 10})`
      ).join(', ');

      const params = aggregates.flatMap((agg) => [
        agg.meterId, agg.region, agg.windowStart, agg.avgPowerKw, agg.maxPowerKw,
        agg.minPowerKw, agg.energyKwhSum, agg.voltageAvg, agg.currentAvg, agg.readingCount
      ]);
      const query = `
        INSERT INTO aggregates_1m (meter_id, region, window_start, avg_power_kw, max_power_kw, min_power_kw, energy_kwh_sum, voltage_avg, current_avg, reading_count)
        VALUES ${values}
        ON CONFLICT (meter_id, window_start)
        DO UPDATE SET
          region = EXCLUDED.region,
          avg_power_kw = EXCLUDED.avg_power_kw,
          max_power_kw = EXCLUDED.max_power_kw,
          min_power_kw = EXCLUDED.min_power_kw,
          energy_kwh_sum = EXCLUDED.energy_kwh_sum,
          voltage_avg = EXCLUDED.voltage_avg,
          current_avg = EXCLUDED.current_avg,
          reading_count = EXCLUDED.reading_count
      `;
      await this.pool.query(query, params);
      const duration = Date.now() - startTime;
      logger.debug({ count: aggregates.length, duration }, 'Upserted 1-minute aggregates');

      return aggregates.length;
    } catch (error) {
      logger.error({ error, count: aggregates.length }, 'Failed to upsert 1m aggregates');
      throw error;
    }
  }

  //  * Insert or update 15-minute aggregates (batch upsert)
  async upsertAggregates15m(aggregates: Aggregate15m[]): Promise<number> {
    if (aggregates.length === 0) return 0;
    try {
      const startTime = Date.now();
      const values = aggregates.map((_agg, idx) =>
        `($${idx * 10 + 1}, $${idx * 10 + 2}, $${idx * 10 + 3}, $${idx * 10 + 4}, $${idx * 10 + 5}, $${idx * 10 + 6}, $${idx * 10 + 7}, $${idx * 10 + 8}, $${idx * 10 + 9}, $${idx * 10 + 10})`
      ).join(', ');

      const params = aggregates.flatMap((agg) => [
        agg.meterId, agg.region, agg.windowStart, agg.avgPowerKw, agg.maxPowerKw,
        agg.minPowerKw, agg.energyKwhSum, agg.voltageAvg, agg.currentAvg, agg.readingCount
      ]);
      const query = `
        INSERT INTO aggregates_15m (meter_id, region, window_start, avg_power_kw, max_power_kw, min_power_kw, energy_kwh_sum, voltage_avg, current_avg, reading_count)
        VALUES ${values}
        ON CONFLICT (meter_id, window_start)
        DO UPDATE SET
          region = EXCLUDED.region,
          avg_power_kw = EXCLUDED.avg_power_kw,
          max_power_kw = EXCLUDED.max_power_kw,
          min_power_kw = EXCLUDED.min_power_kw,
          energy_kwh_sum = EXCLUDED.energy_kwh_sum,
          voltage_avg = EXCLUDED.voltage_avg,
          current_avg = EXCLUDED.current_avg,
          reading_count = EXCLUDED.reading_count
      `;
      await this.pool.query(query, params);
      const duration = Date.now() - startTime;
      logger.debug({ count: aggregates.length, duration }, 'Upserted 15-minute aggregates');

      return aggregates.length;
    } catch (error) {
      logger.error({ error, count: aggregates.length }, 'Failed to upsert 15m aggregates');
      throw error;
    }
  }

  // * Get the last known average power for a meter (for anomaly detection)
  async getLastAvgPowerForMeter(meterId: string): Promise<number | null> {
    try {
      const result = await this.pool.query(
        `SELECT avg_power_kw 
        FROM aggregates_1m 
        WHERE meter_id = $1 
        ORDER BY window_start DESC LIMIT 1`, [meterId]);

      return result.rows.length > 0 ? result.rows[0].avg_power_kw : null;
    } catch (error) {
      logger.error({ error, meterId }, 'Failed to get last avg power');
      return null;
    }
  }

  // * Query aggregates for a time range (for testing/verification)
  async queryAggregates1m(startTime: Date, endTime: Date, meterId?: string): Promise<Array<Aggregate1m>> {
    try {
      const params: Array<unknown> = [startTime, endTime];
      let whereClause = 'WHERE window_start >= $1 AND window_start < $2';

      meterId ? params.push(meterId) : null;
      meterId ? whereClause += ' AND meter_id = $3' : null;

      const result = await this.pool.query(
        `SELECT 
          meter_id as "meterId",
          region,
          window_start as "windowStart",
          avg_power_kw as "avgPowerKw",
          max_power_kw as "maxPowerKw",
          min_power_kw as "minPowerKw",
          energy_kwh_sum as "energyKwhSum",
          voltage_avg as "voltageAvg",
          current_avg as "currentAvg",
          reading_count as "readingCount"
         FROM aggregates_1m ${whereClause}
         ORDER BY window_start DESC`, params);

      return result.rows;
    } catch (error) {
      logger.error({ error }, 'Failed to query 1m aggregates');
      return Array<Aggregate1m>();
    }
  }

  isConnected(): boolean { return this.connected; }

  public getStats() {
    return { total: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount };
  }

  // * Gracefully disconnect
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.connected = false;
      logger.info('Disconnected from TimescaleDB');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from TimescaleDB');
    }
  }
}
