#!/usr/bin/env bash
set -e

WORKDIR=${WORKDIR:-/ragflow-admin}
PY=${WORKDIR}/.venv/bin/python

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------
function start_backend() {
    echo "Starting backend server..."
    while true; do
        $PY -m api.server &
        wait
        sleep 1
    done
}

function start_frontend() {
    echo "Starting frontend server..."
    while true; do
        $PY ${WORKDIR}/spa_server.py &
        wait
        sleep 1
    done
}

function generate_config() {
    local config_file="${WORKDIR}/conf/config.yaml"
    if [ ! -f "$config_file" ] || [ "${FORCE_CONFIG:-false}" = "true" ]; then
        echo "Generating config.yaml..."
        cat > ${config_file} << EOF
server:
  host: "0.0.0.0"
  port: ${BACKEND_PORT:-8080}
  debug: ${DEBUG:-false}
  secret_key: "${SECRET_KEY:-ragflow-admin-secret-key}"
admin:
  username: "${ADMIN_USERNAME:-admin}"
  password: "${ADMIN_PASSWORD:-admin}"
mysql:
  host: "${MYSQL_HOST:-}"
  port: ${MYSQL_PORT:-5455}
  database: "${MYSQL_DATABASE:-rag_flow}"
  user: "${MYSQL_USER:-}"
  password: "${MYSQL_PASSWORD:-}"
ragflow:
  base_url: "${RAGFLOW_BASE_URL:-}"
  api_key: "${RAGFLOW_API_KEY:-}"
EOF
    fi
}

function wait_for_mysql() {
    if [ -n "$MYSQL_HOST" ]; then
        echo "Waiting for MySQL at ${MYSQL_HOST}:${MYSQL_PORT:-5455}..."
        for i in {1..30}; do
            nc -z "$MYSQL_HOST" "${MYSQL_PORT:-5455}" 2>/dev/null && return 0
            sleep 2
        done
        echo "Warning: MySQL connection timeout"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
[ -n "$TIMEZONE" ] && ln -snf /usr/share/zoneinfo/$TIMEZONE /etc/localtime

generate_config
wait_for_mysql

echo "=========================================="
echo "  RAGFlow Admin - Starting Services"
echo "=========================================="
echo "  Backend:  http://0.0.0.0:${BACKEND_PORT:-8080}"
echo "  Frontend: http://0.0.0.0:${FRONTEND_PORT:-8000}"
echo "=========================================="

start_backend &
start_frontend &

wait
