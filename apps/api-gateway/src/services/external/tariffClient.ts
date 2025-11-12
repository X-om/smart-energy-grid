import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export interface TariffData {
  id: string;
  region: string;
  price: number;
  effective_from: string;
  reason: string | null;
  triggered_by: string;
  load_percentage?: number;
  tier?: string;
}

export interface TariffHistoryItem {
  id: string;
  region: string;
  price: number;
  effective_from: string;
  reason: string | null;
  triggered_by: string;
}

export interface TariffOverrideRequest {
  region: string;
  newPrice: number;
  reason: string;
  operatorId?: string;
}

export interface TariffOverrideResponse {
  success: boolean;
  data: TariffData;
  message: string;
}

export interface AllTariffsResponse {
  success: boolean;
  data: TariffData[];
}

export interface TariffHistoryResponse {
  success: boolean;
  data: TariffHistoryItem[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

class TariffClient {
  private client: AxiosInstance;
  private readonly baseURL: string;

  constructor() {
    this.baseURL = process.env.TARIFF_SERVICE_URL || 'http://localhost:3003';
    this.client = axios.create({ baseURL: this.baseURL, timeout: 5000, headers: { 'Content-Type': 'application/json' } });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Tariff Service Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      }, (error) => {
        logger.error('Tariff Service Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNREFUSED') {
          logger.error('Tariff Service unavailable at:', this.baseURL);
          throw new Error('Tariff service is currently unavailable');
        }
        if (error.response) {
          logger.error(`Tariff Service Error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
          throw new Error(error.response.data?.message || 'Tariff service error');
        }
        throw error;
      }
    );
  }

  // * Get current tariff for a specific region
  async getCurrentTariff(region: string): Promise<TariffData> {
    try {
      const response = await this.client.get<{ status: string; data: { region: string; pricePerKwh: number } }>(`/operator/tariff/${region}`);
      if (response.data.status !== 'success' || !response.data.data) throw new Error(`No tariff data found for region: ${region}`);

      // Map the tariff service response to our TariffData interface
      return {
        id: '', // Not provided by this endpoint
        region: response.data.data.region,
        price: response.data.data.pricePerKwh,
        effective_from: new Date().toISOString(), // Not provided, use current time
        reason: null,
        triggered_by: 'automatic',
        load_percentage: undefined,
        tier: undefined,
      };
    } catch (error) {
      logger.error(`Error fetching current tariff for ${region}:`, error);
      throw error;
    }
  }

  // * Get tariff history for a specific region
  async getTariffHistory(region: string, limit?: number): Promise<TariffHistoryResponse> {
    try {
      const params = limit ? { limit } : {};

      // Actual response from tariff service
      const response = await this.client.get<{
        status: string;
        data: {
          region: string;
          history: Array<{
            tariffId: string;
            region: string;
            pricePerKwh: number;
            effectiveFrom: string;
            reason: string;
            triggeredBy: string;
            createdAt: string;
          }>;
        };
      }>(`/operator/tariff/${region}/history`, { params });

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch tariff history');
      }

      // Map to our interface format
      const mappedHistory: TariffHistoryItem[] = response.data.data.history.map(item => ({
        id: item.tariffId,
        region: item.region,
        price: item.pricePerKwh,
        effective_from: item.effectiveFrom,
        reason: item.reason,
        triggered_by: item.triggeredBy,
      }));

      return {
        success: true,
        data: mappedHistory,
      };
    } catch (error) {
      logger.error(`Error fetching tariff history for ${region}:`, error);
      throw error;
    }
  }

  // * Get current tariffs for all regions
  async getAllTariffs(): Promise<TariffData[]> {
    try {
      // Actual response from tariff service
      const response = await this.client.get<{
        status: string;
        data: {
          count: number;
          tariffs: Array<{
            region: string;
            pricePerKwh: number;
          }>;
        };
      }>('/operator/tariffs/all');

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch all tariffs');
      }

      // Map to our interface format
      return response.data.data.tariffs.map(tariff => ({
        id: '', // Not provided by this endpoint
        region: tariff.region,
        price: tariff.pricePerKwh,
        effective_from: new Date().toISOString(), // Not provided
        reason: null,
        triggered_by: 'automatic',
        load_percentage: undefined,
        tier: undefined,
      }));
    } catch (error) {
      logger.error('Error fetching all tariffs:', error);
      throw error;
    }
  }

  // * Create a manual tariff override (admin only)
  async overrideTariff(data: TariffOverrideRequest): Promise<TariffOverrideResponse> {
    try {
      // Actual response from tariff service
      const response = await this.client.post<{
        status: string;
        message: string;
        data: {
          tariffId: string;
          region: string;
          newPrice: number;
          oldPrice: number;
        };
      }>('/operator/tariff/override', data);

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to create tariff override');
      }

      // Map to our interface format
      return {
        success: true,
        message: response.data.message,
        data: {
          id: response.data.data.tariffId,
          region: response.data.data.region,
          price: response.data.data.newPrice,
          effective_from: new Date().toISOString(),
          reason: data.reason,
          triggered_by: 'manual',
          load_percentage: undefined,
          tier: undefined,
        },
      };
    } catch (error) {
      logger.error('Error creating tariff override:', error);
      throw error;
    }
  }

  // * Remove a tariff override (admin only)
  // * Note: This functionality  need to be added to the tariff service
  async removeOverride(tariffId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.delete<{ success: boolean; message: string }>(`/operator/tariff/override/${tariffId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error removing tariff override ${tariffId}:`, error);
      throw error;
    }
  }
}

export const tariffClient = new TariffClient();
