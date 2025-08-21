/**
 * 摘要版本管理服务
 * 管理摘要历史版本和版本控制
 */

export interface SummaryVersion {
  id: string;
  bookmarkId: string;
  version: number;
  summary: string;
  metadata: SummaryMetadata;
  generatedAt: Date;
  isActive: boolean;
  userId: string;
}

export interface SummaryMetadata {
  provider: string;
  confidence: number;
  language: string;
  tokensUsed: number;
  cost: number;
  summaryLength: string;
  qualityScore?: number;
  processingTime?: number;
}

export interface VersionComparisonResult {
  current: SummaryVersion;
  previous?: SummaryVersion;
  changes: {
    lengthChange: number;
    confidenceChange: number;
    significantChanges: boolean;
  };
  recommendation: 'keep_current' | 'revert_previous' | 'manual_review';
}

export class SummaryVersionManager {
  private versions: Map<string, SummaryVersion[]> = new Map();

  /**
   * 创建新的摘要版本
   */
  async createVersion(
    bookmarkId: string,
    summary: string,
    metadata: SummaryMetadata,
    userId: string
  ): Promise<SummaryVersion> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    // 将当前活跃版本设为非活跃
    bookmarkVersions.forEach((version) => {
      version.isActive = false;
    });

    // 创建新版本
    const newVersion: SummaryVersion = {
      id: this.generateVersionId(),
      bookmarkId,
      version: bookmarkVersions.length + 1,
      summary,
      metadata,
      generatedAt: new Date(),
      isActive: true,
      userId,
    };

    bookmarkVersions.push(newVersion);
    this.versions.set(bookmarkId, bookmarkVersions);

    return newVersion;
  }

  /**
   * 获取书签的所有版本
   */
  async getVersions(
    bookmarkId: string,
    options?: {
      limit?: number;
      activeOnly?: boolean;
      sortBy?: 'version' | 'generatedAt' | 'confidence';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<SummaryVersion[]> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    let filteredVersions = [...bookmarkVersions];

    // 过滤活跃版本
    if (options?.activeOnly) {
      filteredVersions = filteredVersions.filter((v) => v.isActive);
    }

    // 排序
    if (options?.sortBy) {
      filteredVersions.sort((a, b) => {
        const aValue = this.getSortValue(a, options.sortBy!);
        const bValue = this.getSortValue(b, options.sortBy!);

        const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return options.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // 限制数量
    if (options?.limit) {
      filteredVersions = filteredVersions.slice(0, options.limit);
    }

    return filteredVersions;
  }

  /**
   * 获取活跃版本
   */
  async getActiveVersion(bookmarkId: string): Promise<SummaryVersion | null> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];
    return bookmarkVersions.find((v) => v.isActive) || null;
  }

  /**
   * 获取特定版本
   */
  async getVersion(
    bookmarkId: string,
    versionId: string
  ): Promise<SummaryVersion | null> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];
    return bookmarkVersions.find((v) => v.id === versionId) || null;
  }

  /**
   * 激活特定版本
   */
  async activateVersion(
    bookmarkId: string,
    versionId: string
  ): Promise<SummaryVersion | null> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    // 将所有版本设为非活跃
    bookmarkVersions.forEach((version) => {
      version.isActive = false;
    });

    // 激活指定版本
    const targetVersion = bookmarkVersions.find((v) => v.id === versionId);
    if (targetVersion) {
      targetVersion.isActive = true;
      this.versions.set(bookmarkId, bookmarkVersions);
      return targetVersion;
    }

    return null;
  }

  /**
   * 删除版本
   */
  async deleteVersion(bookmarkId: string, versionId: string): Promise<boolean> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];
    const versionIndex = bookmarkVersions.findIndex((v) => v.id === versionId);

    if (versionIndex === -1) {
      return false;
    }

    const versionToDelete = bookmarkVersions[versionIndex];

    // 如果删除的是活跃版本，激活最新的其他版本
    if (versionToDelete.isActive && bookmarkVersions.length > 1) {
      bookmarkVersions.splice(versionIndex, 1);
      const latestVersion = bookmarkVersions.sort(
        (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
      )[0];
      latestVersion.isActive = true;
    } else {
      bookmarkVersions.splice(versionIndex, 1);
    }

    this.versions.set(bookmarkId, bookmarkVersions);
    return true;
  }

  /**
   * 比较版本
   */
  async compareVersions(
    bookmarkId: string,
    currentVersionId?: string,
    previousVersionId?: string
  ): Promise<VersionComparisonResult | null> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    if (bookmarkVersions.length < 1) {
      return null;
    }

    const current = currentVersionId
      ? bookmarkVersions.find((v) => v.id === currentVersionId)
      : bookmarkVersions.find((v) => v.isActive);

    if (!current) {
      return null;
    }

    const previous = previousVersionId
      ? bookmarkVersions.find((v) => v.id === previousVersionId)
      : this.getPreviousVersion(bookmarkVersions, current);

    const changes = {
      lengthChange: 0,
      confidenceChange: 0,
      significantChanges: false,
    };

    let recommendation: 'keep_current' | 'revert_previous' | 'manual_review' =
      'keep_current';

    if (previous) {
      changes.lengthChange = current.summary.length - previous.summary.length;
      changes.confidenceChange =
        current.metadata.confidence - previous.metadata.confidence;

      // 检查显著变化
      const lengthChangePercent =
        Math.abs(changes.lengthChange) / previous.summary.length;
      const confidenceChangePercent = Math.abs(changes.confidenceChange);
      const contentSimilarity = this.calculateSimilarity(
        current.summary,
        previous.summary
      );

      changes.significantChanges =
        lengthChangePercent > 0.3 || // 长度变化超过30%
        confidenceChangePercent > 0.2 || // 置信度变化超过20%
        contentSimilarity < 0.7; // 内容相似度低于70%

      // 生成推荐
      if (changes.confidenceChange < -0.2) {
        recommendation = 'revert_previous'; // 置信度显著降低
      } else if (changes.significantChanges) {
        recommendation = 'manual_review'; // 有显著变化需要人工审核
      } else {
        recommendation = 'keep_current'; // 保持当前版本
      }
    }

    return {
      current,
      previous,
      changes,
      recommendation,
    };
  }

  /**
   * 清理旧版本
   */
  async cleanupOldVersions(
    bookmarkId: string,
    options: {
      keepLatest: number; // 保留最新的N个版本
      olderThanDays?: number; // 删除N天前的版本
      lowConfidenceThreshold?: number; // 删除低置信度版本的阈值
    }
  ): Promise<number> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    if (bookmarkVersions.length <= options.keepLatest) {
      return 0; // 没有需要清理的版本
    }

    let versionsToDelete: SummaryVersion[] = [];

    // 按时间排序，最新的在前面
    const sortedVersions = [...bookmarkVersions].sort(
      (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
    );

    // 保留最新的N个版本
    const versionsToCheck = sortedVersions.slice(options.keepLatest);

    // 根据时间和置信度过滤
    const cutoffDate = options.olderThanDays
      ? new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000)
      : null;

    versionsToDelete = versionsToCheck.filter((version) => {
      // 不删除活跃版本
      if (version.isActive) return false;

      // 根据时间过滤
      if (cutoffDate && version.generatedAt < cutoffDate) {
        return true;
      }

      // 根据置信度过滤
      if (
        options.lowConfidenceThreshold &&
        version.metadata.confidence < options.lowConfidenceThreshold
      ) {
        return true;
      }

      return false;
    });

    // 删除选中的版本
    const remainingVersions = bookmarkVersions.filter(
      (version) => !versionsToDelete.includes(version)
    );

    this.versions.set(bookmarkId, remainingVersions);

    return versionsToDelete.length;
  }

  /**
   * 获取版本统计信息
   */
  async getVersionStats(bookmarkId: string): Promise<{
    totalVersions: number;
    activeVersion: SummaryVersion | null;
    averageConfidence: number;
    bestVersion: SummaryVersion | null;
    latestVersion: SummaryVersion | null;
    oldestVersion: SummaryVersion | null;
  }> {
    const bookmarkVersions = this.versions.get(bookmarkId) || [];

    if (bookmarkVersions.length === 0) {
      return {
        totalVersions: 0,
        activeVersion: null,
        averageConfidence: 0,
        bestVersion: null,
        latestVersion: null,
        oldestVersion: null,
      };
    }

    const activeVersion = bookmarkVersions.find((v) => v.isActive) || null;
    const averageConfidence =
      bookmarkVersions.reduce((sum, v) => sum + v.metadata.confidence, 0) /
      bookmarkVersions.length;

    const bestVersion = [...bookmarkVersions].sort(
      (a, b) => b.metadata.confidence - a.metadata.confidence
    )[0];

    const latestVersion = [...bookmarkVersions].sort(
      (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
    )[0];

    const oldestVersion = [...bookmarkVersions].sort(
      (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
    )[0];

    return {
      totalVersions: bookmarkVersions.length,
      activeVersion,
      averageConfidence,
      bestVersion,
      latestVersion,
      oldestVersion,
    };
  }

  /**
   * 生成版本报告
   */
  async generateVersionReport(bookmarkId: string): Promise<{
    summary: string;
    versions: SummaryVersion[];
    insights: string[];
    recommendations: string[];
  }> {
    const stats = await this.getVersionStats(bookmarkId);
    const versions = await this.getVersions(bookmarkId, {
      sortBy: 'generatedAt',
      sortOrder: 'desc',
    });

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (stats.totalVersions === 0) {
      return {
        summary: 'No summary versions found for this bookmark.',
        versions: [],
        insights: ['No data available for analysis'],
        recommendations: ['Generate an initial summary'],
      };
    }

    // 生成洞察
    if (stats.totalVersions > 1) {
      const confidenceImprovement =
        stats.latestVersion!.metadata.confidence -
        stats.oldestVersion!.metadata.confidence;
      if (confidenceImprovement > 0.1) {
        insights.push(
          `Summary quality has improved by ${(confidenceImprovement * 100).toFixed(1)}% over time`
        );
      } else if (confidenceImprovement < -0.1) {
        insights.push(
          `Summary quality has declined by ${(Math.abs(confidenceImprovement) * 100).toFixed(1)}% over time`
        );
      }
    }

    insights.push(
      `Average confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`
    );
    insights.push(
      `Best performing version has ${(stats.bestVersion!.metadata.confidence * 100).toFixed(1)}% confidence`
    );

    // 生成推荐
    if (stats.activeVersion !== stats.bestVersion) {
      recommendations.push(
        'Consider activating the highest confidence version'
      );
    }

    if (stats.totalVersions > 5) {
      recommendations.push('Consider cleaning up old versions to save storage');
    }

    if (stats.averageConfidence < 0.6) {
      recommendations.push(
        'Summary quality is below average - consider using different providers or improving content'
      );
    }

    const summary = `Found ${stats.totalVersions} summary versions with average confidence of ${(stats.averageConfidence * 100).toFixed(1)}%`;

    return {
      summary,
      versions,
      insights,
      recommendations,
    };
  }

  // Private helper methods

  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSortValue(
    version: SummaryVersion,
    sortBy: string
  ): string | number | Date {
    switch (sortBy) {
      case 'version':
        return version.version;
      case 'generatedAt':
        return version.generatedAt.getTime();
      case 'confidence':
        return version.metadata.confidence;
      default:
        return version.version;
    }
  }

  private getPreviousVersion(
    versions: SummaryVersion[],
    current: SummaryVersion
  ): SummaryVersion | undefined {
    const sortedVersions = versions.sort((a, b) => b.version - a.version);

    const currentIndex = sortedVersions.findIndex((v) => v.id === current.id);
    return currentIndex < sortedVersions.length - 1
      ? sortedVersions[currentIndex + 1]
      : undefined;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // 简单的相似度计算 - 可以使用更复杂的算法如 Levenshtein distance
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const allWords = new Set([...words1, ...words2]);
    let commonWords = 0;

    for (const word of allWords) {
      if (words1.includes(word) && words2.includes(word)) {
        commonWords++;
      }
    }

    return commonWords / allWords.size;
  }
}
