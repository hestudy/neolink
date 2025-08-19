import type { AIProvider, HealthCheckResult } from '../types';

export class HealthChecker {
  private providers: Map<string, AIProvider>;
  private healthCache: Map<string, HealthCheckResult>;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor(providers: Map<string, AIProvider>) {
    this.providers = providers;
    this.healthCache = new Map();
  }

  async checkProvider(providerName: string): Promise<HealthCheckResult> {
    const cached = this.healthCache.get(providerName);
    if (
      cached &&
      Date.now() - cached.lastChecked.getTime() < this.cacheExpiry
    ) {
      return cached;
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      const result: HealthCheckResult = {
        provider: providerName,
        healthy: false,
        lastChecked: new Date(),
        error: 'Provider not found',
      };
      this.healthCache.set(providerName, result);
      return result;
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      const isHealthy = await Promise.race([
        provider.isHealthy(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        ),
      ]);

      result = {
        provider: providerName,
        healthy: isHealthy,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      result = {
        provider: providerName,
        healthy: false,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    this.healthCache.set(providerName, result);
    return result;
  }

  async checkAllProviders(): Promise<HealthCheckResult[]> {
    const providerNames = Array.from(this.providers.keys());
    const results = await Promise.all(
      providerNames.map((name) => this.checkProvider(name))
    );
    return results;
  }

  async getHealthyProviders(): Promise<string[]> {
    const results = await this.checkAllProviders();
    return results
      .filter((result) => result.healthy)
      .map((result) => result.provider);
  }

  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    providers: HealthCheckResult[];
    healthyCount: number;
    totalCount: number;
  }> {
    const results = await this.checkAllProviders();
    const healthyCount = results.filter((result) => result.healthy).length;
    const totalCount = results.length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === 0) {
      overall = 'unhealthy';
    } else if (healthyCount < totalCount) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      providers: results,
      healthyCount,
      totalCount,
    };
  }

  clearCache(): void {
    this.healthCache.clear();
  }

  getCachedHealth(providerName: string): HealthCheckResult | null {
    const cached = this.healthCache.get(providerName);
    if (
      !cached ||
      Date.now() - cached.lastChecked.getTime() >= this.cacheExpiry
    ) {
      return null;
    }
    return cached;
  }
}
