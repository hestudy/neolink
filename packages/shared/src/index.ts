// 导出所有 schemas 和类型
export * from './schemas';

// 导出 API 路由器
export * from './api';

// 导出验证工具
export * from './validation';

// 兼容性：保留原有接口定义
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Link {
  id: string;
  url: string;
  title?: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 健康检查响应
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
  services: {
    database: 'connected' | 'disconnected';
    redis?: 'connected' | 'disconnected';
  };
}

// 工具函数
export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
): ApiResponse<T> => ({
  success,
  data,
  error,
  message,
});

// 常量
export const API_ENDPOINTS = {
  HEALTH: '/health',
  USERS: '/users',
  LINKS: '/links',
  API_V1: '/api/v1',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;
