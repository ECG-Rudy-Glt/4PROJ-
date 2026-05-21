# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:5001
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Runtime (hardened) ───────────────────────────────────────────────
# nginx-unprivileged runs as non-root (uid 101) - fixes CIS DI-0008 / Semgrep missing-user
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Déclaration explicite du user non-root (nginx-unprivileged le définit dans son image de base)
# Nécessaire pour que les outils d'analyse statique (Semgrep, Dockle) le détectent
USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
