'use client';

import { useEffect, useMemo, useState } from 'react';
import { LogOut, Plus, RefreshCw, Shield, Users, CalendarDays } from 'lucide-react';
import {
  adminCreateUser,
  adminListRecords,
  adminListUsers,
  clearAuthSession,
  type AdminRecord,
  type AdminUser,
} from '@/lib/auth';

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const loadData = async () => {
    setError('');
    setLoading(true);
    try {
      const [nextUsers, nextRecords] = await Promise.all([
        adminListUsers(),
        adminListRecords(),
      ]);
      setUsers(nextUsers);
      setRecords(nextRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) => {
      return (
        record.username.toLowerCase().includes(keyword) ||
        (record.display_name || '').toLowerCase().includes(keyword) ||
        record.date.includes(keyword) ||
        (record.gratitude || '').toLowerCase().includes(keyword)
      );
    });
  }, [records, filter]);

  const handleCreateUser = async () => {
    setError('');
    setMessage('');
    if (!username.trim()) {
      setError('请填写用户名');
      return;
    }

    setLoading(true);
    try {
      const user = await adminCreateUser(username, displayName);
      setUsers((current) => [user, ...current.filter((item) => item.id !== user.id)]);
      setUsername('');
      setDisplayName('');
      setMessage(`已创建用户 ${user.username}，初始密码为 123456`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建用户失败');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuthSession();
    onLogout();
  };

  return (
    <main className="min-h-screen pb-10">
      <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-lavender/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-lavender-dark" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">管理员模式</h1>
              <p className="text-sm text-text-secondary">管理用户，并查看所有健康记录</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2" onClick={loadData} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={logout}>
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>
        </div>

        {(message || error) && (
          <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${error ? 'bg-blush/10 text-blush-dark' : 'bg-sage/15 text-sage-dark'}`}>
            {error || message}
          </div>
        )}

        <div className="grid lg:grid-cols-[360px_1fr] gap-4">
          <div className="space-y-4">
            <section className="card">
              <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blush-dark" />
                分配新用户名
              </h2>
              <div className="space-y-3">
                <input
                  className="input-field"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="用户名，例如 xiaoyu"
                />
                <input
                  className="input-field"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="显示名，可选"
                />
                <button className="btn-primary w-full" onClick={handleCreateUser} disabled={loading}>
                  创建用户
                </button>
                <p className="text-xs text-text-secondary">新用户初始密码固定为 123456，登录后可自行修改。</p>
              </div>
            </section>

            <section className="card">
              <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-lavender-dark" />
                用户列表
              </h2>
              <div className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-text-secondary">暂无用户</p>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="p-3 rounded-xl bg-warm-beige/40">
                      <div className="font-medium text-text-primary">{user.username}</div>
                      <div className="text-xs text-text-secondary">
                        {user.display_name || '未设置显示名'}
                        {user.must_change_password ? ' · 仍使用初始密码' : ' · 已改密码'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-text-primary flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-sage-dark" />
                用户记录
              </h2>
              <input
                className="input-field md:max-w-xs"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="搜索用户名、日期或感恩记录"
              />
            </div>

            <div className="space-y-3">
              {filteredRecords.length === 0 ? (
                <p className="text-sm text-text-secondary">暂无记录</p>
              ) : (
                filteredRecords.map((record) => (
                  <div key={`${record.username}-${record.id}`} className="p-4 rounded-xl bg-warm-beige/35">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="font-semibold text-text-primary">{record.display_name || record.username}</span>
                        <span className="text-xs text-text-secondary ml-2">@{record.username}</span>
                      </div>
                      <span className="text-sm text-text-secondary">{record.date}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">饮食 {(record.diet || []).length}</span>
                      {record.mood ? <span className="px-2 py-1 rounded-lg bg-lavender/15 text-lavender-dark">情绪已记</span> : null}
                      {record.sleep ? <span className="px-2 py-1 rounded-lg bg-sage/15 text-sage-dark">睡眠已记</span> : null}
                      {record.exercise ? <span className="px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">运动已记</span> : null}
                    </div>
                    {record.gratitude ? (
                      <p className="mt-3 text-sm text-text-secondary">{record.gratitude}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
