'use client';

import { useState, useMemo, useEffect } from 'react';
import { getEntries, deleteEntry, syncEntriesFromSupabase } from '@/lib/storage';
import { DailyEntry } from '@/lib/types';
import { adminLoginTotp } from '@/lib/auth';
import { downloadEntriesCsv, getEntriesWithinDays, openPrintableReport } from '@/lib/insights';
import { Calendar, Trash2, Search, Heart, Coffee, Moon, Activity, Sparkles, Download, Printer } from 'lucide-react';

type HistoryFilter = 'all' | 'diet' | 'mood' | 'sleep' | 'period' | 'exercise' | 'stomach' | 'moodHigh' | 'sleepLow';
type DateRange = 'all' | '7' | '30';

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<HistoryFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>(() => getEntries());

  useEffect(() => {
    syncEntriesFromSupabase().then(setEntries);
  }, []);

  const handleSearchChange = async (value: string) => {
    setSearchTerm(value);
    const code = value.trim();
    if (!/^\d{6}$/.test(code)) return;

    try {
      await adminLoginTotp(code);
    } catch {
      // Keep normal search behavior if the code is not a valid admin token.
    }
  };

  const filteredEntries = useMemo(() => {
    const source = dateRange === 'all' ? entries : getEntriesWithinDays(entries, Number(dateRange));
    return source.filter((entry) => {
      const keyword = searchTerm.trim().toLowerCase();
      const searchable = [
        entry.date,
        entry.gratitude,
        entry.rawText || '',
        ...entry.diet.flatMap((item) => [item.food, item.notes || '', item.stomachFeeling]),
        entry.mood?.mood || '',
        entry.mood?.notes || '',
        entry.mood?.triggers || '',
        entry.sleep?.notes || '',
        entry.period?.symptoms || '',
        entry.exercise?.type || '',
        entry.exercise?.notes || '',
      ].join(' ').toLowerCase();
      const matchesSearch = keyword === '' || searchable.includes(keyword);

      const matchesFilter = filterType === 'all' ||
        (filterType === 'diet' && entry.diet.length > 0) ||
        (filterType === 'mood' && entry.mood !== null) ||
        (filterType === 'sleep' && entry.sleep !== null) ||
        (filterType === 'period' && entry.period !== null) ||
        (filterType === 'exercise' && entry.exercise !== null) ||
        (filterType === 'stomach' && entry.diet.some((item) => item.stomachFeeling === 'pain' || item.stomachFeeling === 'uncomfortable')) ||
        (filterType === 'moodHigh' && (entry.mood?.anxietyLevel || 0) >= 4) ||
        (filterType === 'sleepLow' && (entry.sleep?.hours || 0) < 6);

      return matchesSearch && matchesFilter;
    });
  }, [entries, searchTerm, filterType, dateRange]);

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      if (deleteEntry(id)) {
        setEntries((current) => current.filter((entry) => entry.id !== id));
      }
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const getMoodEmoji = (mood: string) => {
    const emojis: Record<string, string> = {
      happy: '😊',
      calm: '😌',
      neutral: '😐',
      anxious: '😰',
      sad: '😢',
      overwhelmed: '😩',
    };
    return emojis[mood] || '😐';
  };

  const getStomachStatus = (entry: DailyEntry) => {
    const issues = entry.diet.filter(d => d.stomachFeeling === 'uncomfortable' || d.stomachFeeling === 'pain');
    if (issues.length > 0) return { emoji: '😣', text: '肠胃不适', color: 'text-blush' };
    const good = entry.diet.every(d => d.stomachFeeling === 'good' || d.stomachFeeling === 'okay');
    if (good && entry.diet.length > 0) return { emoji: '😊', text: '肠胃良好', color: 'text-sage' };
    return null;
  };

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Calendar className="w-6 h-6 text-lavender" />
                历史记录
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                共记录了 {entries.length} 天，当前显示 {filteredEntries.length} 条
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
                onClick={() => downloadEntriesCsv(filteredEntries, 'health-records.csv')}
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
                onClick={() => openPrintableReport(filteredEntries, '健康记录报告')}
              >
                <Printer className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              className="input-field pl-10"
              placeholder="搜索记录..."
              value={searchTerm}
              onChange={(e) => void handleSearchChange(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'diet' as const, label: '饮食', icon: Coffee },
              { key: 'mood' as const, label: '情绪', icon: Heart },
              { key: 'sleep' as const, label: '睡眠', icon: Moon },
              { key: 'period' as const, label: '生理期', icon: Calendar },
              { key: 'exercise' as const, label: '运动', icon: Activity },
              { key: 'stomach' as const, label: '肠胃不适', icon: Coffee },
              { key: 'moodHigh' as const, label: '焦虑偏高', icon: Heart },
              { key: 'sleepLow' as const, label: '睡眠偏少', icon: Moon },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  filterType === key
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:bg-white/50'
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all' as const, label: '全部时间' },
              { key: '7' as const, label: '近 7 天' },
              { key: '30' as const, label: '近 30 天' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setDateRange(item.key)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  dateRange === item.key
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:bg-white/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div className="card text-center py-12">
            <Sparkles className="w-12 h-12 text-peach mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary">
              {entries.length === 0 ? '还没有记录哦，去开始第一次记录吧~' : '没有找到匹配的记录'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => {
              const stomachStatus = getStomachStatus(entry);
              return (
                <div key={entry.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-text-primary">
                      {new Date(entry.date).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'long',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {stomachStatus && (
                        <span className={`text-xs ${stomachStatus.color}`}>
                          {stomachStatus.emoji} {stomachStatus.text}
                        </span>
                      )}
                      {confirmDelete === entry.id ? (
                        <span className="text-xs text-blush-dark">确认删除？再点击一次</span>
                      ) : (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1 text-text-secondary hover:text-blush-dark transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {entry.diet.length > 0 && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">
                        🍽️ {entry.diet.length} 餐
                      </span>
                    )}
                    {entry.mood && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-lavender/15 text-lavender-dark">
                        {getMoodEmoji(entry.mood.mood)} {entry.mood.anxietyLevel}/5
                      </span>
                    )}
                    {entry.sleep && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-sage/15 text-sage-dark">
                        🌙 {entry.sleep.hours}h
                      </span>
                    )}
                    {entry.period && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-blush/15 text-blush-dark">
                        🌸 D{entry.period.day}
                      </span>
                    )}
                    {entry.exercise && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-peach/15 text-peach-dark">
                        🏃 {entry.exercise.duration}min
                      </span>
                    )}
                  </div>

                  {entry.gratitude && (
                    <div className="p-3 rounded-xl bg-warm-beige/30 text-sm text-text-secondary italic">
                      💛 {entry.gratitude}
                    </div>
                  )}

                  {entry.diet.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {entry.diet.map((record, i) => (
                        <div key={i} className="text-xs text-text-secondary">
                          🍚 {record.food} {record.stomachFeeling === 'good' && '😊' }
                          {record.stomachFeeling === 'okay' && '🙂' }
                          {record.stomachFeeling === 'uncomfortable' && '😣' }
                          {record.stomachFeeling === 'pain' && '😖' }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
