# Multi-stage Dockerfile for Alert Service
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
COPY apps/alert/package.json ./apps/alert/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/alert ./apps/alert
COPY packages/shared-types ./packages/shared-types
COPY packages/utils ./packages/utils

# Build the application
RUN pnpm --filter alert build

# Stage 2: Production
FROM node:20-alpine AS production

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init wget

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files
COPY apps/alert/package.json ./apps/alert/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/apps/alert/dist ./apps/alert/dist

# Copy SQL migrations to dist folder (matching compiled __dirname path)
COPY --from=builder --chown=nodejs:nodejs /app/apps/alert/src/db/migrations ./apps/alert/dist/db/migrations

COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Create necessary directories
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose the port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3004

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "apps/alert/dist/index.js"]