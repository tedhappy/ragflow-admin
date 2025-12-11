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
A standalone administration console for RAGFlow
</p>

---

## 🔎 Overview

**RAGFlow Admin** is a lightweight, standalone administration console for [RAGFlow](https://github.com/infiniflow/ragflow) — the leading open-source RAG engine with deep document understanding. It provides a modern web interface for centralized management of datasets, documents, chat assistants, agents, and users.

### Why RAGFlow Admin?

RAGFlow is a powerful RAG engine, but its built-in management interface has some limitations for production use:

| Pain Point | RAGFlow Admin Solution |
|------------|------------------------|
| **Single dataset view** | Cross-dataset dashboard for unified management |
| **No batch operations** | Bulk upload, parse, stop, and delete across datasets |
| **Hidden task queue** | Real-time task monitoring with queue position and progress |
| **Complex user management** | Centralized user admin panel with statistics |
| **Limited operational insight** | Dashboard with health checks and usage metrics |
| **Steep learning curve** | Intuitive UI designed for administrators |

## ✨ Features

### Core Management
| Feature | Description |
|---------|-------------|
| **📚 Dataset Management** | View all datasets across users, create, delete with batch operations |
| **📄 Document Management** | Upload, parse, stop, delete documents with real-time progress tracking |
| **📊 Task Queue** | Global task monitoring across all datasets with queue position, filtering and batch control |

### Extended Capabilities  
| Feature | Description |
|---------|-------------|
| **💬 Chat Management** | View and manage chat assistants and conversation sessions |
| **🤖 Agent Management** | List and manage AI agents across users |
| **👥 User Management** | View RAGFlow users with statistics (requires MySQL access) |
| **🔍 System Monitoring** | Dashboard with service health checks and usage statistics |
| **🌐 i18n Support** | Full internationalization (English & Chinese) |

## 🖼️ Screenshots

### Dashboard
<p align="center">
  <img src="docs/images/dashboard.jpg" width="800" alt="Dashboard"/>
</p>

### Task Queue
<p align="center">
  <img src="docs/images/tasks.jpg" width="800" alt="Task Queue"/>
</p>

### Dataset Management
<p align="center">
  <img src="docs/images/datasets.jpg" width="800" alt="Datasets"/>
</p>

### Document Management
<p align="center">
  <img src="docs/images/documents.jpg" width="800" alt="Documents"/>
</p>

### Chat Management
<p align="center">
  <img src="docs/images/chats.jpg" width="800" alt="Chats"/>
</p>

### User Management
<p align="center">
  <img src="docs/images/users.png" width="800" alt="Users"/>
</p>

### Settings
<p align="center">
  <img src="docs/images/settings.jpg" width="800" alt="Settings"/>
</p>

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A running RAGFlow instance (v0.15+)
- RAGFlow API Key ([How to get](https://ragflow.io/docs/dev/acquire_ragflow_api_key))

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/tedhappy/ragflow-admin.git
cd ragflow-admin
```

#### 2. Configure

```bash
cp conf/config.example.yaml conf/config.yaml
```

#### 3. Start Backend

```bash
pip install -r requirements.txt
python -m api.server
```

The API server will start at `http://localhost:8080`

#### 4. Start Frontend

```bash
cd web
npm install
npm run dev
```

The web UI will be available at `http://localhost:8000`

### Docker Deployment (Coming Soon)

```bash
docker-compose up -d
```

## 🏗️ Architecture

```
ragflow-admin/
├── api/                        # Backend (Python/Quart)
│   ├── apps/                   # API route handlers
│   │   ├── dataset_app.py      # Dataset endpoints
│   │   ├── document_app.py     # Document endpoints
│   │   ├── task_app.py         # Task queue endpoints
│   │   ├── chat_app.py         # Chat endpoints
│   │   ├── agent_app.py        # Agent endpoints
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── ragflow_client.py   # RAGFlow SDK wrapper
│   │   └── mysql_client.py     # MySQL operations
│   └── server.py               # Application entry point
│
├── web/                        # Frontend (React/UmiJS)
│   └── src/
│       ├── pages/              # Page components
│       ├── components/         # Reusable UI components
│       ├── services/           # API client
│       ├── hooks/              # Custom React hooks
│       └── locales/            # i18n translations (en/zh)
│
├── conf/                       # Configuration files
│   ├── config.example.yaml     # Example configuration
│   └── config.yaml             # Your configuration (gitignored)
│
└── docs/                       # Documentation
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.10+ / Quart |
| **RAGFlow Integration** | ragflow-sdk |
| **Frontend** | React 18 / UmiJS 4 / TypeScript |
| **UI Components** | Ant Design 5 |
| **Styling** | TailwindCSS 4 |
| **State Management** | React Query / Zustand |
| **i18n** | i18next |
| **Database** | MySQL |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

##  Related Links

- [RAGFlow](https://github.com/infiniflow/ragflow) - The RAG engine this project manages
- [RAGFlow Documentation](https://ragflow.io/docs/dev/)
- [RAGFlow Python SDK](https://ragflow.io/docs/dev/python_api_reference)
- [RAGFlow HTTP API](https://ragflow.io/docs/dev/http_api_reference)

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
If you find this project helpful, please consider giving it a ⭐️
</p>
