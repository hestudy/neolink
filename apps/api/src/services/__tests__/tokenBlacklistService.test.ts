import { describe, it, expect, beforeEach } from 'vitest';
import { tokenBlacklistService } from '../tokenBlacklistService';

describe('TokenBlacklistService', () => {
  beforeEach(async () => {
    // 清理黑名单
    await tokenBlacklistService.clearBlacklist();
  });

  describe('blacklistToken', () => {
    it('should add token to blacklist', async () => {
      const token = 'test-token-123';

      await tokenBlacklistService.blacklistToken(token);

      const isBlacklisted =
        await tokenBlacklistService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should handle token without expiration', async () => {
      const invalidToken = 'invalid-token';

      await tokenBlacklistService.blacklistToken(invalidToken);

      const isBlacklisted =
        await tokenBlacklistService.isTokenBlacklisted(invalidToken);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for non-blacklisted token', async () => {
      const token = 'non-blacklisted-token';

      const isBlacklisted =
        await tokenBlacklistService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(false);
    });

    it('should return true for blacklisted token', async () => {
      const token = 'blacklisted-token';

      await tokenBlacklistService.blacklistToken(token);
      const isBlacklisted =
        await tokenBlacklistService.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const token1 = 'token-1';
      const token2 = 'token-2';

      await tokenBlacklistService.blacklistToken(token1);
      await tokenBlacklistService.blacklistToken(token2);

      const stats = tokenBlacklistService.getStats();

      expect(stats.blacklistedCount).toBe(2);
    });

    it('should return zero stats for empty blacklist', () => {
      const stats = tokenBlacklistService.getStats();

      expect(stats.blacklistedCount).toBe(0);
      expect(stats.trackedExpirations).toBe(0);
    });
  });

  describe('clearBlacklist', () => {
    it('should clear all blacklisted tokens', async () => {
      const token1 = 'token-1';
      const token2 = 'token-2';

      await tokenBlacklistService.blacklistToken(token1);
      await tokenBlacklistService.blacklistToken(token2);

      // 验证tokens已被blacklist
      expect(await tokenBlacklistService.isTokenBlacklisted(token1)).toBe(true);
      expect(await tokenBlacklistService.isTokenBlacklisted(token2)).toBe(true);

      await tokenBlacklistService.clearBlacklist();

      // 验证tokens已被清除
      expect(await tokenBlacklistService.isTokenBlacklisted(token1)).toBe(
        false
      );
      expect(await tokenBlacklistService.isTokenBlacklisted(token2)).toBe(
        false
      );

      const stats = tokenBlacklistService.getStats();
      expect(stats.blacklistedCount).toBe(0);
    });
  });
});
