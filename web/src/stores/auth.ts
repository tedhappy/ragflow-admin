//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { create } from 'zustand';
import { authApi, getToken, setToken, removeToken, UserInfo } from '@/services/api';

interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  setUser: (user: UserInfo | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: !!getToken(),
  user: null,
  loading: false,

  login: async (username: string, password: string) => {
    try {
      set({ loading: true });
      const response = await authApi.login({ username, password });
      setToken(response.token);
      set({
        isAuthenticated: true,
        user: { username: response.username, role: 'admin' },
        loading: false,
      });
      return true;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Silent
    } finally {
      removeToken();
      set({
        isAuthenticated: false,
        user: null,
      });
    }
  },

  checkAuth: async () => {
    const token = getToken();
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      set({ loading: true });
      const user = await authApi.getCurrentUser();
      set({
        isAuthenticated: true,
        user,
        loading: false,
      });
      return true;
    } catch {
      removeToken();
      set({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
      return false;
    }
  },

  setUser: (user: UserInfo | null) => {
    set({ user });
  },
}));

export default useAuthStore;
