// 数据类型定义

export interface DietRecord {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food: string;
  stomachFeeling: 'good' | 'okay' | 'uncomfortable' | 'pain';
  notes?: string;
}

export interface MoodRecord {
  mood: 'happy' | 'calm' | 'neutral' | 'anxious' | 'sad' | 'overwhelmed';
  anxietyLevel: 1 | 2 | 3 | 4 | 5;
  triggers?: string;
  notes?: string;
}

export interface SleepRecord {
  hours: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string;
}

export interface PeriodRecord {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'none';
  flow: 'light' | 'medium' | 'heavy' | 'spotting';
  symptoms?: string;
}

export interface ExerciseRecord {
  type: string;
  duration: number;
  intensity: 'light' | 'moderate' | 'vigorous';
  notes?: string;
}

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  diet: DietRecord[];
  mood: MoodRecord | null;
  sleep: SleepRecord | null;
  period: PeriodRecord | null;
  exercise: ExerciseRecord | null;
  gratitude: string;
  rawText?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecordType = 'diet' | 'mood' | 'sleep' | 'period' | 'exercise';
