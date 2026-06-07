'use client';

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import api, { clearToken, getToken, saveToken } from '@/lib/api';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'organizer' | 'team_owner' | 'viewer' | null;
  isVerified: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  refetch: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      if (!getToken()) {
        setUser(null);
        return;
      }

      const res = await api.get('/auth/me');
      const userData = res.data.user || res.data;

      if (!userData?._id) {
        throw new Error('Invalid user data');
      }

      setUser(userData);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        clearToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string, role: string) => {
    const res = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
      role,
    });

    if (res.data.token) {
      saveToken(res.data.token);
    }

    const userData = res.data.user;
    if (!userData?._id) {
      throw new Error('Invalid login response');
    }

    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }

    clearToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refetch: fetchUser }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
};

export const getRoleRedirect = (role: string | null): string =>
  ({
    admin: '/dashboard/admin',
    organizer: '/dashboard/organizer',
    team_owner: '/dashboard/team-owner',
    viewer: '/dashboard/viewer',
  }[role || ''] || '/auctions');
