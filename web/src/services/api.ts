//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import axios from 'axios';

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// Response interceptor
request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (data.code === 0) {
      return data.data;
    }
    return Promise.reject(new Error(data.message || 'Request failed'));
  },
  (error) => {
    return Promise.reject(error);
  }
);

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// Dataset API
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  chunk_count?: number;
  document_count?: number;
  create_time?: string;
  update_time?: string;
}

export const datasetApi = {
  list: (params?: PaginationParams & { name?: string }) =>
    request.get<any, ListResponse<Dataset>>('/datasets', { params }),
  
  create: (data: { name: string; description?: string }) =>
    request.post<any, Dataset>('/datasets', data),
  
  batchDelete: (ids: string[]) =>
    request.post('/datasets/batch-delete', { ids }),
};

// Chat API
export interface Chat {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  create_time?: string;
  update_time?: string;
  dataset_ids?: string[];
}

export const chatApi = {
  list: (params?: PaginationParams & { name?: string }) =>
    request.get<any, ListResponse<Chat>>('/chats', { params }),
  
  batchDelete: (ids: string[]) =>
    request.post('/chats/batch-delete', { ids }),
};

// Agent API
export interface Agent {
  id: string;
  title: string;
  description?: string;
  avatar?: string;
  create_time?: string;
  update_time?: string;
}

export const agentApi = {
  list: (params?: PaginationParams & { title?: string }) =>
    request.get<any, ListResponse<Agent>>('/agents', { params }),
};

// Dashboard API
export interface DashboardStats {
  dataset_count: number;
  document_count: number;
  chat_count: number;
  agent_count: number;
}

export const dashboardApi = {
  getStats: () => request.get<any, DashboardStats>('/dashboard/stats'),
};

// System API
export interface SystemStatus {
  admin_version: string;
  ragflow_url: string;
  ragflow_status: 'connected' | 'disconnected' | 'error' | 'timeout' | 'unknown';
  ragflow_version: string | null;
  api_key_masked: string;
  server_port: number;
  debug: boolean;
  error_message: string | null;
}

export const systemApi = {
  getStatus: () => request.get<any, SystemStatus>('/system/status'),
  checkHealth: () => request.get<any, { status: string }>('/system/health'),
};

export default request;
