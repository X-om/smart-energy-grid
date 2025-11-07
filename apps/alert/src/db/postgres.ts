import pkg from 'pg';
const { Pool } = pkg;
import { readFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger.js';

export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: Date;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertData {
  type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface UpdateAlertData {
  status?: 'active' | 'acknowledged' | 'resolved';
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata?: Record<string, any>;
}

export interface AlertFilters {
  status?: string;
  type?: string;
  region?: string;
  meter_id?: string;
  acknowledged?: boolean;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

class PostgresService {
  private pool: InstanceType<typeof Pool>;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'energy_grid',
      user: process.env.POSTGRES_USER || 'energy_user',
      password: process.env.POSTGRES_PASSWORD || 'energy_pass',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err: any) => {
      logger.error('PostgreSQL pool error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL:', error);
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    try {
      logger.info('Running database migrations...');

      const migrationPath = join(process.cwd(), 'src/db/migrations/001_create_alerts.sql');
      const migrationSQL = await readFile(migrationPath, 'utf-8');

      await client.query(migrationSQL);
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Failed to run migrations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createAlert(alertData: CreateAlertData): Promise<Alert> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO alerts (type, severity, region, meter_id, message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        alertData.type,
        alertData.severity || 'medium',
        alertData.region,
        alertData.meter_id,
        alertData.message,
        JSON.stringify(alertData.metadata || {})
      ];

      const result = await client.query(query, values);
      const alert = result.rows[0];

      logger.info(`Alert created: ${alert.id}`, {
        type: alert.type,
        region: alert.region,
        meter_id: alert.meter_id
      });

      return this.mapAlert(alert);
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAlert(id: string): Promise<Alert | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM alerts WHERE id = $1';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapAlert(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAlert(id: string, updateData: UpdateAlertData): Promise<Alert | null> {
    const client = await this.pool.connect();
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updateData.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updateData.status);
      }

      if (updateData.acknowledged !== undefined) {
        setClauses.push(`acknowledged = $${paramIndex++}`);
        values.push(updateData.acknowledged);
      }

      if (updateData.acknowledged_by !== undefined) {
        setClauses.push(`acknowledged_by = $${paramIndex++}`);
        values.push(updateData.acknowledged_by);
      }

      if (updateData.acknowledged_at !== undefined) {
        setClauses.push(`acknowledged_at = $${paramIndex++}`);
        values.push(updateData.acknowledged_at);
      }

      if (updateData.resolved_at !== undefined) {
        setClauses.push(`resolved_at = $${paramIndex++}`);
        values.push(updateData.resolved_at);
      }

      if (updateData.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updateData.metadata));
      }

      if (setClauses.length === 0) {
        throw new Error('No update data provided');
      }

      values.push(id);
      const query = `
        UPDATE alerts 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const alert = this.mapAlert(result.rows[0]);
      logger.info(`Alert updated: ${alert.id}`, { status: alert.status });

      return alert;
    } catch (error) {
      logger.error('Failed to update alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAlerts(filters: AlertFilters = {}): Promise<{ alerts: Alert[]; total: number }> {
    const client = await this.pool.connect();
    try {
      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        whereClauses.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters.type) {
        whereClauses.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }

      if (filters.region) {
        whereClauses.push(`region = $${paramIndex++}`);
        values.push(filters.region);
      }

      if (filters.meter_id) {
        whereClauses.push(`meter_id = $${paramIndex++}`);
        values.push(filters.meter_id);
      }

      if (filters.acknowledged !== undefined) {
        whereClauses.push(`acknowledged = $${paramIndex++}`);
        values.push(filters.acknowledged);
      }

      if (filters.from_date) {
        whereClauses.push(`timestamp >= $${paramIndex++}`);
        values.push(filters.from_date);
      }

      if (filters.to_date) {
        whereClauses.push(`timestamp <= $${paramIndex++}`);
        values.push(filters.to_date);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM alerts ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get alerts with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const alertsQuery = `
        SELECT * FROM alerts 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      values.push(limit, offset);
      const alertsResult = await client.query(alertsQuery, values);

      const alerts = alertsResult.rows.map((row: any) => this.mapAlert(row));

      return { alerts, total };
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveAlertsByRegion(region: string): Promise<Alert[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM alerts 
        WHERE region = $1 AND status = 'active'
        ORDER BY timestamp DESC
      `;

      const result = await client.query(query, [region]);
      return result.rows.map((row: any) => this.mapAlert(row));
    } catch (error) {
      logger.error('Failed to get active alerts by region:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAlertCount(filters: { status?: string; type?: string; region?: string } = {}): Promise<number> {
    const client = await this.pool.connect();
    try {
      const whereClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        whereClauses.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }

      if (filters.type) {
        whereClauses.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }

      if (filters.region) {
        whereClauses.push(`region = $${paramIndex++}`);
        values.push(filters.region);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const query = `SELECT COUNT(*) FROM alerts ${whereClause}`;

      const result = await client.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get alert count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapAlert(row: any): Alert {
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      region: row.region,
      meter_id: row.meter_id,
      message: row.message,
      status: row.status,
      timestamp: new Date(row.timestamp),
      acknowledged: row.acknowledged,
      acknowledged_by: row.acknowledged_by,
      acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}

export const postgresService = new PostgresService();