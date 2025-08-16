import {
  UserContext,
  TokenResponse,
  RefreshTokenRequest,
} from '@neolink/shared';
import { generateTokenPair, verifyRefreshToken, JWTError } from '../utils/jwt';
import { userService } from './user';

/**
 * 刷新令牌数据接口
 */
export interface RefreshTokenData {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
  deviceInfo?: string;
  ipAddress?: string;
}

/**
 * 模拟刷新令牌数据库
 */
class RefreshTokenDatabase {
  private tokens: Map<string, RefreshTokenData> = new Map();
  private userTokens: Map<string, Set<string>> = new Map();

  async create(
    tokenData: Omit<RefreshTokenData, 'id' | 'createdAt'>
  ): Promise<RefreshTokenData> {
    const id = `refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const refreshToken: RefreshTokenData = {
      ...tokenData,
      id,
      createdAt: new Date(),
    };

    this.tokens.set(id, refreshToken);

    // 维护用户令牌索引
    if (!this.userTokens.has(tokenData.userId)) {
      this.userTokens.set(tokenData.userId, new Set());
    }
    this.userTokens.get(tokenData.userId)!.add(id);

    return refreshToken;
  }

  async findByToken(token: string): Promise<RefreshTokenData | null> {
    for (const tokenData of this.tokens.values()) {
      if (tokenData.token === token && !tokenData.isRevoked) {
        return tokenData;
      }
    }
    return null;
  }

  async findByUserId(userId: string): Promise<RefreshTokenData[]> {
    const tokenIds = this.userTokens.get(userId) || new Set();
    const tokens: RefreshTokenData[] = [];

    for (const tokenId of tokenIds) {
      const token = this.tokens.get(tokenId);
      if (token && !token.isRevoked) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  async revoke(tokenId: string): Promise<boolean> {
    const token = this.tokens.get(tokenId);
    if (!token) return false;

    token.isRevoked = true;
    return true;
  }

  async revokeByToken(tokenString: string): Promise<boolean> {
    for (const token of this.tokens.values()) {
      if (token.token === tokenString) {
        token.isRevoked = true;
        return true;
      }
    }
    return false;
  }

  async revokeAllUserTokens(userId: string): Promise<number> {
    const tokenIds = this.userTokens.get(userId) || new Set();
    let revokedCount = 0;

    for (const tokenId of tokenIds) {
      const token = this.tokens.get(tokenId);
      if (token && !token.isRevoked) {
        token.isRevoked = true;
        revokedCount++;
      }
    }

    return revokedCount;
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, token] of this.tokens.entries()) {
      if (token.expiresAt < now) {
        this.tokens.delete(id);

        // 从用户索引中移除
        const userTokens = this.userTokens.get(token.userId);
        if (userTokens) {
          userTokens.delete(id);
          if (userTokens.size === 0) {
            this.userTokens.delete(token.userId);
          }
        }

        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// 全局刷新令牌数据库实例
const refreshTokenDB = new RefreshTokenDatabase();

/**
 * 令牌服务类
 */
export class TokenService {
  /**
   * 创建令牌对
   */
  async createTokenPair(
    user: UserContext,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<TokenResponse> {
    const tokens = generateTokenPair(user);

    // 计算刷新令牌过期时间
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7); // 7天后过期

    // 存储刷新令牌
    await refreshTokenDB.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: refreshTokenExpiry,
      isRevoked: false,
      deviceInfo,
      ipAddress,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date(), // 这里应该从数据库获取实际创建时间
        updatedAt: new Date(), // 这里应该从数据库获取实际更新时间
      },
    };
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(
    refreshRequest: RefreshTokenRequest,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<TokenResponse> {
    try {
      // 验证刷新令牌
      const payload = verifyRefreshToken(refreshRequest.refreshToken);

      // 检查令牌是否在数据库中存在且未被撤销
      const storedToken = await refreshTokenDB.findByToken(
        refreshRequest.refreshToken
      );
      if (!storedToken || storedToken.isRevoked) {
        throw new Error('刷新令牌无效或已被撤销');
      }

      // 检查令牌是否过期
      if (storedToken.expiresAt < new Date()) {
        throw new Error('刷新令牌已过期');
      }

      // 获取用户信息
      const user = await userService.getUserById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('用户不存在或已被禁用');
      }

      // 撤销旧的刷新令牌
      await refreshTokenDB.revokeByToken(refreshRequest.refreshToken);

      // 创建新的令牌对
      return await this.createTokenPair(user, deviceInfo, ipAddress);
    } catch (error) {
      if (error instanceof JWTError) {
        throw new Error(`刷新令牌验证失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 撤销刷新令牌
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    return await refreshTokenDB.revokeByToken(token);
  }

  /**
   * 撤销用户的所有刷新令牌
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    return await refreshTokenDB.revokeAllUserTokens(userId);
  }

  /**
   * 获取用户的活跃令牌列表
   */
  async getUserActiveTokens(userId: string): Promise<RefreshTokenData[]> {
    return await refreshTokenDB.findByUserId(userId);
  }

  /**
   * 清理过期的刷新令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    return await refreshTokenDB.cleanupExpired();
  }

  /**
   * 验证刷新令牌是否有效
   */
  async validateRefreshToken(token: string): Promise<boolean> {
    try {
      // 验证JWT签名和格式
      verifyRefreshToken(token);

      // 检查数据库中的令牌状态
      const storedToken = await refreshTokenDB.findByToken(token);
      if (!storedToken || storedToken.isRevoked) {
        return false;
      }

      // 检查是否过期
      if (storedToken.expiresAt < new Date()) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取令牌统计信息
   */
  async getTokenStats(): Promise<{
    totalActiveTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }> {
    const now = new Date();
    let totalActive = 0;
    let expired = 0;
    let revoked = 0;

    for (const token of refreshTokenDB['tokens'].values()) {
      if (token.isRevoked) {
        revoked++;
      } else if (token.expiresAt < now) {
        expired++;
      } else {
        totalActive++;
      }
    }

    return {
      totalActiveTokens: totalActive,
      expiredTokens: expired,
      revokedTokens: revoked,
    };
  }
}

// 导出单例实例
export const tokenService = new TokenService();

// 定期清理过期令牌（每小时执行一次）
setInterval(
  async () => {
    try {
      const cleaned = await tokenService.cleanupExpiredTokens();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired refresh tokens`);
      }
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  },
  60 * 60 * 1000
); // 1小时
