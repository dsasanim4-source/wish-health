'use client';

import { useState } from 'react';
import { Heart, Lock, User } from 'lucide-react';
import { adminLoginTotp, login, type AuthSession } from '@/lib/auth';

export default function LoginScreen({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const adminCode = password.trim();
      if (/^\d{6}$/.test(adminCode)) {
        try {
          const session = await adminLoginTotp(adminCode);
          onLogin(session);
          return;
        } catch (err) {
          if (!username.trim()) {
            throw err;
          }
        }
      }

      const session = await login(username, password);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blush/15 flex items-center justify-center">
            <Heart className="w-7 h-7 text-blush-dark fill-blush" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">暖暖健康记录</h1>
            <p className="text-sm text-text-secondary">登录后开始记录今天的状态</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary mb-1 block">用户名</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                className="input-field pl-11"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="输入管理员分配的用户名"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary mb-1 block">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                className="input-field pl-11"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="用户密码，或管理员 6 位动态码"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleLogin();
                }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush-dark">
              {error}
            </div>
          )}

          <button
            className="btn-primary w-full"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '验证中...' : '登录'}
          </button>
        </div>
      </div>
    </main>
  );
}
