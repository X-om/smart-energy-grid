export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  // PostgreSQL (User data)
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  POSTGRES_USER: process.env.POSTGRES_USER || 'segs_user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'segs_password',
  POSTGRES_DB: process.env.POSTGRES_DB || 'segs_db',

  // TimescaleDB (Telemetry data)
  TIMESCALE_HOST: process.env.TIMESCALE_HOST || 'localhost',
  TIMESCALE_PORT: parseInt(process.env.TIMESCALE_PORT || '5433', 10),
  TIMESCALE_USER: process.env.TIMESCALE_USER || 'segs_user',
  TIMESCALE_PASSWORD: process.env.TIMESCALE_PASSWORD || 'segs_password',
  TIMESCALE_DB: process.env.TIMESCALE_DB || 'segs_db',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'segs-jwt-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // OTP
  MASTER_OTP: process.env.MASTER_OTP || '123456',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
} as const;
