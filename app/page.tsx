'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart, PenSquare, TrendingUp, Calendar, Sparkles, Coffee, Moon, Smile, Activity, Wand2, Award, Bell } from 'lucide-react';
import { getEntries, getStats, syncEntriesFromSupabase } from '@/lib/storage';
import { DailyEntry } from '@/lib/types';
import { buildHealthAlerts, buildStreakMessage, buildWeeklySummary } from '@/lib/insights';

export default function HomePage() {
  const [entries, setEntries] = useState<DailyEntry[]>(() => getEntries());
  const stats = useMemo(() => getStats(entries), [entries]);
  const weeklySummary = useMemo(() => buildWeeklySummary(entries), [entries]);
  const alerts = useMemo(() => buildHealthAlerts(entries), [entries]);

  useEffect(() => {
    syncEntriesFromSupabase().then(setEntries);
  }, []);
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了，好好休息哦 🌙';
    if (hour < 12) return '早上好呀，今天也要照顾好自己 💛';
    if (hour < 14) return '中午好，记得好好吃饭哦 🍚';
    if (hour < 18) return '下午好，喝杯温水吧 🫖';
    return '晚上好，辛苦了一天啦 🌸';
  })();

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-peach" />
            <p className="text-text-secondary text-sm">{today}</p>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{greeting}</h1>
          <p className="text-text-secondary text-sm">
            {stats.totalDays > 0
              ? buildStreakMessage(stats.totalDays, stats.streak)
              : '今天还没有记录哦，来记录一下吧~'
            }
          </p>
        </div>

        {stats.totalDays > 0 && (
          <div className="grid md:grid-cols-[1.4fr_1fr] gap-4 mb-8">
            <section className="card">
              <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-peach" />
                本周温柔总结
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed">{weeklySummary}</p>
            </section>

            <section className="card">
              <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-lavender-dark" />
                小成就
              </h2>
              <p className="text-2xl font-bold text-text-primary">{stats.streak}<span className="text-sm font-normal text-text-secondary"> 天</span></p>
              <p className="text-sm text-text-secondary mt-1">连续陪自己记录</p>
            </section>
          </div>
        )}

        {/* Quick Stats */}
        {stats.totalDays > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Smile className="w-4 h-4 text-lavender" />
                <span className="text-xs text-text-secondary">平均焦虑</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {stats.avgAnxiety.toFixed(1)}
                <span className="text-sm font-normal text-text-secondary">/5</span>
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Moon className="w-4 h-4 text-sage" />
                <span className="text-xs text-text-secondary">平均睡眠</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {stats.avgSleep.toFixed(1)}
                <span className="text-sm font-normal text-text-secondary">h</span>
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-peach" />
                <span className="text-xs text-text-secondary">肠胃不适</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {stats.stomachIssues}
                <span className="text-sm font-normal text-text-secondary">次</span>
              </p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blush" />
                <span className="text-xs text-text-secondary">总记录</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {stats.totalDays}
                <span className="text-sm font-normal text-text-secondary">天</span>
              </p>
            </div>
          </div>
        )}

        {stats.totalDays > 0 && alerts.length > 0 && (
          <div className="card mb-8">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-sage-dark" />
              最近提醒
            </h3>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert} className="rounded-xl bg-warm-beige/45 px-3 py-2 text-sm text-text-secondary">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link href="/record?mode=lazy" className="card group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lavender/15 flex items-center justify-center group-hover:bg-lavender/25 transition-colors">
                <Wand2 className="w-6 h-6 text-lavender-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">懒人记录</h3>
                <p className="text-sm text-text-secondary">一句话输入，自动归类并保存</p>
              </div>
            </div>
          </Link>

          <Link href="/record" className="card group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blush/15 flex items-center justify-center group-hover:bg-blush/25 transition-colors">
                <PenSquare className="w-6 h-6 text-blush-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">开始记录</h3>
                <p className="text-sm text-text-secondary">记录今天的饮食、情绪和睡眠</p>
              </div>
            </div>
          </Link>

          <Link href="/stats" className="card group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lavender/15 flex items-center justify-center group-hover:bg-lavender/25 transition-colors">
                <TrendingUp className="w-6 h-6 text-lavender-dark" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">查看趋势</h3>
                <p className="text-sm text-text-secondary">看看你的健康变化</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Health Tips */}
        <div className="card mb-8">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-blush" />
            暖暖的小贴士
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warm-beige/50">
              <Coffee className="w-5 h-5 text-peach mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary text-sm">饮食注意</p>
                <p className="text-text-secondary text-sm mt-0.5">
                  肠胃不好的话，尽量少吃生冷辛辣的食物。温热软烂的食物更容易消化哦~
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warm-beige/50">
              <Smile className="w-5 h-5 text-lavender mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary text-sm">情绪管理</p>
                <p className="text-text-secondary text-sm mt-0.5">
                  焦虑的时候试试深呼吸：吸气4秒，屏住4秒，呼气6秒。重复几次会感觉好很多。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warm-beige/50">
              <Moon className="w-5 h-5 text-sage mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-text-primary text-sm">好好睡觉</p>
                <p className="text-text-secondary text-sm mt-0.5">
                  保证7-8小时的睡眠对肠胃和情绪都很重要。睡前可以泡个脚或者喝杯温牛奶。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Entries */}
        {entries.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary">最近记录</h3>
              <Link href="/history" className="text-sm text-blush-dark hover:underline">
                查看全部
              </Link>
            </div>
            <div className="space-y-3">
              {entries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">
                      {new Date(entry.date).toLocaleDateString('zh-CN', {
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.diet.length > 0 && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">
                        {entry.diet.length} 餐
                      </span>
                    )}
                    {entry.mood && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-lavender/15 text-lavender-dark">
                        {entry.mood.mood === 'happy' && '😊 开心' }
                        {entry.mood.mood === 'calm' && '😌 平静' }
                        {entry.mood.mood === 'neutral' && '😐 一般' }
                        {entry.mood.mood === 'anxious' && '😰 焦虑' }
                        {entry.mood.mood === 'sad' && '😢 难过' }
                        {entry.mood.mood === 'overwhelmed' && '😩 压力大' }
                      </span>
                    )}
                    {entry.sleep && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-sage/15 text-sage-dark">
                        睡 {entry.sleep.hours}h
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
