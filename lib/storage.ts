import { DailyEntry, DietRecord, MoodRecord, SleepRecord, PeriodRecord, ExerciseRecord } from './types';
import { supabase } from './supabase';
import { getAuthSession } from './auth';

const STORAGE_KEY = 'warm_health_entries';
const TABLE_NAME = 'daily_entries';

type DailyEntryRow = {
  id: string;
  date: string;
  diet: DietRecord[] | null;
  mood: MoodRecord | null;
  sleep: SleepRecord | null;
  period: PeriodRecord | null;
  exercise: ExerciseRecord | null;
  gratitude: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
};

type RpcEntryRow = DailyEntryRow & {
  user_id?: string;
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getStorageKey(): string {
  const session = getAuthSession();
  if (session?.mode === 'user') {
    return `${STORAGE_KEY}_${session.username}`;
  }
  return STORAGE_KEY;
}

function cacheEntries(entries: DailyEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(), JSON.stringify(entries));
}

function toRow(entry: DailyEntry): DailyEntryRow {
  return {
    id: entry.id,
    date: entry.date,
    diet: entry.diet,
    mood: entry.mood,
    sleep: entry.sleep,
    period: entry.period,
    exercise: entry.exercise,
    gratitude: entry.gratitude,
    raw_text: entry.rawText || null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function fromRow(row: DailyEntryRow): DailyEntry {
  return {
    id: row.id,
    date: row.date,
    diet: row.diet || [],
    mood: row.mood,
    sleep: row.sleep,
    period: row.period,
    exercise: row.exercise,
    gratitude: row.gratitude || '',
    rawText: row.raw_text || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertEntryToSupabase(entry: DailyEntry): Promise<void> {
  if (!supabase) return;

  const session = getAuthSession();
  if (session?.mode === 'user') {
    const { error } = await supabase.rpc('app_save_entry', {
      p_session_token: session.token,
      p_entry: toRow(entry),
    });

    if (error) {
      console.error('Supabase save failed:', error);
    }
    return;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(toRow(entry), { onConflict: 'date' });

  if (error) {
    console.error('Supabase save failed:', error);
  }
}

async function deleteEntryFromSupabase(id: string): Promise<void> {
  if (!supabase) return;

  const session = getAuthSession();
  if (session?.mode === 'user') {
    const { error } = await supabase.rpc('app_delete_entry', {
      p_session_token: session.token,
      p_entry_id: id,
    });

    if (error) {
      console.error('Supabase delete failed:', error);
    }
    return;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase delete failed:', error);
  }
}

export function getEntries(): DailyEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(getStorageKey());
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Read entries failed:', error);
    return [];
  }
}

export async function syncEntriesFromSupabase(): Promise<DailyEntry[]> {
  const localEntries = getEntries();

  if (!supabase || typeof window === 'undefined') {
    return localEntries;
  }

  const session = getAuthSession();
  if (session?.mode === 'user') {
    const { data, error } = await supabase.rpc('app_get_entries', {
      p_session_token: session.token,
    });

    if (error) {
      console.error('Supabase fetch failed:', error);
      return localEntries;
    }

    const remoteEntries = ((data || []) as RpcEntryRow[]).map(fromRow);
    cacheEntries(remoteEntries);
    return remoteEntries;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Supabase fetch failed:', error);
    return localEntries;
  }

  const remoteEntries = ((data || []) as DailyEntryRow[]).map(fromRow);

  if (remoteEntries.length === 0 && localEntries.length > 0) {
    await Promise.all(localEntries.map(upsertEntryToSupabase));
    return localEntries;
  }

  cacheEntries(remoteEntries);
  return remoteEntries;
}

export function getEntryByDate(date: string): DailyEntry | null {
  const entries = getEntries();
  return entries.find(e => e.date === date) || null;
}

export function saveEntry(entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>): DailyEntry {
  const entries = getEntries();
  const date = entry.date || getToday();
  const existingIndex = entries.findIndex(e => e.date === date);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    entries[existingIndex] = {
      ...existing,
      ...entry,
      id: existing.id,
      date,
      updatedAt: now,
    };
  } else {
    const newEntry: DailyEntry = {
      ...entry,
      id: generateId(),
      date,
      createdAt: now,
      updatedAt: now,
    };
    entries.unshift(newEntry);
  }

  try {
    cacheEntries(entries);
    const savedEntry = entries.find(e => e.date === date);
    if (!savedEntry) {
      throw new Error('Saved entry not found');
    }
    void upsertEntryToSupabase(savedEntry);
    return savedEntry;
  } catch (error) {
    console.error('Save entry failed:', error);
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
    cacheEntries(entries);
    void upsertEntryToSupabase(entry);
    return entry;
  } catch (error) {
    console.error('Update entry failed:', error);
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
    cacheEntries(filtered);
    void deleteEntryFromSupabase(id);
    return true;
  } catch (error) {
    console.error('Delete entry failed:', error);
    return false;
  }
}

export function getStats(sourceEntries?: DailyEntry[]): {
  totalDays: number;
  streak: number;
  avgAnxiety: number;
  avgSleep: number;
  stomachIssues: number;
  moodDistribution: Record<string, number>;
} {
  const entries = sourceEntries || getEntries();
  const totalDays = entries.length;

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

  const moodEntries = entries.filter(e => e.mood !== null);
  const avgAnxiety = moodEntries.length > 0
    ? moodEntries.reduce((sum, e) => sum + (e.mood?.anxietyLevel || 0), 0) / moodEntries.length
    : 0;

  const sleepEntries = entries.filter(e => e.sleep !== null);
  const avgSleep = sleepEntries.length > 0
    ? sleepEntries.reduce((sum, e) => sum + (e.sleep?.hours || 0), 0) / sleepEntries.length
    : 0;

  const stomachIssues = entries.reduce((count, e) => {
    return count + e.diet.filter(d => d.stomachFeeling === 'uncomfortable' || d.stomachFeeling === 'pain').length;
  }, 0);

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
