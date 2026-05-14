# =====================================================
# Stage 1: Build del frontend (Vite → dist/)
# =====================================================
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# =====================================================
# Stage 2: Backend Node + frontend estático
# =====================================================
FROM node:20-alpine
WORKDIR /app

# Tini para signal handling correcto (SIGTERM en Railway/Render → graceful shutdown)
RUN apk add --no-cache tini

# Backend deps (production only)
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Backend source
COPY backend/src/ ./src/

# Frontend ya buildeado — Express lo sirve estático en /
# (incluye manifest.webmanifest, sw.js, icons/, assets/)
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Tini como PID 1 para forwarding correcto de señales
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
