'use client';

import { useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@neolink/shared';

export function HealthCheck() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: HealthCheckResponse = await response.json();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHealth(null);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();

    // 每30秒检查一次
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Checking system status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <span className="text-red-600 text-xl mr-2">❌</span>
          <div>
            <p className="font-semibold text-red-800">Connection Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-gray-600">No health data available</p>
      </div>
    );
  }

  const isHealthy = health.status === 'ok';
  const statusColor = isHealthy ? 'green' : 'red';
  const statusIcon = isHealthy ? '✅' : '❌';

  return (
    <div
      className={`p-4 border rounded-lg ${
        isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-xl mr-2">{statusIcon}</span>
          <span
            className={`font-semibold ${
              isHealthy ? 'text-green-800' : 'text-red-800'
            }`}
          >
            System {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
        <span className="text-sm text-gray-500">v{health.version}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Database:</span>
          <span
            className={`text-sm font-medium ${
              health.services.database === 'connected'
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {health.services.database}
          </span>
        </div>

        {health.services.redis && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Redis:</span>
            <span
              className={`text-sm font-medium ${
                health.services.redis === 'connected'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {health.services.redis}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
