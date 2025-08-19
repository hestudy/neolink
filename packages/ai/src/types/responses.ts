export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    tokensUsed?: {
      input: number;
      output: number;
    };
    cost?: number;
    provider?: string;
    model?: string;
    cached?: boolean;
  };
}

export interface HealthCheckResult {
  provider: string;
  healthy: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export interface CostReport {
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  userCosts?: Record<string, number>;
  breakdown: {
    operation: string;
    cost: number;
    requests: number;
  }[];
}
