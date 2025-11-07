# Multi-stage build for API Gateway Service
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy API Gateway package
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/api-gateway/tsconfig.json ./apps/api-gateway/

# Copy shared packages
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/utils/ ./packages/utils/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api-gateway/src ./apps/api-gateway/src

# Build the application
WORKDIR /app/apps/api-gateway
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package files
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist

# Set working directory
WORKDIR /app/apps/api-gateway

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { \
    r.statusCode === 200 ? process.exit(0) : process.exit(1) \
  }).on('error', () => process.exit(1))"

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/index.js"]
