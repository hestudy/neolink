'use client';

import { useEffect } from 'react';
import { setupDevAuth } from '@/lib/dev-auth';

export function DevAuthSetup() {
  useEffect(() => {
    // 在客户端挂载时自动设置开发认证
    setupDevAuth();
  }, []);

  return null;
}
