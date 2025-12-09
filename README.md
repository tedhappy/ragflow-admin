# RAGFlow Admin

 A standalone admin console for RAGFlow

[![RAGFlow](https://img.shields.io/badge/RAGFlow-v0.22.1-blue)](https://github.com/infiniflow/ragflow)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](LICENSE)

## 简介

RAGFlow Admin 是一个独立的 RAGFlow 后台管理系统。通过调用 RAGFlow Python SDK / HTTP API，实现对用户、知识库、聊天对话、智能体的批量管理操作，并提供服务健康监控与数据统计功能。

**English:** A standalone administration system for RAGFlow. Provides batch management for users, knowledge bases, chat sessions, and agents through RAGFlow Python SDK / HTTP API. Features service health monitoring and usage statistics.

## 功能特性

- **数据集管理** - 批量创建、删除、更新知识库，文档上传与解析状态监控
- **聊天管理** - 聊天助手列表，会话历史查看，对话记录管理
- **智能体管理** - Agent列表，会话管理，批量操作
- **服务监控** - RAGFlow服务健康检查，使用统计

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Quart (异步Flask) |
| API调用 | ragflow-sdk |
| 前端框架 | React 18 + UmiJS 4 |
| UI组件 | Ant Design 5 + Radix UI |
| 样式 | TailwindCSS 3 |
| 状态管理 | Zustand + React Query |

## 快速开始

### 1. 配置

复制配置文件并修改：
```bash
cp conf/config.example.yaml conf/config.yaml
```
编辑 `conf/config.yaml`，填入你的 RAGFlow 地址和 API Key：
```yaml
ragflow:
  base_url: "http://your-ragflow-host:9380"
  api_key: "your-api-key-here"
```

### 2. 启动后端

```bash
cd ragflow-admin
pip install -r requirements.txt
python -m api.server
```

### 3. 启动前端

```bash
cd ragflow-admin/web
npm install
npm run dev
```

## 项目结构

```
ragflow-admin/
├── api/                    # Backend (Quart)
│   ├── apps/               # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Utilities
│   └── server.py           # Entry point
├── web/                    # Frontend (React + UmiJS)
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Shared components
│       ├── hooks/          # Custom hooks
│       ├── services/       # API client
│       └── locales/        # i18n translations
├── conf/                   # Configuration files
└── requirements.txt
```

## 相关链接

- [RAGFlow 官方仓库](https://github.com/infiniflow/ragflow)
- [RAGFlow Python API](https://ragflow.io/docs/dev/python_api_reference)
- [RAGFlow HTTP API](https://ragflow.io/docs/dev/http_api_reference)

## License

Apache License 2.0
