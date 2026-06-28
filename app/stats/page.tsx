'use client';

import { useMemo } from 'react';
import { getEntries, getStats } from '@/lib/storage';
import { BarChart3, TrendingUp, Calendar, Heart, Coffee, Moon, Activity, Sparkles, Shield } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function StatsPage() {
  const entries = getEntries();
  const stats = getStats();

  // 焦虑趋势数据
  const anxietyTrend = useMemo(() => {
    return entries
      .filter(e => e.mood !== null)
      .slice(0, 14)
      .reverse()
      .map(e => ({
        date: e.date.slice(5),
        level: e.mood!.anxietyLevel,
        mood: e.mood!.mood,
      }));
  }, [entries]);

  // 睡眠趋势数据
  const sleepTrend = useMemo(() => {
    return entries
      .filter(e => e.sleep !== null)
      .slice(0, 14)
      .reverse()
      .map(e => ({
        date: e.date.slice(5),
        hours: e.sleep!.hours,
        quality: e.sleep!.quality === 'excellent' ? 4 : e.sleep!.quality === 'good' ? 3 : e.sleep!.quality === 'fair' ? 2 : 1,
      }));
  }, [entries]);

  // 情绪分布数据
  const moodDistribution = useMemo(() => {
    const data: Record<string, number> = {};
    entries.forEach(e => {
      if (e.mood) {
        data[e.mood.mood] = (data[e.mood.mood] || 0) + 1;
      }
    });
    return Object.entries(data).map(([name, value]) => ({
      name: {
        happy: '开心',
        calm: '平静',
        neutral: '一般',
        anxious: '焦虑',
        sad: '难过',
        overwhelmed: '压力大',
      }[name] || name,
      value,
    }));
  }, [entries]);

  // 肠胃状态数据
  const stomachData = useMemo(() => {
    const data: Record<string, number> = {};
    entries.forEach(e => {
      e.diet.forEach(d => {
        const label = {
          good: '很好',
          okay: '还好',
          uncomfortable: '不适',
          pain: '疼痛',
        }[d.stomachFeeling];
        data[label] = (data[label] || 0) + 1;
      });
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [entries]);

  const pieColors = ['#f4c2c2', '#c5b3e6', '#b5c9a8', '#f5cba7', '#e8a0a0', '#9b85c9'];

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-lavender" />
            健康统计
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            看看你的健康变化趋势
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blush" />
              <span className="text-xs text-text-secondary">总记录天数</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.totalDays}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-sage" />
              <span className="text-xs text-text-secondary">连续打卡</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.streak}<span className="text-sm font-normal text-text-secondary">天</span></p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-lavender" />
              <span className="text-xs text-text-secondary">平均焦虑</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.avgAnxiety.toFixed(1)}</p>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-peach" />
              <span className="text-xs text-text-secondary">平均睡眠</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stats.avgSleep.toFixed(1)}<span className="text-sm font-normal text-text-secondary">h</span></p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* 焦虑趋势 */}
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4 text-lavender" />
              焦虑趋势（近14天）
            </h3>
            {anxietyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={anxietyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6e6" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="level"
                    stroke="#c5b3e6"
                    strokeWidth={2}
                    dot={{ fill: '#c5b3e6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
                暂无数据，开始记录情绪吧~
              </div>
            )}
          </div>

          {/* 睡眠趋势 */}
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Moon className="w-4 h-4 text-sage" />
              睡眠时长（近14天）
            </h3>
            {sleepTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sleepTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6e6" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="hours" fill="#b5c9a8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
                暂无数据，记录睡眠吧~
              </div>
            )}
          </div>

          {/* 情绪分布 */}
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blush" />
              情绪分布
            </h3>
            {moodDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={moodDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {moodDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
                暂无数据，记录情绪吧~
              </div>
            )}
          </div>

          {/* 肠胃状态 */}
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Coffee className="w-4 h-4 text-peach" />
              肠胃状态
            </h3>
            {stomachData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stomachData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6e6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="value" fill="#f5cba7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-secondary text-sm">
                暂无数据，记录饮食吧~
              </div>
            )}
          </div>
        </div>

        {/* Insights */}
        {stats.totalDays > 3 && (
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-sage" />
              暖暖的分析
            </h3>
            <div className="space-y-3">
              {stats.avgAnxiety <= 2 && (
                <div className="p-3 rounded-xl bg-sage/10 text-sm">
                  <span className="font-medium text-text-primary">🎉 情绪稳定：</span>
                  <span className="text-text-secondary ml-1">你的平均焦虑水平很低，继续保持哦！</span>
                </div>
              )}
              {stats.avgAnxiety > 3.5 && (
                <div className="p-3 rounded-xl bg-blush/10 text-sm">
                  <span className="font-medium text-text-primary">💜 注意情绪：</span>
                  <span className="text-text-secondary ml-1">你的焦虑水平偏高，试试深呼吸或冥想放松一下~</span>
                </div>
              )}
              {stats.avgSleep >= 7 && stats.avgSleep <= 9 && (
                <div className="p-3 rounded-xl bg-sage/10 text-sm">
                  <span className="font-medium text-text-primary">😴 睡眠充足：</span>
                  <span className="text-text-secondary ml-1">你的睡眠时间很理想，对肠胃和情绪都有帮助！</span>
                </div>
              )}
              {stats.avgSleep < 6 && (
                <div className="p-3 rounded-xl bg-peach/10 text-sm">
                  <span className="font-medium text-text-primary">🌙 多休息：</span>
                  <span className="text-text-secondary ml-1">你的睡眠有点不足，试试早点睡觉吧~</span>
                </div>
              )}
              {stats.stomachIssues > 5 && (
                <div className="p-3 rounded-xl bg-peach/10 text-sm">
                  <span className="font-medium text-text-primary">🍲 饮食注意：</span>
                  <span className="text-text-secondary ml-1">你最近肠胃不适次数较多，注意饮食清淡哦~</span>
                </div>
              )}
              {stats.streak >= 7 && (
                <div className="p-3 rounded-xl bg-lavender/10 text-sm">
                  <span className="font-medium text-text-primary">🔥 坚持打卡：</span>
                  <span className="text-text-secondary ml-1">你已经连续 {stats.streak} 天了，太棒了！</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
