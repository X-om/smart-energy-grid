import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { alertClient } from '../../services/external/alertClient';

// * Get all alerts (with optional filters)
export const getAllAlerts = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { status, severity, type, region, meter_id, acknowledged, start_date, end_date, limit, offset } = req.query;

    const response = await alertClient.getAllAlerts({
      status: status as string | undefined,
      severity: severity as string | undefined,
      type: type as string | undefined,
      region: region as string | undefined,
      meter_id: meter_id as string | undefined,
      acknowledged: acknowledged ? acknowledged === 'true' : undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    successResponse(res, 200, 'All alerts retrieved successfully', {
      alerts: response.data.alerts,
      pagination: response.data.pagination,
      summary: response.data.summary,
    });
  }
);

// * Get active alerts only
export const getActiveAlerts = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { severity, type, region, meter_id, limit, offset } = req.query;

    const response = await alertClient.getActiveAlerts({
      severity: severity as string | undefined,
      type: type as string | undefined,
      region: region as string | undefined,
      meter_id: meter_id as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    successResponse(res, 200, 'Active alerts retrieved successfully', {
      alerts: response.data.alerts,
      pagination: response.data.pagination,
      summary: response.data.summary,
    });
  }
);

// * Get alert history for a specific region
export const getAlertHistory = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region } = req.params;
    const { limit, offset } = req.query;

    const response = await alertClient.getAlertHistory(
      region,
      limit ? parseInt(limit as string) : undefined,
      offset ? offset ? parseInt(offset as string) : undefined : undefined
    );

    successResponse(res, 200, `Alert history for ${region} retrieved successfully`, {
      region,
      alerts: response.data.alerts,
      pagination: response.data.pagination,
      summary: response.data.summary,
    });
  }
);

// * Get a specific alert by ID
export const getAlertById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { alertId } = req.params;

    const response = await alertClient.getAlertById(alertId);

    successResponse(res, 200, 'Alert retrieved successfully', response.data.alert);
  }
);

// * Acknowledge an alert
export const acknowledgeAlert = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { alertId } = req.params;
    const { operatorId, notes } = req.body;

    const response = await alertClient.acknowledgeAlert(alertId, { operatorId, notes });

    successResponse(res, 200, 'Alert acknowledged successfully', response.data.alert);
  }
);

// * Resolve an alert
export const resolveAlert = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { alertId } = req.params;
    const { operatorId, resolution, notes } = req.body;

    const response = await alertClient.resolveAlert(alertId, { operatorId, resolution, notes });

    successResponse(res, 200, 'Alert resolved successfully', response.data.alert);
  }
);

// * Bulk resolve multiple alerts
export const bulkResolveAlerts = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { alert_ids, resolution_notes } = req.body;

    const response = await alertClient.bulkResolve({ alert_ids, resolution_notes });

    successResponse(res, 200, response.message, {
      resolved_count: response.data.resolved_count,
      alert_ids: response.data.alert_ids,
    });
  }
);

// * Get alert statistics
export const getAlertStats = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { region, type, start_date, end_date } = req.query;

    const response = await alertClient.getStats({
      region: region as string | undefined,
      type: type as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
    });

    successResponse(res, 200, 'Alert statistics retrieved successfully', response.data);
  }
);

// * Auto-resolve old alerts
export const autoResolveOldAlerts = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const response = await alertClient.autoResolveOld();

    successResponse(res, 200, response.message, {
      resolved_count: response.data.resolved_count,
    });
  }
);
