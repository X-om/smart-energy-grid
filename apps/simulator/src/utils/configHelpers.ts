import { logger } from "./logger.js";

export const parseArray = (value: string | undefined, defaultValue: Array<string>): Array<string> =>
  (!value) ? defaultValue : value.split(',').map(s => s.trim()).filter(Boolean);

export const parseInt = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const parseFloat = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean =>
  (!value) ? defaultValue : value.toLowerCase() === 'true' || value === '1';


export const validateMode = (mode: string): 'normal' | 'peak' | 'outage' => {
  if (mode === 'normal' || mode === 'peak' || mode === 'outage') return mode;
  logger.warn({ mode }, 'Invalid simulation mode, defaulting to "normal"');
  return 'normal';
}

export const validateTarget = (target: string): 'http' | 'kafka' => {
  if (target === 'http' || target === 'kafka') return target;
  logger.warn({ target }, 'Invalid target mode, defaulting to "http"');
  return 'http';
}