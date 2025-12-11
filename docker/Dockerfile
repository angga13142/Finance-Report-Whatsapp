# ============================================
# Production Dockerfile for WhatsApp Cashflow Bot
# ============================================
# Multi-stage build optimized for production deployment
# Node.js 20 LTS, Alpine Linux, non-root user, health checks

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies (production only)
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Install dev dependencies for build
RUN npm ci

# Copy source code and configuration
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Create directories for WhatsApp session and logs with proper permissions (UID 1000, GID 1000, mode 755)
RUN mkdir -p .wwebjs_auth logs && \
    chmod 755 .wwebjs_auth logs && \
    chown -R nodejs:nodejs .wwebjs_auth logs

# Create non-root user for security (UID 1000, GID 1000 per requirements)
RUN addgroup -g 1000 -S nodejs && \
    adduser -S nodejs -u 1000 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-3000}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose application port
EXPOSE 3000

# Volume for persistent WhatsApp session
VOLUME ["/app/.wwebjs_auth", "/app/logs"]

# Use dumb-init for proper signal handling (SIGTERM, SIGINT)
ENTRYPOINT ["dumb-init", "--"]

# Run migrations and start application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

# ============================================
# Build Arguments and Labels
# ============================================
ARG BUILD_DATE
ARG VERSION=1.0.0
ARG VCS_REF

LABEL org.opencontainers.image.title="WhatsApp Cashflow Bot" \
      org.opencontainers.image.description="Financial transaction reporting chatbot for WhatsApp" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Finance Report" \
      org.opencontainers.image.licenses="MIT"
