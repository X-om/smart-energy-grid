// Helper to parse PostgreSQL connection URL
const parsePostgresUrl = (urlOrHost: string | undefined, defaultValues: { host: string; port: number; user: string; password: string; database: string }) => {
  if (!urlOrHost || !urlOrHost.includes('://')) {
    return {
      host: process.env.POSTGRES_HOST || defaultValues.host,
      port: parseInt(process.env.POSTGRES_PORT || String(defaultValues.port), 10),
      user: process.env.POSTGRES_USER || defaultValues.user,
      password: process.env.POSTGRES_PASSWORD || defaultValues.password,
      database: process.env.POSTGRES_DB || defaultValues.database,
    };
  }

  // Parse URL: postgresql://user:password@host:port/database
  const url = new URL(urlOrHost);
  return {
    host: url.hostname,
    port: parseInt(url.port || String(defaultValues.port), 10),
    user: url.username || defaultValues.user,
    password: url.password || defaultValues.password,
    database: url.pathname.slice(1) || defaultValues.database,
  };
};

// Helper to parse Redis connection URL
const parseRedisUrl = (urlOrHost: string | undefined) => {
  if (!urlOrHost || !urlOrHost.includes('://')) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
  }

  // Parse URL: redis://host:port
  const url = new URL(urlOrHost);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
  };
};

const postgresConfig = parsePostgresUrl(process.env.POSTGRES_URL, {
  host: 'localhost',
  port: 5432,
  user: 'segs_user',
  password: 'segs_password',
  database: 'segs_db',
});

const timescaleConfig = parsePostgresUrl(process.env.TIMESCALE_URL, {
  host: 'localhost',
  port: 5433,
  user: 'segs_user',
  password: 'segs_password',
  database: 'segs_db',
});

const redisConfig = parseRedisUrl(process.env.REDIS_URL);

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  POSTGRES_HOST: postgresConfig.host,
  POSTGRES_PORT: postgresConfig.port,
  POSTGRES_USER: postgresConfig.user,
  POSTGRES_PASSWORD: postgresConfig.password,
  POSTGRES_DB: postgresConfig.database,

  TIMESCALE_HOST: timescaleConfig.host,
  TIMESCALE_PORT: timescaleConfig.port,
  TIMESCALE_USER: timescaleConfig.user,
  TIMESCALE_PASSWORD: timescaleConfig.password,
  TIMESCALE_DB: timescaleConfig.database,

  REDIS_HOST: redisConfig.host,
  REDIS_PORT: redisConfig.port,

  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-minimum-32-characters-long-for-security',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  SESSION_EXPIRY_DAYS: parseInt(process.env.SESSION_EXPIRY_DAYS || '7', 10),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  MASTER_OTP: process.env.MASTER_OTP || '123456',

  TARIFF_SERVICE_URL: process.env.TARIFF_SERVICE_URL || 'http://localhost:3005',
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
