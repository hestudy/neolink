'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserContext } from '@neolink/shared';

interface AuthContextType {
  user: UserContext | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<{
    user: UserContext;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthResponse {
  success: boolean;
  data?: {
    user: UserContext;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  };
  error?: string;
  message?: string;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查是否已认证
  const isAuthenticated = user !== null;

  // 从本地存储获取令牌
  const getStoredTokens = () => {
    if (typeof window === 'undefined') {
      console.log('Server side, no tokens available'); // 调试日志
      return { accessToken: null, refreshToken: null };
    }

    const accessToken = localStorage.getItem('access_token');
    const refreshToken =
      localStorage.getItem('refresh_token') ||
      sessionStorage.getItem('refresh_token');

    console.log('Getting stored tokens:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    }); // 调试日志

    return {
      accessToken,
      refreshToken,
    };
  };

  // 存储令牌
  const storeTokens = (
    accessToken: string,
    refreshToken: string,
    remember: boolean = false
  ) => {
    if (typeof window === 'undefined') return;

    console.log('Storing tokens:', { remember }); // 调试日志
    localStorage.setItem('access_token', accessToken);

    if (remember) {
      localStorage.setItem('refresh_token', refreshToken);
      console.log('Tokens stored in localStorage'); // 调试日志
    } else {
      sessionStorage.setItem('refresh_token', refreshToken);
      console.log(
        'Access token in localStorage, refresh token in sessionStorage'
      ); // 调试日志
    }
  };

  // 清除令牌
  const clearTokens = () => {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('refresh_token');
  };

  // API请求辅助函数
  const apiRequest = async (
    endpoint: string,
    options: RequestInit = {}
  ): Promise<AuthResponse> => {
    const { accessToken } = getStoredTokens();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  };

  // 登录函数
  const login = async (
    email: string,
    password: string,
    remember: boolean = false
  ) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      });

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        setUser(userData);
        storeTokens(accessToken, refreshToken, remember);
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 注册函数
  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });

      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        setUser(userData);
        storeTokens(accessToken, refreshToken, false);
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 登出函数
  const logout = async () => {
    setIsLoading(true);
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
      // 即使登出请求失败，也要清除本地状态
    } finally {
      setUser(null);
      clearTokens();
      setIsLoading(false);
    }
  };

  // 刷新令牌函数
  const refreshToken = async () => {
    const { refreshToken: storedRefreshToken } = getStoredTokens();
    const sessionRefreshToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('refresh_token')
        : null;

    const tokenToUse = storedRefreshToken || sessionRefreshToken;

    if (!tokenToUse) {
      throw new Error('没有可用的刷新令牌');
    }

    try {
      const response = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokenToUse }),
      });

      if (response.success && response.data) {
        const {
          user: userData,
          accessToken,
          refreshToken: newRefreshToken,
        } = response.data;
        setUser(userData);

        // 保持原有的令牌存储方式
        const remember = !!storedRefreshToken;
        storeTokens(accessToken, newRefreshToken, remember);

        return response.data;
      } else {
        throw new Error(response.message || '令牌刷新失败');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // 刷新失败时清除用户状态
      setUser(null);
      clearTokens();
      throw error;
    }
  };

  // 获取当前用户信息
  const getCurrentUser = async () => {
    try {
      const response = await apiRequest('/auth/me');

      if (response.success && response.data) {
        setUser(response.data.user);
      } else {
        throw new Error('获取用户信息失败');
      }
    } catch (error) {
      console.error('Get current user error:', error);
      // 获取用户信息失败时尝试刷新令牌
      try {
        await refreshToken();
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        setUser(null);
        clearTokens();
      }
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Auth initialization started'); // 调试日志
      const { accessToken } = getStoredTokens();
      console.log('Stored token exists:', !!accessToken); // 调试日志

      if (!accessToken) {
        console.log('No access token found, setting not authenticated'); // 调试日志
        setIsLoading(false);
        return;
      }

      try {
        console.log('Getting current user with token'); // 调试日志
        await getCurrentUser();
        console.log('User loaded successfully'); // 调试日志
      } catch (error) {
        console.error('Auth initialization error:', error);
        // 如果token无效，清除它
        clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
}
