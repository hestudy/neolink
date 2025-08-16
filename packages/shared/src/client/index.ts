import { createClient } from '@orpc/client';
import type { AppRouter } from '../api';

/**
 * 创建类型安全的 API 客户端
 */
export function createAPIClient(baseUrl: string) {
  return createClient<AppRouter>({
    baseURL: `${baseUrl}/api/v1/rpc`,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 创建带认证的 API 客户端
 */
export function createAuthenticatedAPIClient(baseUrl: string, token: string) {
  return createClient<AppRouter>({
    baseURL: `${baseUrl}/api/v1/rpc`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * API 客户端类型
 */
export type APIClient = ReturnType<typeof createAPIClient>;
export type AuthenticatedAPIClient = ReturnType<
  typeof createAuthenticatedAPIClient
>;

// 导出路由器类型以供客户端使用
export type { AppRouter } from '../api';
