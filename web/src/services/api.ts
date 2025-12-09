//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import axios from 'axios';

// Auth token storage key
const TOKEN_KEY = 'ragflow_admin_token';
const CREDENTIALS_KEY = 'ragflow_admin_credentials';

// Get stored token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Set token
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

// Remove token
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Save credentials (remember password)
export const saveCredentials = (username: string, password: string): void => {
  // Base64 encode for basic obfuscation (not secure encryption, but better than plaintext)
  const encoded = btoa(JSON.stringify({ username, password }));
  localStorage.setItem(CREDENTIALS_KEY, encoded);
};

// Get saved credentials
export const getSavedCredentials = (): { username: string; password: string } | null => {
  const encoded = localStorage.getItem(CREDENTIALS_KEY);
  if (!encoded) return null;
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
};

// Clear saved credentials
export const clearCredentials = (): void => {
  localStorage.removeItem(CREDENTIALS_KEY);
};

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// Request interceptor - add auth token
request.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      removeToken();
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
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

// Dataset API (MySQL)
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  chunk_num?: number;
  doc_num?: number;
  token_num?: number;
  parser_id?: string;
  permission?: string;
  status?: string;
  create_time?: string;
  update_time?: string;
  tenant_id?: string;
  owner_email?: string;
  owner_nickname?: string;
}

export const datasetApi = {
  list: (params?: PaginationParams & { name?: string }) =>
    request.get<any, ListResponse<Dataset>>('/datasets', { params }),
  
  create: (data: { name: string; description?: string }) =>
    request.post<any, Dataset>('/datasets', data),
  
  batchDelete: (ids: string[]) =>
    request.post('/datasets/batch-delete', { ids }),
};

// Document API (within a dataset)
export interface Document {
  id: string;
  name: string;
  thumbnail?: string;
  dataset_id?: string;
  chunk_method?: string;
  source_type?: string;
  type?: string;
  created_by?: string;
  size?: number;
  token_count?: number;
  chunk_count?: number;
  progress?: number;
  progress_msg?: string;
  process_begin_at?: string;
  process_duration?: number;
  run?: 'UNSTART' | 'RUNNING' | 'CANCEL' | 'DONE' | 'FAIL';
  create_time?: string;
  update_time?: string;
}

export const documentApi = {
  list: (datasetId: string, params?: PaginationParams & { keywords?: string; run?: string }) =>
    request.get<any, ListResponse<Document>>(`/datasets/${datasetId}/documents`, { params }),
  
  batchDelete: (datasetId: string, ids: string[]) =>
    request.post(`/datasets/${datasetId}/documents/batch-delete`, { ids }),
  
  upload: (datasetId: string, formData: FormData) =>
    request.post(`/datasets/${datasetId}/documents/upload`, formData),
  
  parse: (datasetId: string, documentIds: string[]) =>
    request.post(`/datasets/${datasetId}/documents/parse`, { document_ids: documentIds }),
  
  stopParse: (datasetId: string, documentIds: string[]) =>
    request.post(`/datasets/${datasetId}/documents/stop-parse`, { document_ids: documentIds }),
};

// Chat API (MySQL)
export interface Chat {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  language?: string;
  llm_id?: string;
  status?: string;
  create_time?: string;
  update_time?: string;
  tenant_id?: string;
  owner_email?: string;
  owner_nickname?: string;
}

export const chatApi = {
  list: (params?: PaginationParams & { name?: string }) =>
    request.get<any, ListResponse<Chat>>('/chats', { params }),
  
  batchDelete: (ids: string[]) =>
    request.post('/chats/batch-delete', { ids }),
};

// Agent API (MySQL)
export interface Agent {
  id: string;
  title: string;
  description?: string;
  canvas_type?: string;
  permission?: string;
  create_time?: string;
  update_time?: string;
  user_id?: string;
  owner_email?: string;
  owner_nickname?: string;
}

export const agentApi = {
  list: (params?: PaginationParams & { title?: string }) =>
    request.get<any, ListResponse<Agent>>('/agents', { params }),
  
  batchDelete: (ids: string[]) =>
    request.post('/agents/batch-delete', { ids }),
};

// User API (RAGFlow users via MySQL)
export interface RagflowUser {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  status?: string;
  is_superuser?: boolean;
  login_channel?: string;
  create_time?: string;
  update_time?: string;
  has_token?: boolean;
}

export interface MySQLTestResult {
  connected: boolean;
  version?: string;
  database?: string;
  user_table_exists?: boolean;
  error?: string;
}

// User detail with extended info
export interface UserDetail extends RagflowUser {
  last_login_time?: string;
  language?: string;
  color_schema?: string;
  timezone?: string;
  is_anonymous?: string;
}

// User's dataset
export interface UserDataset {
  id: string;
  name: string;
  description?: string;
  chunk_num: number;
  doc_num: number;
  token_num: number;
  parser_id?: string;
  permission?: string;
  status?: string;
  create_time?: string;
  update_time?: string;
}

// User's agent
export interface UserAgent {
  id: string;
  title: string;
  description?: string;
  canvas_type?: string;
  create_time?: string;
  update_time?: string;
}

export const userApi = {
  // User CRUD
  list: (params?: PaginationParams & { email?: string; nickname?: string; status?: string }) =>
    request.get<any, ListResponse<RagflowUser>>('/users', { params }),
  get: (userId: string) =>
    request.get<any, UserDetail>(`/users/${userId}`),
  create: (data: { email: string; password: string; nickname?: string }) =>
    request.post<any, { id: string; email: string }>('/users', data),
  updateStatus: (userId: string, status: string) =>
    request.put<any, { message: string }>(`/users/${userId}/status`, { status }),
  updatePassword: (userId: string, password: string) =>
    request.put<any, { message: string }>(`/users/${userId}/password`, { password }),
  batchDelete: (ids: string[]) =>
    request.post('/users/batch-delete', { ids }),
  
  // User's resources
  getDatasets: (userId: string, params?: PaginationParams) =>
    request.get<any, ListResponse<UserDataset>>(`/users/${userId}/datasets`, { params }),
  getAgents: (userId: string, params?: PaginationParams) =>
    request.get<any, ListResponse<UserAgent>>(`/users/${userId}/agents`, { params }),
};

// Dashboard API
export interface DashboardStats {
  dataset_count: number;
  document_count: number;
  chat_count: number;
  agent_count: number;
  user_count: number;
}

export const dashboardApi = {
  getStats: () => request.get<any, DashboardStats>('/dashboard/stats'),
};

// System API (MySQL-based)
export interface SystemStatus {
  mysql_status: 'connected' | 'not_configured' | 'error' | 'unknown';
  mysql_host: string;
  mysql_database: string;
  error_message: string | null;
}

export interface SystemConfig {
  mysql_host: string;
  mysql_port: number;
  mysql_database: string;
  mysql_user: string;
  is_configured: boolean;
  server_port: number;
  debug: boolean;
}

export const systemApi = {
  // MySQL config
  getStatus: () => request.get<any, SystemStatus>('/system/status'),
  getConfig: () => request.get<any, SystemConfig>('/system/config'),
  saveConfig: (data: { host: string; port: number; database: string; user: string; password: string }) =>
    request.post<any, { message: string }>('/system/config', data),
  testConnection: (data: { host: string; port: number; database: string; user: string; password: string }) =>
    request.post<any, MySQLTestResult>('/system/config/test', data),
  
  // RAGFlow API config (for document operations)
  getRagflowConfig: () => request.get<any, RagflowConfig>('/system/ragflow/config'),
  saveRagflowConfig: (data: { base_url: string; api_key: string }) =>
    request.post<any, { message: string }>('/system/ragflow/config', data),
  testRagflowConnection: (data: { base_url: string; api_key: string }) =>
    request.post<any, RagflowTestResult>('/system/ragflow/config/test', data),
};

// RAGFlow API Config
export interface RagflowConfig {
  base_url: string;
  api_key_masked: string;
  is_configured: boolean;
}

export interface RagflowTestResult {
  connected: boolean;
  message?: string;
  error?: string;
}

// Chat Session API
export interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
}

export interface ChatSession {
  id: string;
  name: string;
  chat: string;
  messages?: ChatMessage[];
  create_time: string;
  create_date?: string;
  update_time: string;
  update_date?: string;
}

export const chatSessionApi = {
  list: (chatId: string, params?: PaginationParams) =>
    request.get<any, ListResponse<ChatSession>>(`/chats/${chatId}/sessions`, { params }),
  batchDelete: (chatId: string, ids: string[]) =>
    request.delete<any, void>(`/chats/${chatId}/sessions`, { data: { ids } }),
};

// Auth API
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  expires_in: number;
}

export interface UserInfo {
  username: string;
  role: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    request.post<any, LoginResponse>('/auth/login', data),
  logout: () =>
    request.post<any, void>('/auth/logout'),
  getCurrentUser: () =>
    request.get<any, UserInfo>('/auth/me'),
  refreshToken: () =>
    request.post<any, LoginResponse>('/auth/refresh'),
};

export default request;
