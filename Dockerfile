# Base stage
FROM python:3.11-slim AS base

ARG BACKEND_PORT=8080
ARG FRONTEND_PORT=8000
ARG APT_MIRROR=deb.debian.org
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG NPM_REGISTRY=https://registry.npmjs.org

WORKDIR /ragflow-admin
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    BACKEND_PORT=${BACKEND_PORT} \
    FRONTEND_PORT=${FRONTEND_PORT}

RUN sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends \
    curl netcat-openbsd procps \
    && rm -rf /var/lib/apt/lists/*

# Backend builder stage
FROM base AS backend-builder
ARG PIP_INDEX_URL=https://pypi.org/simple
WORKDIR /ragflow-admin
RUN python -m venv .venv
COPY requirements.txt ./
RUN .venv/bin/pip install --no-cache-dir -i ${PIP_INDEX_URL} -r requirements.txt

# Frontend builder stage
FROM node:20-slim AS frontend-builder
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /ragflow-admin/web
RUN npm config set registry ${NPM_REGISTRY}
COPY web/package*.json ./
RUN npm ci --legacy-peer-deps
COPY web/ ./
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /ragflow-admin

COPY --from=backend-builder /ragflow-admin/.venv ./.venv
COPY api/ ./api/
COPY conf/ ./conf/
COPY requirements.txt ./
COPY --from=frontend-builder /ragflow-admin/web/dist ./web/dist
COPY docker/entrypoint.sh ./entrypoint.sh
COPY docker/spa_server.py ./spa_server.py
RUN chmod +x ./entrypoint.sh

ENV PYTHONPATH=/ragflow-admin \
    PATH="/ragflow-admin/.venv/bin:$PATH"

EXPOSE ${BACKEND_PORT} ${FRONTEND_PORT}

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${BACKEND_PORT}/api/v1/system/monitoring/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
