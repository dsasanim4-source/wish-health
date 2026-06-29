'use client';

import { useState, useEffect, useRef } from 'react';
import { getEntries, getEntryByDate, saveEntry, syncEntriesFromSupabase } from '@/lib/storage';
import { DailyEntry, DietRecord, MoodRecord, SleepRecord, PeriodRecord, ExerciseRecord } from '@/lib/types';
import { getAuthSession } from '@/lib/auth';
import { encouragementStyles, getEncouragementStyle, saveEncouragementStyle, type EncouragementStyle } from '@/lib/insights';
import { Coffee, Moon, Heart, Activity, Calendar, Sparkles, Save, X, Check, Mic, MicOff, Wand2, SlidersHorizontal } from 'lucide-react';

type SpeechResultAlternative = { transcript: string };
type SpeechResult = { 0: SpeechResultAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechRecognitionEventLike = { results: SpeechResultList };
type SpeechRecognitionErrorEventLike = { error?: string };
type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

export default function RecordPage() {
  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'diet' | 'mood' | 'sleep' | 'period' | 'exercise'>('diet');
  const [saved, setSaved] = useState(false);
  const [encouragement, setEncouragement] = useState('');
  const [lazyMode, setLazyMode] = useState(false);
  const [encouragementStyle, setEncouragementStyle] = useState<EncouragementStyle>('gentle');
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftNotice, setDraftNotice] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    void Promise.resolve().then(() => setEncouragementStyle(getEncouragementStyle()));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'lazy') {
      void Promise.resolve().then(() => setLazyMode(true));
    }
  }, []);

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
      const draft = readDraftEntry(today);
      setEntry(draft || existing || draftEntry());
      if (draft) {
        setDraftDirty(true);
        setDraftNotice('已恢复上次未保存的草稿。');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [today]);

  useEffect(() => {
    if (!entry || !draftDirty) return;
    writeDraftEntry(today, entry);
    void Promise.resolve().then(() => setDraftNotice('草稿已自动保存。'));
  }, [entry, draftDirty, today]);

  if (!entry) return null;

  const updateEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>> = (nextEntry) => {
    setDraftDirty(true);
    setEntry(nextEntry);
  };

  const getEncouragement = (savedEntry: DailyEntry, style: EncouragementStyle) => {
    const pick = (messages: string[]) => messages[Math.floor(Math.random() * messages.length)];
    const styled = (kind: EncouragementKind) => pick(encouragementMessages[style][kind]);
    const completedSections = [
      savedEntry.diet.length > 0,
      Boolean(savedEntry.mood),
      Boolean(savedEntry.sleep),
      Boolean(savedEntry.period),
      Boolean(savedEntry.exercise),
      Boolean(savedEntry.gratitude.trim()),
    ].filter(Boolean).length;

    if (savedEntry.sleep && savedEntry.sleep.hours < 6) {
      return styled('lowSleep');
    }

    if (savedEntry.mood && savedEntry.mood.anxietyLevel >= 4) {
      return styled('highAnxiety');
    }

    if (savedEntry.diet.some((item) => item.stomachFeeling === 'pain' || item.stomachFeeling === 'uncomfortable')) {
      return styled('stomach');
    }

    if (completedSections >= 4) {
      return styled('complete');
    }

    if (savedEntry.exercise) {
      return styled('exercise');
    }

    if (savedEntry.gratitude.trim()) {
      return styled('gratitude');
    }

    if (savedEntry.rawText?.trim()) {
      return styled('lazy');
    }

    return styled('base');
  };

  const persistEntry = (targetEntry: DailyEntry) => {
    const savedEntry = saveEntry({
      date: targetEntry.date,
      diet: targetEntry.diet,
      mood: targetEntry.mood,
      sleep: targetEntry.sleep,
      period: targetEntry.period,
      exercise: targetEntry.exercise,
      gratitude: targetEntry.gratitude,
      rawText: targetEntry.rawText,
    });
    setEntry(savedEntry);
    removeDraftEntry(today);
    setDraftDirty(false);
    setDraftNotice('');
    setEncouragement(getEncouragement(savedEntry, encouragementStyle));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSave = () => {
    persistEntry(entry);
  };

  const updateEncouragementStyle = (style: EncouragementStyle) => {
    setEncouragementStyle(style);
    saveEncouragementStyle(style);
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
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
              <select
                className="input-field py-2 px-3 text-sm"
                value={encouragementStyle}
                onChange={(event) => updateEncouragementStyle(event.target.value as EncouragementStyle)}
              >
                {encouragementStyles.map((style) => (
                  <option key={style.key} value={style.key}>{style.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setLazyMode((value) => !value)}
              className={`btn-secondary flex items-center gap-2 ${lazyMode ? 'bg-lavender/10 text-lavender-dark border-lavender' : ''}`}
            >
              <Wand2 className="w-4 h-4" />
              {lazyMode ? '普通模式' : '懒人模式'}
            </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '已保存' : '保存'}
          </button>
          </div>
        </div>

        {encouragement && (
          <div className="mb-6 rounded-2xl bg-sage/15 text-sage-dark px-4 py-3 text-sm font-medium">
            {encouragement}
          </div>
        )}

        <div className="md:hidden mb-4 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-text-secondary" />
          <select
            className="input-field py-2 px-3 text-sm"
            value={encouragementStyle}
            onChange={(event) => updateEncouragementStyle(event.target.value as EncouragementStyle)}
          >
            {encouragementStyles.map((style) => (
              <option key={style.key} value={style.key}>{style.label}</option>
            ))}
          </select>
        </div>

        {draftNotice && (
          <div className="mb-4 rounded-2xl bg-warm-beige/50 px-4 py-3 text-xs text-text-secondary">
            {draftNotice}
          </div>
        )}

        {lazyMode ? (
          <LazyModeCard entry={entry} setEntry={updateEntry} onSave={persistEntry} />
        ) : (
          <>
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
          {activeTab === 'diet' && <DietTab entry={entry} setEntry={updateEntry} />}
          {activeTab === 'mood' && <MoodTab entry={entry} setEntry={updateEntry} />}
          {activeTab === 'sleep' && <SleepTab entry={entry} setEntry={updateEntry} />}
          {activeTab === 'period' && <PeriodTab entry={entry} setEntry={updateEntry} />}
          {activeTab === 'exercise' && <ExerciseTab entry={entry} setEntry={updateEntry} />}
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
            onChange={(e) => updateEntry({ ...entry, gratitude: e.target.value })}
          />
        </div>
          </>
        )}
      </div>
    </main>
  );
}

type EncouragementKind = 'base' | 'lowSleep' | 'highAnxiety' | 'stomach' | 'complete' | 'exercise' | 'gratitude' | 'lazy';

const encouragementMessages: Record<EncouragementStyle, Record<EncouragementKind, string[]>> = {
  gentle: {
    base: [
      '你又认真照顾了自己一次，这件小事很珍贵。',
      '谢谢你把今天交给记录，慢慢来已经很好了。',
      '记录不是打分，是陪你看见自己。你做得很好。',
      '今天的记录已经收好，你可以轻轻松一口气了。',
    ],
    lowSleep: [
      '今天睡得有点少，已经记录下来了，今晚尽量早点休息，好好把电充回来。',
      '能把睡眠不足记录下来很重要，身体的提醒已经被你接住了。',
    ],
    highAnxiety: [
      '焦虑被看见以后，就不再是一个人扛着它了。先慢慢呼吸，你已经做得很棒。',
      '今天情绪很重，但你仍然完成了记录，这一步很值得肯定。',
    ],
    stomach: [
      '肠胃不舒服也被认真记下来了，接下来给自己一点清淡和温热。',
      '你已经捕捉到身体的小信号了，之后会更容易找到舒服的节奏。',
    ],
    complete: [
      '今天记录得很完整，身体、情绪和生活都被温柔地照顾到了。',
      '这一条记录信息很丰富，之后回看时会特别有帮助。',
    ],
    exercise: [
      '运动也记录好了，哪怕只是动一动，身体都会收到这份善意。',
      '你把运动这件事落到了记录里，很棒，节奏正在慢慢建立。',
    ],
    gratitude: [
      '今天的温暖小事已经收好，愿它在你需要的时候再亮一下。',
      '谢谢你把今天值得珍惜的部分留下来了。',
    ],
    lazy: [
      '懒人模式也完成得很好，想到什么就先记下来，本来就是一种照顾。',
      '你用最省力的方式完成了记录，这很聪明，也很温柔。',
    ],
  },
  direct: {
    base: ['已保存。你完成了一次有效记录。', '记录完成。今天的状态已经留下来了。'],
    lowSleep: ['已保存。睡眠偏少，今晚优先休息。', '记录完成。最近先把补觉放到前面。'],
    highAnxiety: ['已保存。焦虑偏高，先降低今天剩余任务量。', '记录完成。情绪负荷高，先给自己留缓冲。'],
    stomach: ['已保存。肠胃不适已记录，接下来饮食先清淡。', '记录完成。今天避免刺激性食物。'],
    complete: ['记录很完整。后续复盘会更有价值。', '已保存。今天的信息足够清楚。'],
    exercise: ['运动已记录。继续保持可执行的节奏。', '已保存。活动量已经纳入记录。'],
    gratitude: ['感恩已记录。保留这条正向线索。', '已保存。今天的积极事件已经留下。'],
    lazy: ['懒人记录已保存。原文和归类都已保留。', '已保存。用低成本方式完成记录，很有效。'],
  },
  energetic: {
    base: ['完成了！又给自己加了一点照顾。', '漂亮，今天的记录已入账。'],
    lowSleep: ['记录好了！今晚早点补能量，明天会轻一点。', '收到睡眠提醒，今天先把休息安排上。'],
    highAnxiety: ['你在高压下也完成了记录，这很强。先稳住呼吸。', '情绪很满也没有放弃照顾自己，做得好。'],
    stomach: ['身体信号抓到了！接下来给肠胃一点舒服空间。', '这条很关键，记录下来就更容易调整。'],
    complete: ['今天记录得很全，复盘素材很扎实。', '一口气照顾了好几个维度，很有行动力。'],
    exercise: ['运动也记上了，身体会收到这份投入。', '活动完成并记录，节奏感正在起来。'],
    gratitude: ['这条温暖被留下了，很好。', '把好事收进记录里，今天多了一点亮色。'],
    lazy: ['懒人模式完成，省力但不敷衍。', '一句话也能照顾自己，这步很聪明。'],
  },
  minimal: {
    base: ['已保存。', '记录完成。'],
    lowSleep: ['已保存。今晚多休息。', '睡眠偏少，已记录。'],
    highAnxiety: ['已保存。先放慢。', '焦虑偏高，已记录。'],
    stomach: ['已保存。饮食清淡些。', '肠胃不适，已记录。'],
    complete: ['记录完整。', '保存完成。'],
    exercise: ['运动已记录。', '已保存。'],
    gratitude: ['感恩已记录。', '已保存。'],
    lazy: ['懒人记录已保存。', '已保存。'],
  },
};

function draftStorageKey(date: string): string {
  const session = getAuthSession();
  const owner = session?.mode === 'user' ? session.username : 'guest';
  return `warm_health_draft_${owner}_${date}`;
}

function readDraftEntry(date: string): DailyEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(draftStorageKey(date));
    return raw ? JSON.parse(raw) as DailyEntry : null;
  } catch {
    return null;
  }
}

function writeDraftEntry(date: string, entry: DailyEntry): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(draftStorageKey(date), JSON.stringify({
    ...entry,
    updatedAt: new Date().toISOString(),
  }));
}

function removeDraftEntry(date: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(draftStorageKey(date));
}

// 饮食记录
function LazyModeCard({
  entry,
  setEntry,
  onSave,
}: {
  entry: DailyEntry;
  setEntry: React.Dispatch<React.SetStateAction<DailyEntry | null>>;
  onSave: (entry: DailyEntry) => void;
}) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [summary, setSummary] = useState<string[]>([]);
  const [pendingEntry, setPendingEntry] = useState<DailyEntry | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const pendingPreview = pendingEntry ? buildLazyPreview(pendingEntry) : [];

  useEffect(() => {
    const speechWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const supported = Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
    void Promise.resolve().then(() => setSpeechSupported(supported));
  }, []);

  const updateText = (value: string) => {
    setText(value);
    setPendingEntry(null);
    setSummary([]);
  };

  const previewInput = () => {
    if (!text.trim()) {
      setSummary(['先输入一段今天的记录，再进行归类预览。']);
      return;
    }
    const { nextEntry, recognized } = classifyLazyInput(entry, text);
    setPendingEntry(nextEntry);
    setSummary([...recognized, '请确认预览无误后再保存']);
  };

  const confirmSave = () => {
    if (!pendingEntry) {
      previewInput();
      return;
    }

    setEntry(pendingEntry);
    onSave(pendingEntry);
    setText('');
    setPendingEntry(null);
    setSummary(['已保存']);
  };

  const loadRecentTemplate = () => {
    const latest = getEntries()
      .filter((item) => item.date !== entry.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (!latest) {
      setSummary(['还没有最近记录可以套用。']);
      return;
    }

    const template = entryToLazyTemplate(latest);
    if (!template) {
      setSummary(['最近记录内容太少，暂时无法生成模板。']);
      return;
    }

    setText(template);
    setPendingEntry(null);
    setSummary(['已套用最近一条记录，保存前可以直接修改文字。']);
  };

  const toggleSpeech = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as Window & typeof globalThis & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setSpeechSupported(false);
      setSummary(['当前浏览器不支持语音转文字，可以直接打字输入。']);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => {
        return event.results[index][0].transcript;
      }).join(' ');
      setText((current) => {
        const separator = current && !current.endsWith('\n') ? '\n' : '';
        return `${current}${separator}${transcript}`;
      });
      setPendingEntry(null);
    };
    recognition.onerror = () => {
      setSummary(['语音识别没有成功，可以再点一次麦克风或直接输入。']);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-lavender-dark" />
            懒人模式
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            一个框里随便写，系统会自动归到饮食、情绪、睡眠、生理期、运动和今日感恩。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={loadRecentTemplate} className="btn-secondary">
            套用最近模板
          </button>
          <button
            type="button"
            onClick={toggleSpeech}
            disabled={!speechSupported}
            className={`btn-secondary flex items-center justify-center gap-2 disabled:opacity-60 ${listening ? 'bg-blush/10 text-blush-dark border-blush' : ''}`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {listening ? '停止听写' : '语音输入'}
          </button>
        </div>
      </div>

      <textarea
        className="input-field resize-none min-h-[180px]"
        value={text}
        onChange={(event) => updateText(event.target.value)}
        placeholder="照着说就行：早饭喝了小米粥，胃有点胀；今天心情焦虑 4 分；昨晚睡了 6 小时，质量一般；生理期第 2 天，量中等；散步 20 分钟；今天感谢朋友陪我聊天。"
      />
      <p className="mt-2 text-xs text-text-secondary">
        {speechSupported ? '语音输入会把识别结果追加到文本框，确认前都可以修改。' : '当前浏览器不支持语音转文字，可以直接打字输入。'}
      </p>

      <div className="grid md:grid-cols-3 gap-2 mt-3 text-xs text-text-secondary">
        <div className="rounded-xl bg-warm-beige/40 p-3">饮食：吃了什么，胃舒服吗</div>
        <div className="rounded-xl bg-warm-beige/40 p-3">情绪：开心、焦虑、压力几分</div>
        <div className="rounded-xl bg-warm-beige/40 p-3">睡眠：睡了几小时，质量如何</div>
        <div className="rounded-xl bg-warm-beige/40 p-3">生理期：第几天，量多量少</div>
        <div className="rounded-xl bg-warm-beige/40 p-3">运动：做了什么，多久</div>
        <div className="rounded-xl bg-warm-beige/40 p-3">感恩：今天让你暖一下的事</div>
      </div>

      {summary.length > 0 && (
        <div className="mt-4 rounded-2xl bg-sage/15 px-4 py-3 text-sm text-sage-dark">
          {summary.join('；')}
        </div>
      )}

      {pendingEntry && (
        <div className="mt-4 border-t border-warm-beige pt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">归类预览</h3>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-text-secondary">
            {pendingPreview.map((item) => (
              <div key={item} className="rounded-xl bg-white/60 px-3 py-2">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-2 mt-4">
        <button className="btn-secondary flex-1" onClick={previewInput}>
          预览归类
        </button>
        <button className="btn-primary flex-1" onClick={confirmSave}>
          确认保存
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            setText('');
            setSummary([]);
            setPendingEntry(null);
          }}
        >
          清空
        </button>
      </div>
    </div>
  );
}

const lazyMealLabels: Record<DietRecord['mealType'], string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

const lazyStomachLabels: Record<DietRecord['stomachFeeling'], string> = {
  good: '很好',
  okay: '还好',
  uncomfortable: '不舒服',
  pain: '疼痛',
};

const lazyMoodLabels: Record<MoodRecord['mood'], string> = {
  happy: '开心',
  calm: '平静',
  neutral: '一般',
  anxious: '焦虑',
  sad: '难过',
  overwhelmed: '压力大',
};

const lazySleepLabels: Record<SleepRecord['quality'], string> = {
  excellent: '很好',
  good: '不错',
  fair: '一般',
  poor: '很差',
};

const lazyFlowLabels: Record<PeriodRecord['flow'], string> = {
  spotting: '点滴',
  light: '量少',
  medium: '中等',
  heavy: '量大',
};

const lazyIntensityLabels: Record<ExerciseRecord['intensity'], string> = {
  light: '轻度',
  moderate: '中度',
  vigorous: '剧烈',
};

function buildLazyPreview(entry: DailyEntry): string[] {
  const preview: string[] = [];

  if (entry.diet.length > 0) {
    preview.push(`饮食：${entry.diet.map((item) => `${lazyMealLabels[item.mealType]} ${item.food}`).join('；')}`);
  }

  if (entry.mood) {
    preview.push(`情绪：${lazyMoodLabels[entry.mood.mood]}，焦虑 ${entry.mood.anxietyLevel}/5`);
  }

  if (entry.sleep) {
    preview.push(`睡眠：${entry.sleep.hours} 小时，质量${lazySleepLabels[entry.sleep.quality]}`);
  }

  if (entry.period) {
    const day = entry.period.day === 'none' ? '无' : `D${entry.period.day}`;
    preview.push(`生理期：${day}，流量${lazyFlowLabels[entry.period.flow]}`);
  }

  if (entry.exercise) {
    preview.push(`运动：${entry.exercise.type || '运动'} ${entry.exercise.duration} 分钟，${lazyIntensityLabels[entry.exercise.intensity]}`);
  }

  if (entry.gratitude) {
    preview.push(`今日感恩：${entry.gratitude.split('\n').slice(-1)[0]}`);
  }

  if (entry.rawText) {
    preview.push('原文：将按输入框原样保存');
  }

  return preview.length > 0 ? preview : ['暂无可预览内容'];
}

function entryToLazyTemplate(entry: DailyEntry): string {
  const parts: string[] = [];

  if (entry.diet.length > 0) {
    parts.push(entry.diet.map((item) => {
      const note = item.notes ? `，备注 ${item.notes}` : '';
      return `${lazyMealLabels[item.mealType]}吃了${item.food}，胃${lazyStomachLabels[item.stomachFeeling]}${note}`;
    }).join('；'));
  }

  if (entry.mood) {
    const note = entry.mood.notes ? `，${entry.mood.notes}` : '';
    parts.push(`今天心情${lazyMoodLabels[entry.mood.mood]}，焦虑 ${entry.mood.anxietyLevel} 分${note}`);
  }

  if (entry.sleep) {
    const note = entry.sleep.notes ? `，${entry.sleep.notes}` : '';
    parts.push(`睡了 ${entry.sleep.hours} 小时，睡眠质量${lazySleepLabels[entry.sleep.quality]}${note}`);
  }

  if (entry.period) {
    const day = entry.period.day === 'none' ? '无生理期' : `生理期第 ${entry.period.day} 天`;
    const note = entry.period.symptoms ? `，${entry.period.symptoms}` : '';
    parts.push(`${day}，流量${lazyFlowLabels[entry.period.flow]}${note}`);
  }

  if (entry.exercise) {
    const note = entry.exercise.notes ? `，${entry.exercise.notes}` : '';
    parts.push(`${entry.exercise.type || '运动'} ${entry.exercise.duration} 分钟，强度${lazyIntensityLabels[entry.exercise.intensity]}${note}`);
  }

  if (entry.gratitude) {
    parts.push(`今天感谢${entry.gratitude.split('\n').slice(-1)[0]}`);
  }

  return parts.join('；') || entry.rawText || '';
}

function classifyLazyInput(entry: DailyEntry, input: string): { nextEntry: DailyEntry; recognized: string[] } {
  const originalText = input;
  const text = originalText.trim();
  const compact = text.replace(/\s+/g, ' ');
  const nextEntry: DailyEntry = {
    ...entry,
    diet: [...entry.diet],
    mood: entry.mood ? { ...entry.mood } : null,
    sleep: entry.sleep ? { ...entry.sleep } : null,
    period: entry.period ? { ...entry.period } : null,
    exercise: entry.exercise ? { ...entry.exercise } : null,
    rawText: entry.rawText,
  };
  const recognized: string[] = [];
  nextEntry.rawText = appendRawText(nextEntry.rawText, originalText);

  if (/吃|喝|早饭|早餐|午饭|午餐|晚饭|晚餐|加餐|零食|宵夜/.test(compact)) {
    nextEntry.diet.push({
      mealType: inferMealType(compact),
      food: extractAfterKeyword(compact, /(早饭|早餐|午饭|午餐|晚饭|晚餐|加餐|零食|宵夜|吃了|喝了|吃|喝)/) || compact.slice(0, 36),
      stomachFeeling: inferStomachFeeling(compact),
      notes: originalText,
    });
    recognized.push('已归类到饮食');
  }

  const mood = inferMood(compact);
  if (mood) {
    nextEntry.mood = { ...mood, notes: originalText };
    recognized.push('已归类到情绪');
  }

  const sleep = inferSleep(compact);
  if (sleep) {
    nextEntry.sleep = { ...sleep, notes: originalText };
    recognized.push('已归类到睡眠');
  }

  const period = inferPeriod(compact);
  if (period) {
    nextEntry.period = { ...period, symptoms: originalText };
    recognized.push('已归类到生理期');
  }

  const exercise = inferExercise(compact);
  if (exercise) {
    nextEntry.exercise = { ...exercise, notes: originalText };
    recognized.push('已归类到运动');
  }

  const gratitude = inferGratitude(compact);
  if (gratitude) {
    nextEntry.gratitude = nextEntry.gratitude ? `${nextEntry.gratitude}\n${gratitude}` : gratitude;
    recognized.push('已归类到今日感恩');
  }

  if (recognized.length === 0) {
    nextEntry.gratitude = nextEntry.gratitude ? `${nextEntry.gratitude}\n${originalText}` : originalText;
    recognized.push('没有识别出明确类别，已先放到今日感恩');
  }

  return { nextEntry, recognized };
}

function appendRawText(current: string | undefined, input: string): string {
  return [current, input].filter(Boolean).join('\n');
}

function extractAfterKeyword(text: string, keyword: RegExp): string {
  const match = text.match(keyword);
  if (!match || match.index === undefined) return '';
  return text
    .slice(match.index + match[0].length)
    .split(/[，。；;,.]/)[0]
    .replace(/^(了|：|:)/, '')
    .trim();
}

function inferMealType(text: string): DietRecord['mealType'] {
  if (/早饭|早餐|早上/.test(text)) return 'breakfast';
  if (/午饭|午餐|中午/.test(text)) return 'lunch';
  if (/晚饭|晚餐|晚上/.test(text)) return 'dinner';
  return 'snack';
}

function inferStomachFeeling(text: string): DietRecord['stomachFeeling'] {
  if (/胃痛|肚子痛|疼|痛/.test(text)) return 'pain';
  if (/胀|不舒服|恶心|反酸|拉肚子|难受/.test(text)) return 'uncomfortable';
  if (/舒服|很好|没事|不难受/.test(text)) return 'good';
  return 'okay';
}

function inferMood(text: string): MoodRecord | null {
  if (!/心情|情绪|开心|高兴|平静|放松|焦虑|紧张|担心|难过|低落|压力|崩溃|烦/.test(text)) return null;

  let mood: MoodRecord['mood'] = 'neutral';
  if (/开心|高兴|愉快|快乐/.test(text)) mood = 'happy';
  else if (/平静|放松|稳定/.test(text)) mood = 'calm';
  else if (/焦虑|紧张|担心|慌|烦/.test(text)) mood = 'anxious';
  else if (/难过|低落|伤心/.test(text)) mood = 'sad';
  else if (/压力|崩溃|撑不住|累爆/.test(text)) mood = 'overwhelmed';

  const levelMatch = text.match(/(?:焦虑|压力|紧张|情绪|心情)[^1-5]*([1-5])\s*分?|([1-5])\s*分?[^，。；;]*(?:焦虑|压力|紧张|情绪|心情)/);
  const parsedLevel = Number(levelMatch?.[1] || levelMatch?.[2]);
  const anxietyLevel = ([1, 2, 3, 4, 5].includes(parsedLevel)
    ? parsedLevel
    : mood === 'happy' || mood === 'calm'
      ? 1
      : mood === 'anxious' || mood === 'overwhelmed'
        ? 4
        : 3) as MoodRecord['anxietyLevel'];

  return { mood, anxietyLevel, notes: text };
}

function inferSleep(text: string): SleepRecord | null {
  if (!/睡|失眠|醒|困/.test(text)) return null;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h)/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 7;
  let quality: SleepRecord['quality'] = 'good';
  if (/很好|不错|踏实/.test(text)) quality = 'excellent';
  else if (/一般|还行/.test(text)) quality = 'fair';
  else if (/差|失眠|醒了|没睡好|很困/.test(text)) quality = 'poor';

  return { hours: Number.isFinite(hours) ? hours : 7, quality, notes: text };
}

function inferPeriod(text: string): PeriodRecord | null {
  if (!/生理期|月经|姨妈|例假|经期|D[1-8]|第[一二三四五六七八12345678]天/.test(text)) return null;

  const dayMatch = text.match(/D\s*([1-8])|第\s*([一二三四五六七八12345678])\s*天/i);
  const dayText = dayMatch?.[1] || dayMatch?.[2] || '1';
  const dayMap: Record<string, PeriodRecord['day']> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  };

  let flow: PeriodRecord['flow'] = 'medium';
  if (/点滴|一点点/.test(text)) flow = 'spotting';
  else if (/量少|少/.test(text)) flow = 'light';
  else if (/量大|多/.test(text)) flow = 'heavy';

  return { day: dayMap[dayText] || 1, flow, symptoms: text };
}

function inferExercise(text: string): ExerciseRecord | null {
  if (!/运动|散步|走路|跑步|瑜伽|健身|骑车|游泳|跳操|拉伸/.test(text)) return null;

  const durationMatch = text.match(/(\d+)\s*(?:分钟|分|min)/i);
  const duration = durationMatch ? Number(durationMatch[1]) : 30;
  const typeMatch = text.match(/(散步|走路|跑步|瑜伽|健身|骑车|游泳|跳操|拉伸|运动)/);
  let intensity: ExerciseRecord['intensity'] = 'moderate';
  if (/轻松|轻度|慢走|拉伸/.test(text)) intensity = 'light';
  else if (/剧烈|很累|大汗|冲刺|高强度/.test(text)) intensity = 'vigorous';

  return {
    type: typeMatch?.[1] || '运动',
    duration: Number.isFinite(duration) ? duration : 30,
    intensity,
    notes: text,
  };
}

function inferGratitude(text: string): string {
  const gratitudeMatch = text.match(/(?:感谢|感恩|开心的是|温暖的是|今天好事)(.*)/);
  if (gratitudeMatch?.[1]?.trim()) {
    return gratitudeMatch[1].replace(/^[:：，,。]/, '').trim();
  }
  return '';
}

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
