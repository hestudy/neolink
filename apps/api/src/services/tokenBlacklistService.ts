import { decodeToken } from '../utils/jwt';

/**
 * Token 黑名单服务
 * 使用内存存储（生产环境中应该使用 Redis）
 */
class TokenBlacklistService {
  private blacklistedTokens = new Set<string>();
  private tokenExpirations = new Map<string, number>(); // token -> expiry timestamp

  /**
   * 将token添加到黑名单
   */
  async blacklistToken(token: string): Promise<void> {
    // 解码token获取过期时间
    const decoded = decodeToken(token);
    if (!decoded?.exp) {
      // 如果无法解码或没有过期时间，我们仍然将其加入黑名单
      this.blacklistedTokens.add(token);
      return;
    }

    // 添加到黑名单
    this.blacklistedTokens.add(token);
    this.tokenExpirations.set(token, decoded.exp);

    // 清理过期的token（异步执行，不等待）
    setImmediate(() => {
      this.cleanupExpiredTokens();
    });
  }

  /**
   * 检查token是否在黑名单中
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.blacklistedTokens.has(token);
  }

  /**
   * 清理过期的token
   */
  private cleanupExpiredTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    const expiredTokens: string[] = [];

    // 找到所有过期的token
    for (const [token, expiry] of this.tokenExpirations.entries()) {
      if (now >= expiry) {
        expiredTokens.push(token);
      }
    }

    // 清理过期的token
    for (const token of expiredTokens) {
      this.blacklistedTokens.delete(token);
      this.tokenExpirations.delete(token);
    }

    if (expiredTokens.length > 0) {
      console.log(
        `Cleaned up ${expiredTokens.length} expired tokens from blacklist`
      );
    }
  }

  /**
   * 获取黑名单统计信息
   */
  getStats(): { blacklistedCount: number; trackedExpirations: number } {
    return {
      blacklistedCount: this.blacklistedTokens.size,
      trackedExpirations: this.tokenExpirations.size,
    };
  }

  /**
   * 清空黑名单（主要用于测试）
   */
  async clearBlacklist(): Promise<void> {
    this.blacklistedTokens.clear();
    this.tokenExpirations.clear();
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask(intervalMinutes: number = 60): void {
    const interval = intervalMinutes * 60 * 1000;
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, interval);

    console.log(
      `Token blacklist cleanup task started (interval: ${intervalMinutes} minutes)`
    );
  }
}

// 导出单例实例
export const tokenBlacklistService = new TokenBlacklistService();

// 在服务启动时开始清理任务
if (process.env.NODE_ENV !== 'test') {
  tokenBlacklistService.startCleanupTask(30); // 每30分钟清理一次
}
