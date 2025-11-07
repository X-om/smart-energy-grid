# Multi-stage Dockerfile for Ingestion Service
# Optimized for production deployment

# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy shared packages
COPY packages ./packages

# Copy ingestion service
COPY apps/ingestion ./apps/ingestion

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter @segs/shared-types build
RUN pnpm --filter @segs/utils build

# Build ingestion service
RUN pnpm --filter @segs/ingestion build

# Stage 2: Production
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./

# Copy built artifacts
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/ingestion/dist ./apps/ingestion/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/ingestion/package.json ./apps/ingestion/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set working directory to service
WORKDIR /app/apps/ingestion

# Start the service
CMD ["node", "dist/index.js"]
