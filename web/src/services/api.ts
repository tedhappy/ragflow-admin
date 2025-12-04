//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import axios from 'axios';

// Auth token storage key
const TOKEN_KEY = 'ragflow_admin_token';
const REMEMBER_KEY = 'ragflow_admin_remember';

// Get stored token (check both localStorage and sessionStorage)
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

// Set token (localStorage for remember me, sessionStorage otherwise)
export const setToken = (token: string, remember: boolean = true): void => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_KEY, 'true');
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
};

// Remove token from both storages
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

// Check if "remember me" was selected
export const isRemembered = (): boolean => {
  return localStorage.getItem(REMEMBER_KEY) === 'true';
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
  ragflow_url: string;
  ragflow_status: 'connected' | 'disconnected' | 'error' | 'timeout' | 'unknown';
  api_key_masked: string;
  error_message: string | null;
}

export interface TestConnectionResult {
  ragflow_status: 'connected' | 'disconnected' | 'error' | 'timeout' | 'unknown';
  error_message: string | null;
}

export const systemApi = {
  getStatus: () => request.get<any, SystemStatus>('/system/status'),
  checkHealth: () => request.get<any, { status: string }>('/system/health'),
  testConnection: (data: { ragflow_url: string; api_key: string }) =>
    request.post<any, TestConnectionResult>('/system/test-connection', data),
  saveConfig: (data: { ragflow_url: string; api_key: string }) =>
    request.post<any, { message: string }>('/system/config', data),
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
