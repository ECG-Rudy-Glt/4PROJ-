# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate && npm run build

# ── Stage 2: Runtime (hardened) ───────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat su-exec

WORKDIR /app

# Copy only necessary artifacts from the build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/prisma      ./prisma
COPY --from=builder /app/package*.json ./

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh \
 && chown -R node:node /app \
 && mkdir -p /app/uploads/avatars /app/uploads/files /app/uploads/thumbnails \
 && chown -R node:node /app/uploads

# Run as non-root (fixes CIS Docker Benchmark DI-0008 / Semgrep missing-user)
# entrypoint.sh reçoit les droits root via docker-compose (user: root) pour
# corriger les permissions du volume uploads, puis drop sur node via su-exec
USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health',r=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"

CMD ["./entrypoint.sh"]
