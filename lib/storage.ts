import { DailyEntry, DietRecord, MoodRecord, SleepRecord, PeriodRecord, ExerciseRecord } from './types';

const STORAGE_KEY = 'warm_health_entries';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getEntries(): DailyEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('读取记录失败:', error);
    return [];
  }
}

export function getEntryByDate(date: string): DailyEntry | null {
  const entries = getEntries();
  return entries.find(e => e.date === date) || null;
}

export function saveEntry(entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>): DailyEntry {
  const entries = getEntries();
  const today = getToday();

  // 查找或创建今天的记录
  const existingIndex = entries.findIndex(e => e.date === today);

  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    // 更新现有记录
    const existing = entries[existingIndex];
    entries[existingIndex] = {
      ...existing,
      ...entry,
      id: existing.id,
      updatedAt: now,
    };
  } else {
    // 创建新记录
    const newEntry: DailyEntry = {
      ...entry,
      id: generateId(),
      date: today,
      createdAt: now,
      updatedAt: now,
    };
    entries.unshift(newEntry);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries.find(e => e.date === today) || null;
  } catch (error) {
    console.error('保存记录失败:', error);
    throw error;
  }
}

export function updateEntryField<T>(field: string, value: T): DailyEntry | null {
  const entries = getEntries();
  const today = getToday();
  const index = entries.findIndex(e => e.date === today);

  if (index < 0) {
    return null;
  }

  const entry = entries[index];

  if (field === 'diet') {
    entry.diet = value as DietRecord[];
  } else if (field === 'mood') {
    entry.mood = value as MoodRecord | null;
  } else if (field === 'sleep') {
    entry.sleep = value as SleepRecord | null;
  } else if (field === 'period') {
    entry.period = value as PeriodRecord | null;
  } else if (field === 'exercise') {
    entry.exercise = value as ExerciseRecord | null;
  } else if (field === 'gratitude') {
    entry.gratitude = value as string;
  }

  entry.updatedAt = new Date().toISOString();

  try {
    entries[index] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entry;
  } catch (error) {
    console.error('更新记录失败:', error);
    return null;
  }
}

export function deleteEntry(id: string): boolean {
  const entries = getEntries();
  const filtered = entries.filter(e => e.id !== id);

  if (filtered.length === entries.length) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('删除记录失败:', error);
    return false;
  }
}

export function getStats(): {
  totalDays: number;
  streak: number;
  avgAnxiety: number;
  avgSleep: number;
  stomachIssues: number;
  moodDistribution: Record<string, number>;
} {
  const entries = getEntries();

  const totalDays = entries.length;

  // 计算连续打卡天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    if (entries.some(e => e.date === dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  // 焦虑平均值
  const moodEntries = entries.filter(e => e.mood !== null);
  const avgAnxiety = moodEntries.length > 0
    ? moodEntries.reduce((sum, e) => sum + (e.mood?.anxietyLevel || 0), 0) / moodEntries.length
    : 0;

  // 睡眠平均值
  const sleepEntries = entries.filter(e => e.sleep !== null);
  const avgSleep = sleepEntries.length > 0
    ? sleepEntries.reduce((sum, e) => sum + (e.sleep?.hours || 0), 0) / sleepEntries.length
    : 0;

  // 肠胃问题频率
  const stomachIssues = entries.reduce((count, e) => {
    return count + e.diet.filter(d => d.stomachFeeling === 'uncomfortable' || d.stomachFeeling === 'pain').length;
  }, 0);

  // 情绪分布
  const moodDistribution: Record<string, number> = {};
  entries.forEach(e => {
    if (e.mood) {
      const mood = e.mood.mood;
      moodDistribution[mood] = (moodDistribution[mood] || 0) + 1;
    }
  });

  return {
    totalDays,
    streak,
    avgAnxiety,
    avgSleep,
    stomachIssues,
    moodDistribution,
  };
}
