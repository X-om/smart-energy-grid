export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  POSTGRES_USER: process.env.POSTGRES_USER || 'segs_user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'segs_password',
  POSTGRES_DB: process.env.POSTGRES_DB || 'segs_db',

  TIMESCALE_HOST: process.env.TIMESCALE_HOST || 'localhost',
  TIMESCALE_PORT: parseInt(process.env.TIMESCALE_PORT || '5433', 10),
  TIMESCALE_USER: process.env.TIMESCALE_USER || 'segs_user',
  TIMESCALE_PASSWORD: process.env.TIMESCALE_PASSWORD || 'segs_password',
  TIMESCALE_DB: process.env.TIMESCALE_DB || 'segs_db',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),

  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-minimum-32-characters-long-for-security',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  SESSION_EXPIRY_DAYS: parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  MASTER_OTP: process.env.MASTER_OTP || '123456',

  TARIFF_SERVICE_URL: process.env.TARIFF_SERVICE_URL || 'http://localhost:3003',
  ALERT_SERVICE_URL: process.env.ALERT_SERVICE_URL || 'http://localhost:3004',
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',

  EMAIL_SERVICE_ENABLED: process.env.EMAIL_SERVICE_ENABLED === 'true',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.example.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@segs.com',

  ENABLE_BILLING: process.env.ENABLE_BILLING === 'true',
  ENABLE_AUDIT_LOGS: process.env.ENABLE_AUDIT_LOGS !== 'false',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;
