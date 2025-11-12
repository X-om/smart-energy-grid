import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { successResponse } from '../../utils/response';
import { tariffClient, TariffData } from '../../services/external/tariffClient';

// * Get current tariffs for all regions
export const getAllRegionalTariffs = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Define all possible regions
    const allRegions = [
      'Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South',
      'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West',
      'Hyderabad-Central', 'Chennai-North'
    ];

    // Fetch both current tariff AND history (to get triggered_by info) for each region
    const tariffPromises = allRegions.map(async (region) => {
      try {
        const [currentTariff, historyResponse] = await Promise.all([
          tariffClient.getCurrentTariff(region),
          tariffClient.getTariffHistory(region, 1) // Get latest history entry
        ]);

        // Use history data for triggered_by/reason if available
        const latestHistory = historyResponse.data[0];
        if (latestHistory) {
          return {
            ...currentTariff,
            triggered_by: latestHistory.triggered_by,
            reason: latestHistory.reason,
          };
        }
        return currentTariff;
      } catch (error) {
        // Region might not have tariff data yet, skip it
        return null;
      }
    });

    const tariffResults = await Promise.all(tariffPromises);
    const tariffs = tariffResults.filter((t): t is TariffData => t !== null);

    const tariffsByRegion = tariffs.reduce((acc, tariff) => {
      acc[tariff.region] = tariff;
      return acc;
    }, {} as Record<string, TariffData>);

    successResponse(res, 200, 'Regional tariffs retrieved successfully', { total_regions: tariffs.length, tariffs: tariffsByRegion, raw_data: tariffs });
  }
);

// * Get tariff analytics across regions
export const getTariffAnalytics = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { start, end, region } = req.query;

    // Define all possible regions
    const allRegions = [
      'Mumbai-North', 'Mumbai-South', 'Delhi-North', 'Delhi-South',
      'Bangalore-East', 'Bangalore-West', 'Pune-East', 'Pune-West',
      'Hyderabad-Central', 'Chennai-North'
    ];

    // Filter regions if specific region requested
    const regionsToFetch = region ? [region as string] : allRegions;

    // Fetch both current tariff AND history (to get triggered_by info) for each region
    const tariffPromises = regionsToFetch.map(async (r) => {
      try {
        const [currentTariff, historyResponse] = await Promise.all([
          tariffClient.getCurrentTariff(r),
          tariffClient.getTariffHistory(r, 1) // Get latest history entry
        ]);

        // Use history data for triggered_by info if available
        const latestHistory = historyResponse.data[0];
        if (latestHistory) {
          return {
            ...currentTariff,
            triggered_by: latestHistory.triggered_by,
            reason: latestHistory.reason,
          };
        }
        return currentTariff;
      } catch (error) {
        // Region might not have tariff data yet, skip it
        return null;
      }
    });

    const tariffResults = await Promise.all(tariffPromises);
    const filteredTariffs = tariffResults.filter((t): t is TariffData => t !== null);

    if (filteredTariffs.length === 0)
      return successResponse(res, 200, 'No tariff data found', { analytics: null, note: 'No tariffs match the specified criteria' });

    // Calculate analytics
    const prices = filteredTariffs.map((t) => t.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);

    // Count override vs automatic tariffs (check if triggered_by looks like a UUID or is "automatic")
    const overrideCount = filteredTariffs.filter((t) =>
      t.triggered_by !== 'automatic' && t.triggered_by !== 'AUTOMATIC'
    ).length;
    const automaticCount = filteredTariffs.length - overrideCount;

    // Tier distribution
    const tierDistribution = filteredTariffs.reduce((acc, tariff) => {
      const tier = tariff.tier || 'unknown';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Region-wise breakdown
    const regionBreakdown = filteredTariffs.map((tariff) => ({
      region: tariff.region, price: tariff.price,
      tier: tariff.tier, load_percentage: tariff.load_percentage,
      triggered_by: tariff.triggered_by, effective_from: tariff.effective_from,
      is_override: tariff.triggered_by !== 'automatic' && tariff.triggered_by !== 'AUTOMATIC',
      reason: tariff.reason
    }));

    successResponse(res, 200, 'Tariff analytics retrieved successfully', {
      filters: {
        start: start || null,
        end: end || null,
        region: region || 'all',
      },
      summary: {
        total_regions: filteredTariffs.length,
        avg_price: parseFloat(avgPrice.toFixed(2)),
        max_price: parseFloat(maxPrice.toFixed(2)),
        min_price: parseFloat(minPrice.toFixed(2)),
        price_range: parseFloat((maxPrice - minPrice).toFixed(2)),
        override_count: overrideCount, automatic_count: automaticCount,
        override_percentage: parseFloat(((overrideCount / filteredTariffs.length) * 100).toFixed(1)),
      },
      tier_distribution: tierDistribution, region_breakdown: regionBreakdown,
      note: start || end ? 'Historical analytics not yet implemented. Showing current state only.' : null
    });
  }
);
