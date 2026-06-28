'use client';

import { useState, useEffect } from 'react';
import { getEntryByDate, saveEntry, syncEntriesFromSupabase } from '@/lib/storage';
import { DailyEntry, DietRecord, MoodRecord, SleepRecord, PeriodRecord, ExerciseRecord } from '@/lib/types';
import { Coffee, Moon, Heart, Activity, Calendar, Sparkles, Save, X, Check } from 'lucide-react';

export default function RecordPage() {
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'diet' | 'mood' | 'sleep' | 'period' | 'exercise'>('diet');
  const [saved, setSaved] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let isMounted = true;

    const draftEntry = () => ({
        id: `draft-${today}`,
        date: today,
        diet: [],
        mood: null,
        sleep: null,
        period: null,
        exercise: null,
        gratitude: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    syncEntriesFromSupabase().then((entries) => {
      if (!isMounted) return;
      const existing = entries.find((item) => item.date === today) || getEntryByDate(today);
      setEntry(existing || draftEntry());
    });

    return () => {
      isMounted = false;
    };
  }, [today]);

  if (!entry) return null;

  const handleSave = () => {
    const savedEntry = saveEntry({
      date: entry.date,
      diet: entry.diet,
      mood: entry.mood,
      sleep: entry.sleep,
      period: entry.period,
      exercise: entry.exercise,
      gratitude: entry.gratitude,
    });
    setEntry(savedEntry);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-peach" />
              今日记录
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {new Date(today).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          </div>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存' : '保存'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'diet' as const, label: '饮食', icon: Coffee, color: 'text-peach' },
            { key: 'mood' as const, label: '情绪', icon: Heart, color: 'text-blush' },
            { key: 'sleep' as const, label: '睡眠', icon: Moon, color: 'text-sage' },
            { key: 'period' as const, label: '生理期', icon: Calendar, color: 'text-lavender' },
            { key: 'exercise' as const, label: '运动', icon: Activity, color: 'text-peach' },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key
                  ? `${color} bg-white shadow-sm`
                  : 'text-text-secondary hover:bg-white/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card mb-6">
          {activeTab === 'diet' && <DietTab entry={entry} setEntry={setEntry} />}
          {activeTab === 'mood' && <MoodTab entry={entry} setEntry={setEntry} />}
          {activeTab === 'sleep' && <SleepTab entry={entry} setEntry={setEntry} />}
          {activeTab === 'period' && <PeriodTab entry={entry} setEntry={setEntry} />}
          {activeTab === 'exercise' && <ExerciseTab entry={entry} setEntry={setEntry} />}
        </div>

        {/* Gratitude */}
        <div className="card">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-peach" />
            今日感恩
          </h3>
          <p className="text-text-secondary text-sm mb-3">写下今天让你感到温暖或感恩的小事</p>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="今天感恩的事情..."
            value={entry.gratitude}
            onChange={(e) => setEntry({ ...entry, gratitude: e.target.value })}
          />
        </div>
      </div>
    </main>
  );
}

// 饮食记录
function DietTab({ entry, setEntry }: { entry: DailyEntry; setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> }) {
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [food, setFood] = useState('');
  const [stomachFeeling, setStomachFeeling] = useState<'good' | 'okay' | 'uncomfortable' | 'pain'>('okay');
  const [notes, setNotes] = useState('');

  const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
  const stomachLabels = { good: '😊 很好', okay: '🙂 还好', uncomfortable: '😣 不舒服', pain: '😖 疼痛' };

  const addMeal = () => {
    if (!food.trim()) return;
    const newRecord: DietRecord = {
      mealType,
      food: food.trim(),
      stomachFeeling,
      notes: notes.trim() || undefined,
    };
    setEntry({ ...entry, diet: [...entry.diet, newRecord] });
    setFood('');
    setNotes('');
  };

  const removeMeal = (index: number) => {
    setEntry({ ...entry, diet: entry.diet.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary mb-1 block">餐次</label>
          <select
            className="input-field"
            value={mealType}
            onChange={(e) => setMealType(e.target.value as typeof mealType)}
          >
            <option value="breakfast">{mealLabels.breakfast}</option>
            <option value="lunch">{mealLabels.lunch}</option>
            <option value="dinner">{mealLabels.dinner}</option>
            <option value="snack">{mealLabels.snack}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary mb-1 block">吃了什么</label>
          <input
            className="input-field"
            placeholder="例如：小米粥、蒸蛋"
            value={food}
            onChange={(e) => setFood(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-2 block">肠胃感受</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(stomachLabels) as Array<keyof typeof stomachLabels>).map((key) => (
            <button
              key={key}
              onClick={() => setStomachFeeling(key)}
              className={`p-2 rounded-xl text-xs font-medium transition-all ${
                stomachFeeling === key
                  ? 'bg-blush/15 text-blush-dark ring-2 ring-blush/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {stomachLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">备注（可选）</label>
        <input
          className="input-field"
          placeholder="例如：吃太快了、有点辣"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button onClick={addMeal} className="btn-primary w-full">
        添加饮食记录
      </button>

      {entry.diet.length > 0 && (
        <div className="space-y-2 mt-4">
          {entry.diet.map((record, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-warm-beige/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-peach-dark">{mealLabels[record.mealType]}</span>
                  <span className="text-sm font-medium text-text-primary">{record.food}</span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {stomachLabels[record.stomachFeeling]}
                  {record.notes && ` · ${record.notes}`}
                </div>
              </div>
              <button onClick={() => removeMeal(index)} className="p-1 text-text-secondary hover:text-blush-dark">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 情绪记录
function MoodTab({ entry, setEntry }: { entry: DailyEntry; setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> }) {
  const moods = [
    { value: 'happy', label: '😊', text: '开心' },
    { value: 'calm', label: '😌', text: '平静' },
    { value: 'neutral', label: '😐', text: '一般' },
    { value: 'anxious', label: '😰', text: '焦虑' },
    { value: 'sad', label: '😢', text: '难过' },
    { value: 'overwhelmed', label: '😩', text: '压力大' },
  ];

  const anxietyLevels = [1, 2, 3, 4, 5];
  const anxietyLabels = ['很放松', '有点放松', '一般', '有点焦虑', '很焦虑'];

  const currentMood = entry.mood;

  const updateMood = (moodData: Partial<MoodRecord>) => {
    const newMood: MoodRecord = currentMood
      ? { ...currentMood, ...moodData }
      : { mood: 'neutral', anxietyLevel: 3, ...moodData };

    setEntry({ ...entry, mood: newMood });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">现在的心情怎么样？</label>
        <div className="grid grid-cols-3 gap-3">
          {moods.map((m) => (
            <button
              key={m.value}
              onClick={() => updateMood({ mood: m.value as MoodRecord['mood'] })}
              className={`p-3 rounded-xl text-center transition-all ${
                currentMood?.mood === m.value
                  ? 'bg-blush/15 ring-2 ring-blush/30'
                  : 'bg-warm-beige/30 hover:bg-warm-beige/60'
              }`}
            >
              <div className="text-2xl mb-1">{m.label}</div>
              <div className="text-xs font-medium text-text-secondary">{m.text}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">焦虑程度</label>
        <div className="flex gap-2">
          {anxietyLevels.map((level) => (
            <button
              key={level}
              onClick={() => updateMood({ anxietyLevel: level as MoodRecord['anxietyLevel'] })}
              className={`flex-1 p-2 rounded-xl text-xs font-medium transition-all ${
                currentMood?.anxietyLevel === level
                  ? 'bg-lavender/20 text-lavender-dark ring-2 ring-lavender/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {level}
              <div className="mt-1">{anxietyLabels[level - 1]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">触发因素（可选）</label>
        <input
          className="input-field"
          placeholder="是什么让你感到焦虑？例如：工作、人际关系..."
          value={currentMood?.triggers || ''}
          onChange={(e) => updateMood({ triggers: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">备注（可选）</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="记录此刻的想法和感受..."
          value={currentMood?.notes || ''}
          onChange={(e) => updateMood({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// 睡眠记录
function SleepTab({ entry, setEntry }: { entry: DailyEntry; setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> }) {
  const currentSleep = entry.sleep;

  const updateSleep = (sleepData: Partial<SleepRecord>) => {
    const newSleep: SleepRecord = currentSleep
      ? { ...currentSleep, ...sleepData }
      : { hours: 7, quality: 'good', ...sleepData };
    setEntry({ ...entry, sleep: newSleep });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-text-secondary mb-2 block">睡了几个小时？</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={currentSleep?.hours || 7}
            onChange={(e) => updateSleep({ hours: parseFloat(e.target.value) })}
            className="flex-1 accent-lavender"
          />
          <span className="text-2xl font-bold text-text-primary min-w-[60px] text-right">
            {currentSleep?.hours || 7}<span className="text-sm font-normal text-text-secondary">h</span>
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">睡眠质量</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'excellent', label: '💤 很好' },
            { value: 'good', label: '😴 不错' },
            { value: 'fair', label: '😐 一般' },
            { value: 'poor', label: '😫 很差' },
          ].map((q) => (
            <button
              key={q.value}
              onClick={() => updateSleep({ quality: q.value as SleepRecord['quality'] })}
              className={`p-3 rounded-xl text-xs font-medium transition-all ${
                currentSleep?.quality === q.value
                  ? 'bg-sage/15 text-sage-dark ring-2 ring-sage/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">备注（可选）</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="例如：半夜醒了两次、做了噩梦..."
          value={currentSleep?.notes || ''}
          onChange={(e) => updateSleep({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// 生理期记录
function PeriodTab({ entry, setEntry }: { entry: DailyEntry; setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> }) {
  const currentPeriod = entry.period;

  const updatePeriod = (periodData: Partial<PeriodRecord>) => {
    const newPeriod: PeriodRecord = currentPeriod
      ? { ...currentPeriod, ...periodData }
      : { day: 1, flow: 'medium', ...periodData };
    setEntry({ ...entry, period: newPeriod });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">今天是第几天？</label>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 'none' as const].map((day) => (
            <button
              key={day}
              onClick={() => updatePeriod({ day: day === 'none' ? 'none' : (day as PeriodRecord['day']) })}
              className={`p-2 rounded-xl text-xs font-medium transition-all ${
                currentPeriod?.day === day
                  ? 'bg-lavender/15 text-lavender-dark ring-2 ring-lavender/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {day === 'none' ? '无' : `D${day}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">流量</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'spotting', label: '点滴' },
            { value: 'light', label: '量少' },
            { value: 'medium', label: '中等' },
            { value: 'heavy', label: '量大' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => updatePeriod({ flow: f.value as PeriodRecord['flow'] })}
              className={`p-2 rounded-xl text-xs font-medium transition-all ${
                currentPeriod?.flow === f.value
                  ? 'bg-blush/15 text-blush-dark ring-2 ring-blush/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">症状（可选）</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="例如：小腹坠痛、腰酸、乳房胀痛..."
          value={currentPeriod?.symptoms || ''}
          onChange={(e) => updatePeriod({ symptoms: e.target.value })}
        />
      </div>
    </div>
  );
}

// 运动记录
function ExerciseTab({ entry, setEntry }: { entry: DailyEntry; setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> }) {
  const currentExercise = entry.exercise;

  const updateExercise = (exerciseData: Partial<ExerciseRecord>) => {
    const newExercise: ExerciseRecord = currentExercise
      ? { ...currentExercise, ...exerciseData }
      : { type: '', duration: 30, intensity: 'light', ...exerciseData };
    setEntry({ ...entry, exercise: newExercise });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">运动类型</label>
        <input
          className="input-field"
          placeholder="例如：散步、瑜伽、跑步..."
          value={currentExercise?.type || ''}
          onChange={(e) => updateExercise({ type: e.target.value })}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-2 block">运动时长（分钟）</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={120}
            step={5}
            value={currentExercise?.duration || 30}
            onChange={(e) => updateExercise({ duration: parseInt(e.target.value) })}
            className="flex-1 accent-peach"
          />
          <span className="text-xl font-bold text-text-primary min-w-[60px] text-right">
            {currentExercise?.duration || 30}<span className="text-sm font-normal text-text-secondary">min</span>
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-3 block">运动强度</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'light', label: '🚶 轻度' },
            { value: 'moderate', label: '🏃 中度' },
            { value: 'vigorous', label: '🏋️ 剧烈' },
          ].map((i) => (
            <button
              key={i.value}
              onClick={() => updateExercise({ intensity: i.value as ExerciseRecord['intensity'] })}
              className={`p-2 rounded-xl text-xs font-medium transition-all ${
                currentExercise?.intensity === i.value
                  ? 'bg-peach/15 text-peach-dark ring-2 ring-peach/30'
                  : 'bg-warm-beige/30 text-text-secondary hover:bg-warm-beige/60'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary mb-1 block">备注（可选）</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="运动后的感受..."
          value={currentExercise?.notes || ''}
          onChange={(e) => updateExercise({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
