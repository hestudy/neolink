import { ProtectedRoute } from '@/components/auth/AuthGuard';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <div>
        <h1 className="text-2xl font-bold mb-6">设置</h1>
        <div className="max-w-2xl">
          <p className="text-muted-foreground">设置页面开发中...</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
