/**
 * Shared utility functions for the SEGS system
 */

// Logger utility
export const logger = {
  info: (service: string, message: string) => {
    console.log(`[${new Date().toISOString()}] [${service}] INFO: ${message}`);
  },
  error: (service: string, message: string, error?: Error) => {
    console.error(`[${new Date().toISOString()}] [${service}] ERROR: ${message}`, error);
  },
  warn: (service: string, message: string) => {
    console.warn(`[${new Date().toISOString()}] [${service}] WARN: ${message}`);
  },
  debug: (service: string, message: string) => {
    console.debug(`[${new Date().toISOString()}] [${service}] DEBUG: ${message}`);
  },
};

// Validation helpers
export const validate = {
  isNotEmpty: (value: string): boolean => value.trim().length > 0,
  isValidEmail: (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isPositiveNumber: (num: number): boolean => num > 0,
};

// Date/Time utilities
export const dateUtils = {
  now: (): Date => new Date(),
  timestamp: (): number => Date.now(),
  formatISO: (date: Date): string => date.toISOString(),
};

console.log('🛠️  [UTILS] Utility functions loaded');
