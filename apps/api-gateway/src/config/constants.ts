export const REGIONS = ['north', 'south', 'east', 'west', 'central'] as const;
export type Region = typeof REGIONS[number];

export const USER_ROLES = ['user', 'operator', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const METER_STATUS = ['active', 'inactive', 'maintenance', 'faulty', 'decommissioned'] as const;
export type MeterStatus = typeof METER_STATUS[number];

export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type AlertSeverity = typeof ALERT_SEVERITIES[number];

export const ALERT_STATUSES = ['active', 'acknowledged', 'resolved'] as const;
export type AlertStatus = typeof ALERT_STATUSES[number];

export const ALERT_TYPES = ['high_consumption', 'zero_consumption', 'negative_consumption', 'meter_offline', 'data_anomaly', 'tariff_spike'] as const;
export type AlertType = typeof ALERT_TYPES[number];

export const INVOICE_STATUSES = ['pending', 'paid', 'overdue', 'disputed', 'cancelled'] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const CHART_RESOLUTIONS = ['1m', '15m', '1h', '1d'] as const;
export type ChartResolution = typeof CHART_RESOLUTIONS[number];

export const THEMES = ['light', 'dark', 'auto'] as const;
export type Theme = typeof THEMES[number];

export const OTP_PURPOSES = ['email_verification', 'password_reset', 'login_2fa'] as const;
export type OTPPurpose = typeof OTP_PURPOSES[number];

export const TOKEN_TYPES = ['access', 'refresh'] as const;
export type TokenType = typeof TOKEN_TYPES[number];

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_CHART_RESOLUTION: ChartResolution = '15m';
export const DEFAULT_THEME: Theme = 'light';
export const DEFAULT_TIMEZONE = 'UTC';
export const DEFAULT_LANGUAGE = 'en';

export const DEFAULT_HIGH_CONSUMPTION_THRESHOLD = 100;
export const CRITICAL_CONSUMPTION_THRESHOLD = 200;

export const ONE_MINUTE_MS = 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const API_MESSAGES = {
  SUCCESS: 'Operation successful',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTER_SUCCESS: 'Registration successful. Please verify your email.',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  PASSWORD_RESET: 'Password reset successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  PREFERENCES_UPDATED: 'Preferences updated successfully',

  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden - Insufficient permissions',
  NOT_FOUND: 'Resource not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Email not verified. Please check your inbox.',
  ACCOUNT_SUSPENDED: 'Account has been suspended',
  INVALID_OTP: 'Invalid or expired OTP',
  INVALID_TOKEN: 'Invalid or expired token',
  TOKEN_BLACKLISTED: 'Token has been revoked',
  EMAIL_EXISTS: 'Email already registered',
  METER_ASSIGNED: 'Meter already assigned to another user',
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  METER_ID: /^[A-Z0-9]{8,12}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR'
} as const;
