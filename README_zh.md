<div align="center">
<a href="https://github.com/infiniflow/ragflow">
<img src="web/public/logo.svg" width="120" alt="RAGFlow logo">
</a>
<h1>RAGFlow Admin</h1>
</div>

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README_zh.md">简体中文</a>
</p>

<p align="center">
    <a href="https://github.com/tedhappy/ragflow-admin/releases/latest">
        <img src="https://img.shields.io/github/v/release/tedhappy/ragflow-admin?color=blue&label=Latest%20Release" alt="Latest Release">
    </a>
    <a href="https://github.com/infiniflow/ragflow">
        <img src="https://img.shields.io/badge/RAGFlow-v0.15+-blue" alt="RAGFlow Version">
    </a>
    <a href="https://github.com/tedhappy/ragflow-admin/blob/main/LICENSE">
        <img src="https://img.shields.io/badge/License-Apache%202.0-green" alt="License">
    </a>
</p>

<p align="center">
RAGFlow 独立后台管理系统
</p>

---

## 🔎 概述

**RAGFlow Admin** 是一个轻量级、独立的 [RAGFlow](https://github.com/infiniflow/ragflow) 后台管理控制台。RAGFlow 是领先的开源 RAG 引擎，具有深度文档理解能力。本项目为其提供现代化的 Web 管理界面，实现知识库、文档、聊天助手、智能体和用户的集中管理。

### 为什么需要 RAGFlow Admin？

RAGFlow 是强大的 RAG 引擎，但其内置管理界面在生产环境中存在一些局限：

| 痛点 | RAGFlow Admin 解决方案 |
|------|------------------------|
| **单知识库视图** | 跨知识库仪表板，统一管理所有数据 |
| **无批量操作** | 支持批量上传、解析、停止、删除文档 |
| **任务队列隐藏** | 实时任务监控，显示队列位置和进度 |
| **用户管理复杂** | 集中式用户管理面板，含统计数据 |
| **运维洞察有限** | 仪表板展示服务健康状态和使用指标 |
| **学习曲线陡峭** | 为管理员设计的直观界面 |

## ✨ 功能特性

### 核心管理
| 功能 | 描述 |
|------|------|
| **📚 知识库管理** | 跨用户查看所有知识库，支持创建、删除和批量操作 |
| **📄 文档管理** | 上传、解析、停止、删除文档，实时进度跟踪 |
| **📊 任务队列** | 全局任务监控，显示队列位置，支持筛选和批量控制 |

### 扩展能力
| 功能 | 描述 |
|------|------|
| **💬 聊天管理** | 查看和管理聊天助手及会话记录 |
| **🤖 智能体管理** | 跨用户查看和管理 AI 智能体 |
| **👥 用户管理** | 查看 RAGFlow 用户及统计数据（需要 MySQL 访问权限）|
| **🔍 系统监控** | 仪表板展示服务健康检查和使用统计 |
| **🌐 国际化** | 完整的中英文支持 |

## 🖼️ 界面截图

### 仪表板
<p align="center">
  <img src="docs/images/dashboard.jpg" width="800" alt="Dashboard"/>
</p>

### 任务队列
<p align="center">
  <img src="docs/images/tasks.jpg" width="800" alt="Task Queue"/>
</p>

### 知识库管理
<p align="center">
  <img src="docs/images/datasets.jpg" width="800" alt="Datasets"/>
</p>

### 文档管理
<p align="center">
  <img src="docs/images/documents.jpg" width="800" alt="Documents"/>
</p>

### 聊天管理
<p align="center">
  <img src="docs/images/chats.jpg" width="800" alt="Chats"/>
</p>

### 用户管理
<p align="center">
  <img src="docs/images/users.png" width="800" alt="Users"/>
</p>

### 系统设置
<p align="center">
  <img src="docs/images/settings.jpg" width="800" alt="Settings"/>
</p>

## 🚀 快速开始

### 环境要求

- 运行中的 RAGFlow 实例（v0.15+）
- Docker 20.10+ & Docker Compose 2.0+（Docker 部署）
- Python 3.10+ & Node.js 18+（源码部署）

### 🐳 Docker 部署（推荐）

```bash
$ git clone https://github.com/tedhappy/ragflow-admin.git
$ cd ragflow-admin/docker
$ docker compose -f docker-compose.yml up -d
```

查看服务状态：
```bash
$ docker logs -f ragflow-admin
```

访问 http://localhost:8000，使用 `admin/admin` 登录，通过 **Settings** 页面配置 MySQL。

> 详细配置请参阅 [docker/README.md](docker/README.md)

### 🔧 源码部署（开发环境）

#### 1. 克隆并配置

```bash
$ git clone https://github.com/tedhappy/ragflow-admin.git
$ cd ragflow-admin
$ cp conf/config.example.yaml conf/config.yaml
```

#### 2. 启动后端

```bash
$ pip install -r requirements.txt
$ python -m api.server
```

#### 3. 启动前端

```bash
$ cd web
$ npm install
$ npm run dev
```

访问 http://localhost:8000 进入管理控制台。

## 🏗️ 项目结构

```
ragflow-admin/
├── api/                        # 后端 (Python/Quart)
│   ├── apps/                   # API 路由处理
│   ├── services/               # 业务逻辑
│   └── server.py               # 应用入口
│
├── web/                        # 前端 (React/UmiJS)
│   └── src/
│       ├── pages/              # 页面组件
│       ├── components/         # 可复用 UI 组件
│       ├── services/           # API 客户端
│       └── locales/            # 国际化翻译
│
├── docker/                     # Docker 配置
│   ├── docker-compose.yml      # Docker Compose 文件
│   ├── .env                    # 环境变量
│   ├── entrypoint.sh           # 容器入口脚本
│   ├── spa_server.py           # 前端 SPA 服务
│   └── README.md               # Docker 部署指南
│
├── conf/                       # 配置文件
├── Dockerfile                  # Docker 构建文件
│
└── docs/                       # 文档
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Python 3.10+ / Quart |
| **RAGFlow 集成** | ragflow-sdk |
| **前端** | React 18 / UmiJS 4 / TypeScript |
| **UI 组件** | Ant Design 5 |
| **样式** | TailwindCSS 4 |
| **状态管理** | React Query / Zustand |
| **国际化** | i18next |
| **数据库** | MySQL |

## 🤝 贡献指南

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送分支（`git push origin feature/AmazingFeature`）
5. 发起 Pull Request

##  相关链接

- [RAGFlow](https://github.com/infiniflow/ragflow) - 本项目管理的 RAG 引擎
- [RAGFlow 文档](https://ragflow.io/docs/dev/)
- [RAGFlow Python SDK](https://ragflow.io/docs/dev/python_api_reference)
- [RAGFlow HTTP API](https://ragflow.io/docs/dev/http_api_reference)

## 📄 开源协议

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

---

<p align="center">
如果觉得这个项目对你有帮助，请给一个 ⭐️ 支持一下！
</p>
