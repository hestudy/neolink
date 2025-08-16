import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  isTokenExpiringSoon,
  getTokenRemainingTime,
  extractTokenFromHeader,
  JWTError,
} from './jwt';
import { UserContext } from '@neolink/shared';

describe('JWT Utils', () => {
  const mockUser: UserContext = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
  };

  beforeEach(() => {
    // 设置测试环境变量
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT格式检查
    });

    it('should include user information in token payload', () => {
      const token = generateAccessToken(mockUser);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded!.userId).toBe(mockUser.id);
      expect(decoded!.username).toBe(mockUser.username);
      expect(decoded!.email).toBe(mockUser.email);
      expect(decoded!.role).toBe(mockUser.role);
      expect(decoded!.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should mark token as refresh type', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = decodeToken(token);

      expect(decoded!.type).toBe('refresh');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = generateTokenPair(mockUser);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeGreaterThan(0);
      expect(tokenPair.tokenType).toBe('Bearer');
    });

    it('should generate different tokens', () => {
      const tokenPair = generateTokenPair(mockUser);

      expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken(mockUser);
      const payload = verifyAccessToken(token);

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.type).toBe('access');
    });

    it('should reject refresh token as access token', () => {
      const refreshToken = generateRefreshToken(mockUser);

      expect(() => verifyAccessToken(refreshToken)).toThrow('Invalid token');
    });

    it('should reject invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow('Invalid token');
    });

    it('should reject token with wrong secret', () => {
      const token = generateAccessToken(mockUser);

      // 改变密钥
      process.env.JWT_ACCESS_SECRET = 'different-secret';

      expect(() => verifyAccessToken(token)).toThrow('Invalid token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockUser);
      const payload = verifyRefreshToken(token);

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.type).toBe('refresh');
    });

    it('should reject access token as refresh token', () => {
      const accessToken = generateAccessToken(mockUser);

      expect(() => verifyRefreshToken(accessToken)).toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('decodeToken', () => {
    it('should decode valid token without verification', () => {
      const token = generateAccessToken(mockUser);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded!.userId).toBe(mockUser.id);
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should detect non-expiring token', () => {
      const token = generateAccessToken(mockUser);
      const isExpiring = isTokenExpiringSoon(token, 1); // 1分钟阈值

      expect(isExpiring).toBe(false);
    });

    it('should return true for invalid token', () => {
      const isExpiring = isTokenExpiringSoon('invalid-token');
      expect(isExpiring).toBe(true);
    });
  });

  describe('getTokenRemainingTime', () => {
    it('should return positive time for valid token', () => {
      const token = generateAccessToken(mockUser);
      const remainingTime = getTokenRemainingTime(token);

      expect(remainingTime).toBeGreaterThan(0);
    });

    it('should return 0 for invalid token', () => {
      const remainingTime = getTokenRemainingTime('invalid-token');
      expect(remainingTime).toBe(0);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(extractTokenFromHeader('Invalid header')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Basic token')).toBeNull();
    });

    it('should return null for undefined header', () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('JWTError', () => {
    it('should create error with correct properties', () => {
      const error = new JWTError('Test message', 'INVALID_TOKEN');

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('INVALID_TOKEN');
      expect(error.name).toBe('JWTError');
      expect(error instanceof Error).toBe(true);
    });
  });
});
