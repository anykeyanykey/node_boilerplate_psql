# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.21.0
ARG ALPINE_VERSION=3.24

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---------- build ----------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
    && npm prune --omit=dev

# ---------- prod deps (standalone) ----------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    LOG_TO_STDOUT=true \
    PM2_HOME=/tmp/.pm2
WORKDIR /app

RUN apk add --no-cache tini \
    && addgroup -S app && adduser -S -G app -u 10001 app \
    && mkdir -p /tmp/.pm2 logs \
    && chown -R app:app /tmp/.pm2 logs

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ecosystem.config.cjs ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pm2-runtime", "ecosystem.config.cjs"]
