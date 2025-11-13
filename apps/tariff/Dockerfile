# Multi-stage Dockerfile for Tariff Service
# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for all workspaces
COPY apps/tariff/package.json ./apps/tariff/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/tariff ./apps/tariff
COPY packages/shared-types ./packages/shared-types
COPY packages/utils ./packages/utils

# Build the application
RUN pnpm --filter tariff build

# Stage 2: Production
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files
COPY apps/tariff/package.json ./apps/tariff/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts from builder
COPY --from=builder /app/apps/tariff/dist ./apps/tariff/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist


# Set environment variables
ENV NODE_ENV=production \
    PORT=3003

# Expose API port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the service
CMD ["node", "apps/tariff/dist/index.js"]
