import pkg from 'pg';
const { Pool } = pkg;
type PoolType = typeof Pool.prototype;
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('postgres');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TariffRecord {
  tariffId: string;
  region: string;
  pricePerKwh: number;
  effectiveFrom: Date;
  reason?: string;
  triggeredBy: string;
  createdAt?: Date;
}

export class PostgresService {
  private static instance: PostgresService;
  private pool: PoolType;
  private connected: boolean = false;

  private constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });
    this.pool.on('error', (err: Error) => logger.error({ error: err }, 'Unexpected database pool error'));
  }

  static getInstance(connectionString?: string): PostgresService {
    if (!PostgresService.instance) {
      if (!connectionString) throw new Error('Connection string required for first initialization');
      PostgresService.instance = new PostgresService(connectionString);
    }
    return PostgresService.instance;
  }

  public async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');

      client.release();
      this.connected = true;
      logger.info('Connected to PostgreSQL');

      await this.runMigrations();
    } catch (error) {
      logger.error({ error }, 'Failed to connect to PostgreSQL');
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      const migrationPath = join(__dirname, '../db/migrations', '001_create_tariffs.sql');
      const migration = readFileSync(migrationPath, 'utf-8');

      await this.pool.query(migration);
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error({ error }, 'Migration failed');
      throw error;
    }
  }

  public async insertTariff(tariff: TariffRecord): Promise<void> {
    try {
      const query = `INSERT INTO tariffs (tariff_id, region, price_per_kwh, effective_from, reason, triggered_by) VALUES ($1, $2, $3, $4, $5, $6)`;
      await this.pool.query(query, [tariff.tariffId, tariff.region, tariff.pricePerKwh, tariff.effectiveFrom, tariff.reason || null, tariff.triggeredBy]);

      logger.debug({ region: tariff.region, price: tariff.pricePerKwh }, 'Tariff record inserted');
    } catch (error) {
      logger.error({ error, tariff }, 'Failed to insert tariff');
      throw error;
    }
  }

  public async getCurrentTariff(region: string): Promise<TariffRecord | null> {
    try {
      const query = `
      SELECT 
      tariff_id as "tariffId", 
      region, 
      price_per_kwh as "pricePerKwh", 
      effective_from as "effectiveFrom", 
      reason, 
      triggered_by as "triggeredBy", 
      created_at as "createdAt" 
      FROM tariffs WHERE region = $1 
      ORDER BY effective_from DESC LIMIT 1`;

      const result = await this.pool.query(query, [region]);
      return result.rows.length === 0 ? null : result.rows[0];
    } catch (error) {
      logger.error({ error, region }, 'Failed to get current tariff');
      throw error;
    }
  }

  public async getAllCurrentTariffs(): Promise<Map<string, number>> {
    try {
      const query = `SELECT DISTINCT ON (region) region, price_per_kwh as "pricePerKwh" FROM tariffs ORDER BY region, effective_from DESC`;
      const result = await this.pool.query(query);
      const tariffMap = new Map<string, number>();

      for (const row of result.rows)
        tariffMap.set(row.region, row.pricePerKwh);

      logger.info({ count: tariffMap.size }, 'Loaded current tariffs');
      return tariffMap;
    } catch (error) {
      logger.error({ error }, 'Failed to load all current tariffs');
      throw error;
    }
  }

  public async getTariffHistory(region: string, limit: number = 10): Promise<Array<TariffRecord>> {
    try {
      const query = `
      SELECT 
      tariff_id as "tariffId", 
      region, 
      price_per_kwh as "pricePerKwh", 
      effective_from as "effectiveFrom", 
      reason, 
      triggered_by as "triggeredBy", 
      created_at as "createdAt" 
      FROM tariffs WHERE region = $1 
      ORDER BY effective_from DESC LIMIT $2`;

      const result = await this.pool.query(query, [region, limit]);
      return result.rows;
    } catch (error) {
      logger.error({ error, region }, 'Failed to get tariff history');
      throw error;
    }
  }

  public async getTariffById(tariffId: string): Promise<TariffRecord | null> {
    try {
      const query = `
      SELECT 
      tariff_id as "tariffId", 
      region, 
      price_per_kwh as "pricePerKwh", 
      effective_from as "effectiveFrom", 
      reason, 
      triggered_by as "triggeredBy", 
      created_at as "createdAt" 
      FROM tariffs WHERE tariff_id = $1`;

      const result = await this.pool.query(query, [tariffId]);
      return result.rows.length === 0 ? null : result.rows[0];
    } catch (error) {
      logger.error({ error, tariffId }, 'Failed to get tariff by ID');
      throw error;
    }
  }

  public async deleteTariff(tariffId: string): Promise<boolean> {
    try {
      const query = `DELETE FROM tariffs WHERE tariff_id = $1`;
      const result = await this.pool.query(query, [tariffId]);

      logger.debug({ tariffId, deleted: result.rowCount }, 'Tariff deletion attempted');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error({ error, tariffId }, 'Failed to delete tariff');
      throw error;
    }
  }

  public isConnected(): boolean { return this.connected; }

  public getStats() {
    return { total: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount };
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    logger.info('Disconnected from PostgreSQL');
  }
}
