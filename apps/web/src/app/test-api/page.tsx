'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { setupDevAuth, DEV_TOKEN } from '@/lib/dev-auth';

export default function TestApiPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Force setup development auth
    setupDevAuth();

    // Check if token is set
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('authToken');
      setToken(authToken);
    }

    // Test API call
    async function testApi() {
      try {
        setLoading(true);
        const result = await api.bookmarks.list();
        setBookmarks(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    // Small delay to ensure token is set
    setTimeout(testApi, 100);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">API 测试页面</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">认证状态</h2>
        <p>Token存在: {token ? '是' : '否'}</p>
        {token && (
          <p className="text-xs text-gray-500 break-all">
            Token: {token.substring(0, 50)}...
          </p>
        )}
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">API调用状态</h2>
        {loading && <p>正在加载...</p>}
        {error && <p className="text-red-500">错误: {error}</p>}
        {!loading && !error && (
          <p className="text-green-500">成功获取 {bookmarks.length} 个书签</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">书签数据</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(bookmarks, null, 2)}
        </pre>
      </div>
    </div>
  );
}
