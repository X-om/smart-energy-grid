import { Pool } from 'pg';
import { postgresPool } from '../../utils/db.js';
import { NotFoundError } from '../../utils/errors.js';
import { Invoice, InvoiceWithLineItems, InvoiceSummary, OverdueInvoice, InvoiceAnalytics, PaymentHistoryRecord, InvoiceStatus, MarkInvoicePaidRequest, DisputeInvoiceRequest } from '../../types/invoice.types.js';

export class BillingService {
  private pool: Pool;
  constructor(pool: Pool = postgresPool) { this.pool = pool; }

  async getUserInvoices(userId: string, options: { limit?: number; offset?: number; status?: InvoiceStatus; start_date?: Date; end_date?: Date; } = {}): Promise<{ invoices: InvoiceSummary[]; total: number }> {
    const { limit = 20, offset = 0, status, start_date, end_date } = options;
    const whereConditions = ['user_id = $1'];
    const params: unknown[] = [userId];

    let paramIndex = 2;
    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (start_date) {
      whereConditions.push(`billing_period_start >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      whereConditions.push(`billing_period_end <= $${paramIndex++}`);
      params.push(end_date);
    }

    const whereClause = whereConditions.join(' AND ');
    const countQuery = `SELECT COUNT(*) as count FROM invoices WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const dataQuery = `
      SELECT 
        invoice_id, invoice_number, billing_period_start, billing_period_end,
        total_consumption_kwh, total_cost, currency, status, due_date,
        is_disputed, created_at
      FROM invoices
      WHERE ${whereClause}
      ORDER BY billing_period_start DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);
    const result = await this.pool.query(dataQuery, params);

    return { invoices: result.rows, total };
  }


  async getInvoiceById(invoiceId: string, userId?: string): Promise<Invoice> {
    let query = 'SELECT * FROM invoices WHERE invoice_id = $1';
    const params: unknown[] = [invoiceId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }
    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) throw new NotFoundError('Invoice not found');

    return result.rows[0];
  }

  async getInvoiceWithLineItems(invoiceId: string, userId?: string): Promise<InvoiceWithLineItems> {
    const invoice = await this.getInvoiceById(invoiceId, userId);

    const lineItemsQuery = `
      SELECT * FROM invoice_line_items
      WHERE invoice_id = $1
      ORDER BY period_start ASC
    `;

    const lineItemsResult = await this.pool.query(lineItemsQuery, [invoiceId]);
    return { ...invoice, line_items: lineItemsResult.rows };
  }

  async getPaymentHistory(userId: string, limit: number = 20, offset: number = 0): Promise<{ payments: PaymentHistoryRecord[]; total: number }> {
    const countQuery = `SELECT COUNT(*) as count FROM payment_transactions WHERE user_id = $1`;
    const countResult = await this.pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        pt.transaction_id,
        pt.invoice_id,
        i.invoice_number,
        pt.amount,
        pt.payment_method,
        pt.status,
        pt.created_at
      FROM payment_transactions pt
      LEFT JOIN invoices i ON pt.invoice_id = i.invoice_id
      WHERE pt.user_id = $1
      ORDER BY pt.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(dataQuery, [userId, limit, offset]);
    return { payments: result.rows, total };
  }

  async markInvoiceAsPaid(invoiceId: string, userId: string, data: MarkInvoicePaidRequest): Promise<Invoice> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const checkQuery = `SELECT invoice_id, status, total_cost FROM invoices WHERE invoice_id = $1 AND user_id = $2`;
      const checkResult = await client.query(checkQuery, [invoiceId, userId]);

      if (checkResult.rows.length === 0) throw new NotFoundError('Invoice not found');
      const invoice = checkResult.rows[0];

      if (invoice.status === 'paid') throw new Error('Invoice is already paid');
      if (invoice.status === 'cancelled') throw new Error('Cannot pay a cancelled invoice');

      const updateQuery = `
        UPDATE invoices
        SET 
          status = 'paid',
          paid_at = COALESCE($1, NOW()),
          payment_method = $2,
          payment_reference = $3,
          notes = COALESCE($4, notes),
          updated_at = NOW()
        WHERE invoice_id = $5
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [data.paid_at || null, data.payment_method, data.payment_reference || null, data.notes || null, invoiceId]);
      const transactionQuery = `INSERT INTO payment_transactions (invoice_id, user_id, amount, payment_method, status, metadata) VALUES ($1, $2, $3, $4, 'completed', $5)`;

      await client.query(transactionQuery, [
        invoiceId, userId,
        invoice.total_cost, data.payment_method, JSON.stringify({ payment_reference: data.payment_reference })
      ]);

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async disputeInvoice(invoiceId: string, userId: string, data: DisputeInvoiceRequest): Promise<Invoice> {
    const updateQuery = `
      UPDATE invoices
      SET 
        status = 'disputed',
        is_disputed = true,
        disputed_at = NOW(),
        dispute_reason = $1,
        updated_at = NOW()
      WHERE invoice_id = $2 AND user_id = $3 AND status != 'paid'
      RETURNING *
    `;
    const result = await this.pool.query(updateQuery, [data.dispute_reason, invoiceId, userId]);
    if (result.rows.length === 0) throw new NotFoundError('Invoice not found or cannot be disputed');

    return result.rows[0];
  }

  async getCurrentBillingCycle(userId: string, meterId: string): Promise<{ cycle_start: Date; cycle_end: Date; days_remaining: number; current_month_invoice: Invoice | null; }> {

    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const daysRemaining = Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const query = `
      SELECT * FROM invoices
      WHERE user_id = $1 
        AND meter_id = $2
        AND billing_period_start >= $3
        AND billing_period_end <= $4
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [userId, meterId, cycleStart, cycleEnd]);
    return {
      cycle_start: cycleStart, cycle_end: cycleEnd,
      days_remaining: daysRemaining, current_month_invoice: result.rows[0] || null
    };
  }

  async getOverdueInvoicesByRegion(region: string, limit: number = 50, offset: number = 0): Promise<{ invoices: OverdueInvoice[]; total: number }> {
    const countQuery = `SELECT COUNT(*) as count FROM invoices WHERE region = $1 AND status = 'overdue'`;
    const countResult = await this.pool.query(countQuery, [region]);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT 
        i.invoice_id,
        i.invoice_number,
        i.user_id,
        u.name as user_name,
        u.email as user_email,
        i.meter_id,
        i.region,
        i.total_cost,
        i.currency,
        i.due_date,
        EXTRACT(DAY FROM NOW() - i.due_date)::INTEGER as days_overdue,
        i.created_at
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.user_id
      WHERE i.region = $1 AND i.status = 'overdue'
      ORDER BY i.due_date ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(dataQuery, [region, limit, offset]);
    return { invoices: result.rows, total };
  }

  async getInvoiceAnalytics(region?: string, startDate?: Date, endDate?: Date): Promise<InvoiceAnalytics> {

    const whereConditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (region) {
      whereConditions.push(`region = $${paramIndex++}`);
      params.push(region);
    }

    if (startDate) {
      whereConditions.push(`billing_period_start >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`billing_period_end <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
      SELECT 
        COALESCE($${paramIndex}, 'All Regions') as region,
        MIN(billing_period_start) as period_start,
        MAX(billing_period_end) as period_end,
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
        COUNT(*) FILTER (WHERE status = 'disputed') as disputed_invoices,
        SUM(total_cost) as total_revenue,
        SUM(CASE WHEN status = 'paid' THEN total_cost ELSE 0 END) as collected_revenue,
        SUM(CASE WHEN status IN ('pending', 'overdue') THEN total_cost ELSE 0 END) as outstanding_revenue,
        AVG(total_cost) as average_bill_amount,
        SUM(total_consumption_kwh) as total_consumption_kwh,
        COALESCE(MAX(currency), 'USD') as currency
      FROM invoices
      ${whereClause}
    `;

    params.push(region || 'All Regions');
    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  async generateMonthlyInvoice(userId: string, meterId: string, year: number, month: number): Promise<Invoice> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const userQuery = 'SELECT region FROM users WHERE user_id = $1';
      const userResult = await client.query(userQuery, [userId]);

      if (userResult.rows.length === 0) throw new NotFoundError('User not found');
      const region = userResult.rows[0].region;

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59);

      const existingQuery = `SELECT invoice_id FROM invoices WHERE user_id = $1 AND meter_id = $2 AND billing_period_start = $3 AND billing_period_end = $4`;
      const existingResult = await client.query(existingQuery, [userId, meterId, periodStart, periodEnd]);

      if (existingResult.rows.length > 0) throw new Error('Invoice already exists for this period');

      const totalConsumption = 100;
      const avgRate = 6.5;
      const baseCost = totalConsumption * avgRate;
      const taxAmount = baseCost * 0.1;
      const totalCost = baseCost + taxAmount;

      const invoiceNumberResult = await client.query('SELECT generate_invoice_number() as number');
      const invoiceNumber = invoiceNumberResult.rows[0].number;
      const dueDate = new Date(periodEnd);

      dueDate.setDate(dueDate.getDate() + 30);
      const insertQuery = `
        INSERT INTO invoices (
          invoice_number, user_id, meter_id, region,
          billing_period_start, billing_period_end,
          total_consumption_kwh, avg_tariff_rate,
          base_cost, tax_amount, total_cost,
          currency, status, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`;

      const invoiceResult = await client.query(insertQuery, [
        invoiceNumber, userId, meterId, region, periodStart, periodEnd,
        totalConsumption, avgRate, baseCost, taxAmount, totalCost, 'USD', 'pending', dueDate
      ]);
      await client.query('COMMIT');
      return invoiceResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }


  async generateMonthlyInvoicesForRegion(region: string, year: number, month: number): Promise<{ success: number; failed: number; errors: string[] }> {
    const query = `SELECT u.user_id, u.meter_id FROM users u WHERE u.region = $1 AND u.meter_id IS NOT NULL`;
    const result = await this.pool.query(query, [region]);
    const users = result.rows;

    let success = 0;
    let failed = 0;

    const errors: string[] = [];
    for (const user of users) {
      try {
        await this.generateMonthlyInvoice(user.user_id, user.meter_id, year, month);
        success++;
      } catch (error) {
        failed++;
        errors.push(`User ${user.user_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { success, failed, errors };
  }

  async exportInvoicesCSV(options: { start_date?: Date; end_date?: Date; region?: string; status?: InvoiceStatus; }): Promise<string> {
    const whereConditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.start_date) {
      whereConditions.push(`billing_period_start >= $${paramIndex++}`);
      params.push(options.start_date);
    }

    if (options.end_date) {
      whereConditions.push(`billing_period_end <= $${paramIndex++}`);
      params.push(options.end_date);
    }

    if (options.region) {
      whereConditions.push(`region = $${paramIndex++}`);
      params.push(options.region);
    }

    if (options.status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
      SELECT 
        invoice_number, user_id, meter_id, region,
        billing_period_start, billing_period_end,
        total_consumption_kwh, avg_tariff_rate,
        base_cost, tax_amount, total_cost, currency,
        status, due_date, paid_at
      FROM invoices
      ${whereClause}
      ORDER BY billing_period_start DESC
    `;

    const result = await this.pool.query(query, params);
    if (result.rows.length === 0) return 'No data';

    const headers = Object.keys(result.rows[0]).join(',');
    const rows = result.rows.map(row =>
      Object.values(row).map(val => val === null ? '' : `"${String(val).replace(/"/g, '""')}"`).join(',')
    );
    return [headers, ...rows].join('\n');
  }
}

export const billingService = new BillingService();
