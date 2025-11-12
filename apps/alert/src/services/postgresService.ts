import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('postgres');

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
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertData {
  type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAlertData {
  status?: 'active' | 'acknowledged' | 'resolved';
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata?: Record<string, unknown>;
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

export class PostgresService {
  private static instance: PostgresService;
  private pool: InstanceType<typeof Pool>;

  private constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000
    });
    this.pool.on('error', (err: Error) => logger.error({ error: err }, 'Unexpected database pool error'));
  }

  static getInstance(connectionString?: string): PostgresService {
    if (!PostgresService.instance) {
      if (!connectionString)
        throw new Error('Connection string required for first initialization');
      PostgresService.instance = new PostgresService(connectionString);
    }
    return PostgresService.instance;
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('Connected to PostgreSQL');

      await this.runMigrations();
    } catch (error) {
      logger.error({ error }, 'Failed to connect to PostgreSQL');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL disconnected');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting from PostgreSQL');
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations...');
      const migrationPath = join(__dirname, '../db/migrations', '001_create_alerts.sql');
      const schemaSQL = readFileSync(migrationPath, 'utf-8');
      await this.pool.query(schemaSQL);
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error({ error }, 'Migration failed');
      throw error;
    }
  }

  async createAlert(data: CreateAlertData): Promise<Alert> {
    try {
      const query = `
        INSERT INTO alerts (type, severity, region, meter_id, message, status, acknowledged, metadata, timestamp, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
        RETURNING *`;

      const values = [
        data.type, data.severity || 'medium', data.region,
        data.meter_id, data.message, 'active', false,
        JSON.stringify(data.metadata || {})
      ];

      const result = await this.pool.query(query, values);
      return this.mapRowToAlert(result.rows[0]);
    } catch (error) {
      logger.error({ error, data }, 'Failed to insert alert');
      throw error;
    }
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    try {
      const query = 'SELECT * FROM alerts WHERE id = $1';
      const result = await this.pool.query(query, [alertId]);

      return result.rows.length > 0 ? this.mapRowToAlert(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to get alert');
      throw error;
    }
  }

  async updateAlert(alertId: string, data: UpdateAlertData): Promise<Alert | null> {
    try {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }
      if (data.acknowledged !== undefined) {
        updates.push(`acknowledged = $${paramIndex++}`);
        values.push(data.acknowledged);
      }
      if (data.acknowledged_by !== undefined) {
        updates.push(`acknowledged_by = $${paramIndex++}`);
        values.push(data.acknowledged_by);
      }
      if (data.acknowledged_at !== undefined) {
        updates.push(`acknowledged_at = $${paramIndex++}`);
        values.push(data.acknowledged_at);
      }
      if (data.resolved_at !== undefined) {
        updates.push(`resolved_at = $${paramIndex++}`);
        values.push(data.resolved_at);
      }
      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(data.metadata));
      }

      if (updates.length === 0) return this.getAlert(alertId);

      updates.push(`updated_at = NOW()`);
      values.push(alertId);

      const query = `UPDATE alerts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await this.pool.query(query, values);

      return result.rows.length > 0 ? this.mapRowToAlert(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, alertId }, 'Failed to update alert');
      throw error;
    }
  }

  async getAlerts(filters: AlertFilters): Promise<{ alerts: Alert[]; total: number }> {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }
      if (filters.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(filters.type);
      }
      if (filters.region) {
        conditions.push(`region = $${paramIndex++}`);
        values.push(filters.region);
      }
      if (filters.meter_id) {
        conditions.push(`meter_id = $${paramIndex++}`);
        values.push(filters.meter_id);
      }
      if (filters.acknowledged !== undefined) {
        conditions.push(`acknowledged = $${paramIndex++}`);
        values.push(filters.acknowledged);
      }
      if (filters.from_date) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(filters.from_date);
      }
      if (filters.to_date) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(filters.to_date);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) FROM alerts ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count, 10);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const dataQuery = `
        SELECT * FROM alerts ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

      const dataResult = await this.pool.query(dataQuery, [...values, limit, offset]);

      return {
        alerts: dataResult.rows.map(row => this.mapRowToAlert(row)),
        total
      };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to get alerts');
      throw error;
    }
  }

  async getActiveAlerts(region?: string): Promise<Alert[]> {
    try {
      const query = region
        ? 'SELECT * FROM alerts WHERE status = $1 AND region = $2 ORDER BY created_at DESC'
        : 'SELECT * FROM alerts WHERE status = $1 ORDER BY created_at DESC';

      const values = region ? ['active', region] : ['active'];
      const result = await this.pool.query(query, values);

      return result.rows.map(row => this.mapRowToAlert(row));
    } catch (error) {
      logger.error({ error, region }, 'Failed to get active alerts');
      throw error;
    }
  }

  async getAlertHistory(filters: AlertFilters): Promise<{ alerts: Alert[]; total: number }> {
    return this.getAlerts({ ...filters, status: 'resolved' });
  }

  async bulkResolveAlerts(alertIds: string[], _resolvedBy: string, resolvedAt: Date, resolutionNote?: string): Promise<Alert[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resolvedAlerts: Alert[] = [];

      for (const alertId of alertIds) {
        const metadata = resolutionNote ? { resolution_note: resolutionNote } : {};
        const query = `
          UPDATE alerts
          SET status = 'resolved',
              resolved_at = $1,
              metadata = metadata || $2::jsonb,
              updated_at = NOW()
          WHERE id = $3 AND status != 'resolved'
          RETURNING *`;

        const result = await client.query(query, [
          resolvedAt,
          JSON.stringify(metadata),
          alertId
        ]);

        if (result.rows.length > 0) {
          resolvedAlerts.push(this.mapRowToAlert(result.rows[0]));
        }
      }

      await client.query('COMMIT');
      logger.info({ count: resolvedAlerts.length }, 'Bulk resolved alerts');

      return resolvedAlerts;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error }, 'Failed to bulk resolve alerts');
      throw error;
    } finally { client.release(); }
  }

  async getStatistics(region?: string): Promise<any> {
    try {
      const whereClause = region ? 'WHERE region = $1' : '';
      const values = region ? [region] : [];

      const totalQuery = `SELECT COUNT(*) as total FROM alerts ${whereClause}`;
      const activeQuery = `SELECT COUNT(*) as active FROM alerts ${whereClause} ${region ? 'AND' : 'WHERE'} status = 'active'`;
      const acknowledgedQuery = `SELECT COUNT(*) as acknowledged FROM alerts ${whereClause} ${region ? 'AND' : 'WHERE'} acknowledged = true`;
      const resolvedQuery = `SELECT COUNT(*) as resolved FROM alerts ${whereClause} ${region ? 'AND' : 'WHERE'} status = 'resolved'`;
      const typeQuery = `SELECT type, COUNT(*) as count FROM alerts ${whereClause} GROUP BY type`;
      const regionQuery = region ? null : 'SELECT region, COUNT(*) as count FROM alerts WHERE region IS NOT NULL GROUP BY region';
      const avgResolutionQuery = `
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
        FROM alerts ${whereClause} ${region ? 'AND' : 'WHERE'} resolved_at IS NOT NULL`;

      const [
        totalResult,
        activeResult,
        acknowledgedResult,
        resolvedResult,
        typeResult,
        regionResult,
        avgResult
      ] = await Promise.all([
        this.pool.query(totalQuery, values),
        this.pool.query(activeQuery, values),
        this.pool.query(acknowledgedQuery, values),
        this.pool.query(resolvedQuery, values),
        this.pool.query(typeQuery, values),
        regionQuery ? this.pool.query(regionQuery) : Promise.resolve(null),
        this.pool.query(avgResolutionQuery, values)
      ]);

      const alertsByType: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        alertsByType[row.type] = parseInt(row.count, 10);
      });

      const alertsByRegion: Record<string, number> = {};
      if (regionResult) {
        regionResult.rows.forEach(row => {
          alertsByRegion[row.region] = parseInt(row.count, 10);
        });
      }

      return {
        total_alerts: parseInt(totalResult.rows[0].total, 10),
        active_alerts: parseInt(activeResult.rows[0].active, 10),
        acknowledged_alerts: parseInt(acknowledgedResult.rows[0].acknowledged, 10),
        resolved_alerts: parseInt(resolvedResult.rows[0].resolved, 10),
        alerts_by_type: alertsByType,
        alerts_by_region: alertsByRegion,
        avg_resolution_time_hours: parseFloat(avgResult.rows[0].avg_hours) || 0
      };
    } catch (error) {
      logger.error({ error, region }, 'Failed to get statistics');
      throw error;
    }
  }

  async autoResolveOldAlerts(maxAgeHours: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const query = `
        UPDATE alerts
        SET status = 'resolved',
            resolved_at = NOW(),
            metadata = metadata || '{"auto_resolved": true}'::jsonb,
            updated_at = NOW()
        WHERE status = 'active'
          AND created_at < $1`;

      const result = await this.pool.query(query, [cutoffDate]);
      logger.info({ count: result.rowCount, maxAgeHours }, 'Auto-resolved old alerts');

      return result.rowCount || 0;
    } catch (error) {
      logger.error({ error }, 'Failed to auto-resolve old alerts');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      return false;
    }
  }

  private mapRowToAlert(row: any): Alert {
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      region: row.region,
      meter_id: row.meter_id,
      message: row.message,
      status: row.status,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged,
      acknowledged_by: row.acknowledged_by,
      acknowledged_at: row.acknowledged_at,
      resolved_at: row.resolved_at,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
