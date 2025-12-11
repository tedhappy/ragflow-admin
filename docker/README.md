# Docker Deployment

This directory contains Docker configuration for RAGFlow Admin.

## 📁 Files

```
docker/
├── .env                  # Environment variables
├── docker-compose.yml    # Docker Compose configuration
├── entrypoint.sh         # Container entrypoint script
├── spa_server.py         # Frontend SPA server with API proxy
└── README.md             # This file
```

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- RAGFlow running with MySQL accessible

## Quick Start

### 1. Start Container

```bash
$ cd docker
$ docker compose -f docker-compose.yml up -d
$ docker logs -f ragflow-admin
```

### 2. Configure (via Settings Page)

1. Open http://localhost:8000
2. Login with `admin` / `admin`
3. Go to **Settings** page
4. Configure MySQL and RAGFlow API

### 3. Access

- **Frontend**: http://localhost:8000
- **Backend API**: http://localhost:8080

Default credentials:
- Username: `admin`
- Password: `admin`

## Configuration

There are two ways to configure MySQL and RAGFlow API:

### Option 1: Frontend Settings Page (Recommended)

1. Start the container without MySQL/RAGFlow configuration
2. Open http://localhost:8000 and login
3. Go to **Settings** page
4. Configure MySQL and RAGFlow API connections
5. Changes are persisted and survive container restarts

### Option 2: Environment Variables

Set values in `.env` file before starting. To force regenerate config from env:
```env
FORCE_CONFIG=true
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APT_MIRROR` | APT mirror for Docker build | `deb.debian.org` |
| `PIP_INDEX_URL` | PyPI mirror for pip | `https://pypi.org/simple` |
| `NPM_REGISTRY` | NPM registry mirror | `https://registry.npmjs.org` |
| `RAGFLOW_ADMIN_VERSION` | Docker image version | `v1.0.0` |
| `BACKEND_PORT` | Backend API port | `8080` |
| `FRONTEND_PORT` | Frontend port | `8000` |
| `HOST_PORT` | Host frontend port mapping | `8000` |
| `HOST_BACKEND_PORT` | Host backend port mapping | `8080` |
| `MYSQL_HOST` | MySQL host address | - (configure via Settings) |
| `MYSQL_PORT` | MySQL port | `5455` |
| `MYSQL_DATABASE` | Database name | `rag_flow` |
| `MYSQL_USER` | MySQL username | - (configure via Settings) |
| `MYSQL_PASSWORD` | MySQL password | - (configure via Settings) |
| `RAGFLOW_BASE_URL` | RAGFlow API URL | - |
| `RAGFLOW_API_KEY` | RAGFlow API Key | - |
| `FORCE_CONFIG` | Force regenerate config from env | `false` |
| `ADMIN_USERNAME` | Admin login username | `admin` |
| `ADMIN_PASSWORD` | Admin login password | `admin` |
| `SECRET_KEY` | Session secret key | `ragflow-admin-secret-key-change-in-production` |
| `DEBUG` | Enable debug mode | `false` |
| `TIMEZONE` | Container timezone | `Asia/Shanghai` |

## Build from Source

```bash
# From project root
$ docker build -t ragflow-admin:v1.0.0 -f Dockerfile .
```

### 🚀 China Mirror (国内加速)

For users in China, edit `.env` to use Chinese mirrors:

```env
APT_MIRROR=mirrors.aliyun.com
PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple
NPM_REGISTRY=https://registry.npmmirror.com
```

Then rebuild:
```bash
$ docker compose -f docker-compose.yml up -d --build
```

Or build directly:
```bash
$ docker build \
    --build-arg APT_MIRROR=mirrors.aliyun.com \
    --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple \
    --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
    -t ragflow-admin:v1.0.0 -f Dockerfile .
```

## Connect to RAGFlow on Same Machine

If RAGFlow is running on the same machine:

```env
MYSQL_HOST=host.docker.internal
RAGFLOW_BASE_URL=http://host.docker.internal:9380
```

Or connect to RAGFlow Docker network:

```yaml
# In docker-compose.yml, replace networks section:
networks:
  ragflow-admin:
    external: true
    name: docker_ragflow  # RAGFlow's network name
```

## Connect to RAGFlow on Another Machine (LAN)

If RAGFlow is running on another machine in your local network:

```
┌─────────────────┐         ┌─────────────────┐
│  This Machine   │         │  RAGFlow Server │
│  RAGFlow Admin  │ ──────► │  192.168.1.100  │
└─────────────────┘   LAN   └─────────────────┘
```

### Option 1: Configure via Settings Page

1. Start container: `docker compose -f docker-compose.yml up -d`
2. Open http://localhost:8000 and login
3. Go to **Settings** page
4. Set MySQL Host to RAGFlow server IP (e.g., `192.168.1.100`)
5. Set RAGFlow URL (e.g., `http://192.168.1.100:9380`)

### Option 2: Configure via .env

```env
MYSQL_HOST=192.168.1.100
MYSQL_PORT=5455
MYSQL_DATABASE=rag_flow
MYSQL_USER=root
MYSQL_PASSWORD=infini_rag_flow

RAGFLOW_BASE_URL=http://192.168.1.100:9380
RAGFLOW_API_KEY=your-api-key

FORCE_CONFIG=true
```

### Requirements

- RAGFlow server firewall allows ports `5455` (MySQL) and `9380` (API)
- RAGFlow MySQL allows remote connections
- Both machines can reach each other on the network

## Troubleshooting

### Cannot connect to MySQL

1. Ensure RAGFlow MySQL is running
2. Check MySQL credentials in `.env`
3. If using Docker Desktop, use `host.docker.internal` as host
4. If using Linux, add `extra_hosts` or use actual IP address

### Port conflicts

Change `HOST_PORT` in `.env`:

```env
HOST_PORT=8001
```

### View logs

```bash
$ docker logs -f ragflow-admin
```

### Rebuild after code changes

```bash
$ docker compose -f docker-compose.yml up -d --build --force-recreate
```
