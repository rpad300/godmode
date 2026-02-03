# =============================================================================
# GodMode - Dockerfile
# =============================================================================
# Multi-stage build for production deployment
# 
# Build: docker build -t godmode .
# Run:   docker run -p 3005:3005 -v ./data:/app/data godmode
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build frontend
RUN npm run build:frontend

# Remove dev dependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:18-alpine AS production

# Labels
LABEL maintainer="Paulo Dias"
LABEL description="GodMode - AI-Powered Document Processing"
LABEL version="1.0.0"

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S godmode && \
    adduser -S godmode -u 1001 -G godmode

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

# Create data directory
RUN mkdir -p /app/data && chown -R godmode:godmode /app

# Switch to non-root user
USER godmode

# Environment
ENV NODE_ENV=production
ENV PORT=3005

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3005/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "src/server.js"]
