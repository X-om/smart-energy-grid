import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

/**
 * TimescaleDB connection pool for time-series data
 * Handles meter readings and aggregated consumption data
 */
class TimescaleClient {
  private pool: pg.Pool;
  private isConnected: boolean = false;

  constructor() {
    const connectionString = process.env.TIMESCALE_URL || 'postgresql://segs_user:segs_password@localhost:5432/segs_db';

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle TimescaleDB client', err);
    });

    logger.info('TimescaleDB pool initialized');
  }

  /**
   * Connect to TimescaleDB and verify connection
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.isConnected = true;
      logger.info('TimescaleDB connection verified');
    } catch (error) {
      logger.error('Failed to connect to TimescaleDB', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed TimescaleDB query', {
        query: text.substring(0, 100),
        duration,
        rows: result.rowCount
      });
      return result;
    } catch (error) {
      logger.error('TimescaleDB query error', { query: text, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<pg.PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Check if connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool.totalCount > 0;
  }

  /**
   * Close all connections
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('TimescaleDB pool closed');
    } catch (error) {
      logger.error('Error closing TimescaleDB pool', error);
      throw error;
    }
  }
}

export const timescaleClient = new TimescaleClient();
