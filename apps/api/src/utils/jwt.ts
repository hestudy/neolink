import jwt from 'jsonwebtoken';
import { JWTPayload, UserContext } from '@neolink/shared';

/**
 * JWT 配置
 */
export interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

/**
 * 获取 JWT 配置
 */
export function getJWTConfig(): JWTConfig {
  return {
    accessTokenSecret:
      process.env.JWT_ACCESS_SECRET || 'your-access-secret-key',
    refreshTokenSecret:
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'neolink-api',
    audience: process.env.JWT_AUDIENCE || 'neolink-client',
  };
}

/**
 * 生成访问令牌
 */
export function generateAccessToken(user: UserContext): string {
  const config = getJWTConfig();

  const payload: Partial<JWTPayload> = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    type: 'access',
  };

  return jwt.sign(payload, config.accessTokenSecret, {
    expiresIn: config.accessTokenExpiry,
    issuer: config.issuer,
    audience: config.audience,
  });
}

/**
 * 生成刷新令牌
 */
export function generateRefreshToken(user: UserContext): string {
  const config = getJWTConfig();

  const payload: Partial<JWTPayload> = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    type: 'refresh',
  };

  return jwt.sign(payload, config.refreshTokenSecret, {
    expiresIn: config.refreshTokenExpiry,
    issuer: config.issuer,
    audience: config.audience,
  });
}

/**
 * 生成令牌对
 */
export function generateTokenPair(user: UserContext) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // 解析访问令牌以获取过期时间
  const decoded = jwt.decode(accessToken) as any;
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer' as const,
  };
}

/**
 * 验证访问令牌
 */
export function verifyAccessToken(token: string): JWTPayload {
  const config = getJWTConfig();

  try {
    const decoded = jwt.verify(token, config.accessTokenSecret, {
      issuer: config.issuer,
      audience: config.audience,
    }) as JWTPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid token type') {
      throw error;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not active');
    }
    throw error;
  }
}

/**
 * 验证刷新令牌
 */
export function verifyRefreshToken(token: string): JWTPayload {
  const config = getJWTConfig();

  try {
    const decoded = jwt.verify(token, config.refreshTokenSecret, {
      issuer: config.issuer,
      audience: config.audience,
    }) as JWTPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid token type') {
      throw error;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Refresh token not active');
    }
    throw error;
  }
}

/**
 * 解析令牌（不验证签名）
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * 检查令牌是否即将过期
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdMinutes: number = 5
): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const threshold = thresholdMinutes * 60;

  return decoded.exp - now < threshold;
}

/**
 * 获取令牌剩余时间（秒）
 */
export function getTokenRemainingTime(token: string): number {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - now);
}

/**
 * 从 Authorization 头部提取令牌
 */
export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * JWT 错误类型
 */
export class JWTError extends Error {
  constructor(
    message: string,
    public _code:
      | 'INVALID_TOKEN'
      | 'TOKEN_EXPIRED'
      | 'TOKEN_NOT_ACTIVE'
      | 'INVALID_TYPE'
  ) {
    super(message);
    this.name = 'JWTError';
  }
}
