# ── Stage 1: deps + build ────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies separately for better layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest and build
COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
