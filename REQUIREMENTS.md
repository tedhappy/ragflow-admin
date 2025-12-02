# RAGFlow Admin - 需求文档

## 项目概述

基于 RAGFlow 的后台管理系统，通过 RAGFlow API 实现用户、知识库、对话、智能体的批量管理与服务监控。

## 核心需求

### 1. 项目定位

- 与 RAGFlow 官方源码**完全独立**
- 通过 **Python SDK**（优先）和 **HTTP API** 与 RAGFlow 交互
- 作为**独立项目**上传到 GitHub
- 前后端技术栈与 RAGFlow **保持一致**

### 2. 功能模块

| 模块 | 功能描述 | API来源 |
|------|----------|---------|
| 数据集管理 | 数据集CRUD、文档管理、解析状态、分块查看 | Python SDK |
| 聊天管理 | 聊天助手列表、会话历史、对话记录 | Python SDK |
| 智能体管理 | Agent列表、会话管理、批量操作 | Python SDK |
| 服务监控 | 健康检查、使用统计 | HTTP API |

### 3. 技术架构

#### 后端 (与RAGFlow风格一致)

- **框架**: Quart (异步Flask)
- **路由**: Blueprint模式
- **API文档**: Flasgger (Swagger)
- **SDK调用**: ragflow-sdk

#### 前端 (与RAGFlow风格一致)

- **框架**: React 18 + UmiJS 4
- **UI组件**: Ant Design 5 + Radix UI
- **样式**: TailwindCSS 3 (复用RAGFlow配色)
- **状态管理**: Zustand + React Query
- **国际化**: i18next
- **图标**: Lucide React

### 4. 配置管理

配置文件位于 `conf/config.yaml`，包含：

- RAGFlow 服务地址 (base_url)
- RAGFlow API Key (api_key)
- 管理后台端口和设置
- 管理员账号配置

### 5. RAGFlow API 模块

#### Python SDK (优先使用)

`python
from ragflow_sdk import RAGFlow

rag = RAGFlow(api_key="xxx", base_url="http://localhost:9380")

# 数据集管理
datasets = rag.list_datasets()
dataset = rag.create_dataset(name="test")

# 聊天助手管理
chats = rag.list_chats()

# Agent管理
agents = rag.list_agents()
`

#### HTTP API (备用)

| 模块 | 端点 |
|------|------|
| Dataset Management | /api/v1/datasets |
| File Management | /api/v1/datasets/{id}/documents |
| Chunk Management | /api/v1/datasets/{id}/chunks |
| Chat Management | /api/v1/chats |
| Session Management | /api/v1/sessions |
| Agent Management | /api/v1/agents |

## 项目信息

- **GitHub**: https://github.com/tedhappy/ragflow-admin
- **基于RAGFlow版本**: v0.22.1
