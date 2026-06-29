'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, Eye, LogOut, Plus, RefreshCw, Shield, Users, CalendarDays } from 'lucide-react';
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
  const [expandedRecordIds, setExpandedRecordIds] = useState<string[]>([]);

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
    void Promise.resolve().then(loadData);
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) => {
      const searchable = [
        record.username,
        record.display_name || '',
        record.date,
        record.gratitude || '',
        record.raw_text || '',
        JSON.stringify(record.diet || []),
        JSON.stringify(record.mood || {}),
        JSON.stringify(record.sleep || {}),
        JSON.stringify(record.period || {}),
        JSON.stringify(record.exercise || {}),
      ].join(' ').toLowerCase();

      return searchable.includes(keyword);
    });
  }, [records, filter]);

  const toggleRecord = (recordId: string) => {
    setExpandedRecordIds((current) => (
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    ));
  };

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
                filteredRecords.map((record) => {
                  const recordKey = `${record.username}-${record.id}`;
                  const isExpanded = expandedRecordIds.includes(recordKey);

                  return (
                  <div key={recordKey} className="p-4 rounded-xl bg-warm-beige/35">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="font-semibold text-text-primary">{record.display_name || record.username}</span>
                        <span className="text-xs text-text-secondary ml-2">@{record.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary">{record.date}</span>
                        <button
                          type="button"
                          onClick={() => toggleRecord(recordKey)}
                          className="btn-secondary flex items-center gap-1 px-3 py-2 text-xs"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isExpanded ? '收起' : '查看详情'}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">饮食 {(record.diet || []).length}</span>
                      {record.mood ? <span className="px-2 py-1 rounded-lg bg-lavender/15 text-lavender-dark">情绪已记</span> : null}
                      {record.sleep ? <span className="px-2 py-1 rounded-lg bg-sage/15 text-sage-dark">睡眠已记</span> : null}
                      {record.exercise ? <span className="px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">运动已记</span> : null}
                      {record.period ? <span className="px-2 py-1 rounded-lg bg-blush/15 text-blush-dark">生理期已记</span> : null}
                      {record.raw_text ? <span className="px-2 py-1 rounded-lg bg-white/70 text-text-secondary">原文已存</span> : null}
                    </div>
                    {isExpanded ? <RecordDetails record={record} /> : null}
                  </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function RecordDetails({ record }: { record: AdminRecord }) {
  const diet = Array.isArray(record.diet) ? record.diet : [];
  const mood = isObject(record.mood) ? record.mood : null;
  const sleep = isObject(record.sleep) ? record.sleep : null;
  const period = isObject(record.period) ? record.period : null;
  const exercise = isObject(record.exercise) ? record.exercise : null;

  return (
    <div className="mt-4 border-t border-warm-beige pt-4 space-y-3">
      {record.raw_text ? (
        <DetailSection title="懒人模式原文">
          <p className="whitespace-pre-wrap text-text-primary">{record.raw_text}</p>
        </DetailSection>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        <DetailSection title="饮食">
          {diet.length > 0 ? (
            <div className="space-y-2">
              {diet.map((item, index) => {
                const source = isObject(item) ? item : {};
                const mealType = textValue(source.mealType);
                const stomachFeeling = textValue(source.stomachFeeling);
                return (
                  <div key={index} className="text-sm">
                    <div className="font-medium text-text-primary">
                      {labelOf(adminMealLabels, mealType, '餐次')}：{textValue(source.food) || '未填写食物'}
                    </div>
                    <div className="text-text-secondary">
                      肠胃：{labelOf(adminStomachLabels, stomachFeeling, '未记录')}
                      {textValue(source.notes) ? `；备注：${textValue(source.notes)}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>

        <DetailSection title="情绪">
          {mood ? (
            <p>
              {labelOf(adminMoodLabels, textValue(mood.mood), '未记录心情')}，焦虑 {numberValue(mood.anxietyLevel, 0)}/5
              {textValue(mood.triggers) ? `；触发因素：${textValue(mood.triggers)}` : ''}
              {textValue(mood.notes) ? `；备注：${textValue(mood.notes)}` : ''}
            </p>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>

        <DetailSection title="睡眠">
          {sleep ? (
            <p>
              {numberValue(sleep.hours, 0)} 小时，质量{labelOf(adminSleepLabels, textValue(sleep.quality), '未记录')}
              {textValue(sleep.notes) ? `；备注：${textValue(sleep.notes)}` : ''}
            </p>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>

        <DetailSection title="生理期">
          {period ? (
            <p>
              {textValue(period.day) === 'none' ? '无' : `D${textValue(period.day) || '?'}`}，流量{labelOf(adminFlowLabels, textValue(period.flow), '未记录')}
              {textValue(period.symptoms) ? `；症状：${textValue(period.symptoms)}` : ''}
            </p>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>

        <DetailSection title="运动">
          {exercise ? (
            <p>
              {textValue(exercise.type) || '运动'} {numberValue(exercise.duration, 0)} 分钟，{labelOf(adminIntensityLabels, textValue(exercise.intensity), '未记录强度')}
              {textValue(exercise.notes) ? `；备注：${textValue(exercise.notes)}` : ''}
            </p>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>

        <DetailSection title="今日感恩">
          {record.gratitude ? (
            <p className="whitespace-pre-wrap">{record.gratitude}</p>
          ) : (
            <EmptyDetail />
          )}
        </DetailSection>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white/60 px-3 py-3 text-sm text-text-secondary">
      <h3 className="font-semibold text-text-primary mb-2">{title}</h3>
      {children}
    </section>
  );
}

function EmptyDetail() {
  return <span className="text-text-secondary">未记录</span>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function numberValue(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function labelOf(labels: Record<string, string>, value: string, fallback: string): string {
  return labels[value] || fallback;
}

const adminMealLabels: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

const adminStomachLabels: Record<string, string> = {
  good: '很好',
  okay: '还好',
  uncomfortable: '不舒服',
  pain: '疼痛',
};

const adminMoodLabels: Record<string, string> = {
  happy: '开心',
  calm: '平静',
  neutral: '一般',
  anxious: '焦虑',
  sad: '难过',
  overwhelmed: '压力大',
};

const adminSleepLabels: Record<string, string> = {
  excellent: '很好',
  good: '不错',
  fair: '一般',
  poor: '很差',
};

const adminFlowLabels: Record<string, string> = {
  spotting: '点滴',
  light: '量少',
  medium: '中等',
  heavy: '量大',
};

const adminIntensityLabels: Record<string, string> = {
  light: '轻度',
  moderate: '中度',
  vigorous: '剧烈',
};
