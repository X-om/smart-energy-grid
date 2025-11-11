import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';

export interface Alert {
  id: string;
  type: string;
  severity: string;
  region: string | null;
  meter_id: string | null;
  message: string;
  status: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AlertSummary {
  active: number;
  acknowledged: number;
  resolved: number;
}

export interface AlertsResponse {
  status: string;
  data: {
    alerts: Alert[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
    };
    summary: AlertSummary;
  };
}

export interface SingleAlertResponse {
  status: string;
  data: {
    alert: Alert;
  };
}

export interface AlertStatsResponse {
  status: string;
  data: {
    total_alerts: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    by_region?: Record<string, number>;
    avg_resolution_time_minutes?: number;
  };
}

export interface BulkResolveResponse {
  status: string;
  data: {
    resolved_count: number;
    alert_ids: string[];
  };
  message: string;
}

export interface UserAlertQueryParams {
  meter_id: string;
  status?: string;
  severity?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface OperatorAlertQueryParams {
  status?: string;
  severity?: string;
  type?: string;
  region?: string;
  meter_id?: string;
  acknowledged?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface AcknowledgeAlertRequest {
  acknowledged_by: string;
}

export interface ResolveAlertRequest {
  resolution_notes?: string;
}

export interface BulkResolveRequest {
  alert_ids: string[];
  resolution_notes?: string;
}

class AlertClient {
  private client: AxiosInstance;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = process.env.ALERT_SERVICE_URL || 'http://localhost:3004';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Alert Service Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Alert Service Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNREFUSED') {
          logger.error('Alert Service unavailable at:', this.baseURL);
          throw new Error('Alert service is currently unavailable');
        }
        if (error.response) {
          logger.error(
            `Alert Service Error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`
          );
          throw new Error(error.response.data?.message || 'Alert service error');
        }
        throw error;
      }
    );
  }

  // * USER ENDPOINTS

  // Get alerts for a specific user/meter
  async getUserAlerts(params: UserAlertQueryParams): Promise<AlertsResponse> {
    try {
      const response = await this.client.get<AlertsResponse>('/user/alerts', { params });
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch user alerts');
      }
      return response.data;
    } catch (error) {
      logger.error('Error fetching user alerts:', error);
      throw error;
    }
  }

  // Get a specific alert by ID for a user
  async getUserAlertById(alertId: string, meterId: string): Promise<SingleAlertResponse> {
    try {
      const response = await this.client.get<SingleAlertResponse>(`/user/alerts/${alertId}`, {
        params: { meter_id: meterId },
      });
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch user alert');
      }
      return response.data;
    } catch (error) {
      logger.error(`Error fetching user alert ${alertId}:`, error);
      throw error;
    }
  }

  // * OPERATOR ENDPOINTS

  // Get all alerts (with filters)
  async getAllAlerts(params?: OperatorAlertQueryParams): Promise<AlertsResponse> {
    try {
      const response = await this.client.get<AlertsResponse>('/operator/alerts', { params });
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch all alerts');
      }
      return response.data;
    } catch (error) {
      logger.error('Error fetching all alerts:', error);
      throw error;
    }
  }

  // Get active alerts only
  async getActiveAlerts(params?: OperatorAlertQueryParams): Promise<AlertsResponse> {
    try {
      const response = await this.client.get<AlertsResponse>('/operator/alerts/active', { params });
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch active alerts');
      }
      return response.data;
    } catch (error) {
      logger.error('Error fetching active alerts:', error);
      throw error;
    }
  }

  // Get alert history for a specific region
  async getAlertHistory(region: string, limit?: number, offset?: number): Promise<AlertsResponse> {
    try {
      const params = { limit, offset };
      const response = await this.client.get<AlertsResponse>(`/operator/alerts/history/${region}`, { params });
      if (response.data.status !== 'success') {
        throw new Error(`Failed to fetch alert history for ${region}`);
      }
      return response.data;
    } catch (error) {
      logger.error(`Error fetching alert history for ${region}:`, error);
      throw error;
    }
  }

  // Get a specific alert by ID
  async getAlertById(alertId: string): Promise<SingleAlertResponse> {
    try {
      const response = await this.client.get<SingleAlertResponse>(`/operator/alerts/${alertId}`);
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch alert');
      }
      return response.data;
    } catch (error) {
      logger.error(`Error fetching alert ${alertId}:`, error);
      throw error;
    }
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: string, data: AcknowledgeAlertRequest): Promise<SingleAlertResponse> {
    try {
      const response = await this.client.post<SingleAlertResponse>(`/operator/alerts/${alertId}/acknowledge`, data);
      if (response.data.status !== 'success') {
        throw new Error('Failed to acknowledge alert');
      }
      return response.data;
    } catch (error) {
      logger.error(`Error acknowledging alert ${alertId}:`, error);
      throw error;
    }
  }

  // Resolve an alert
  async resolveAlert(alertId: string, data?: ResolveAlertRequest): Promise<SingleAlertResponse> {
    try {
      const response = await this.client.post<SingleAlertResponse>(`/operator/alerts/${alertId}/resolve`, data || {});
      if (response.data.status !== 'success') {
        throw new Error('Failed to resolve alert');
      }
      return response.data;
    } catch (error) {
      logger.error(`Error resolving alert ${alertId}:`, error);
      throw error;
    }
  }

  // Bulk resolve multiple alerts
  async bulkResolve(data: BulkResolveRequest): Promise<BulkResolveResponse> {
    try {
      const response = await this.client.post<BulkResolveResponse>('/operator/alerts/bulk-resolve', data);
      if (response.data.status !== 'success') {
        throw new Error('Failed to bulk resolve alerts');
      }
      return response.data;
    } catch (error) {
      logger.error('Error bulk resolving alerts:', error);
      throw error;
    }
  }

  // Get alert statistics
  async getStats(params?: { region?: string; type?: string; start_date?: string; end_date?: string }): Promise<AlertStatsResponse> {
    try {
      const response = await this.client.get<AlertStatsResponse>('/operator/alerts/stats', { params });
      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch alert statistics');
      }
      return response.data;
    } catch (error) {
      logger.error('Error fetching alert statistics:', error);
      throw error;
    }
  }

  // Auto-resolve old alerts
  async autoResolveOld(): Promise<{ status: string; data: { resolved_count: number }; message: string }> {
    try {
      const response = await this.client.post<{ status: string; data: { resolved_count: number }; message: string }>('/operator/alerts/auto-resolve');
      if (response.data.status !== 'success') {
        throw new Error('Failed to auto-resolve old alerts');
      }
      return response.data;
    } catch (error) {
      logger.error('Error auto-resolving old alerts:', error);
      throw error;
    }
  }
}

export const alertClient = new AlertClient();
