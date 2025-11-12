/**
 * Shared Constants for Smart Energy Grid System
 * 
 * This file contains all shared constants used across multiple services
 * to ensure consistency throughout the system.
 */

/**
 * Valid regions in the Smart Energy Grid System
 * Format: City-Direction
 */
export const VALID_REGIONS = [
  'Mumbai-North',
  'Mumbai-South',
  'Delhi-North',
  'Delhi-South',
  'Bangalore-East',
  'Bangalore-West',
  'Pune-East',
  'Pune-West',
  'Hyderabad-Central',
  'Chennai-North',
] as const;

/**
 * Default regions for simulator (subset of valid regions)
 */
export const DEFAULT_SIMULATOR_REGIONS = [
  'Mumbai-North',
  'Delhi-North',
  'Bangalore-East',
  'Pune-West',
];
