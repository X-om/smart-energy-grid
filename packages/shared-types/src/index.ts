/**
 * Shared TypeScript types and interfaces for the SEGS system
 */

// Placeholder types - to be expanded during implementation
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnergyReading extends BaseEntity {
  meterId: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface Alert extends BaseEntity {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface TariffPlan extends BaseEntity {
  name: string;
  ratePerKwh: number;
  currency: string;
}

console.log('📦 [SHARED-TYPES] Type definitions loaded');
