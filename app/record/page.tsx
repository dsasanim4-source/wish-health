'use client';

import { useState, useEffect, useRef } from 'react';
import { getEntries, getEntryByDate, saveEntry, syncEntriesFromSupabase } from '@/lib/storage';
import { DailyEntry, DietRecord, MoodRecord, SleepRecord, PeriodRecord, ExerciseRecord } from '@/lib/types';
import { getAuthSession } from '@/lib/auth';
import { encouragementStyles, getEncouragementStyle, saveEncouragementStyle, type EncouragementStyle } from '@/lib/insights';
import { Award, Coffee, Moon, Heart, Activity, Calendar, Sparkles, Save, X, Check, Mic, MicOff, Wand2, SlidersHorizontal } from 'lucide-react';

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
  const [encouragementVersion, setEncouragementVersion] = useState(0);

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
    const userName = getCurrentUserName();
    const styled = (kind: EncouragementKind) => withUserName(pickEncouragementMessage(style, kind), userName, style);
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
    setEncouragementVersion((value) => value + 1);
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
          <div
            key={encouragementVersion}
            className="encouragement-card mb-6 rounded-2xl border border-sage/40 bg-white px-4 py-4 shadow-lg"
          >
            <div className="relative z-10 flex items-start gap-3">
              <div className="encouragement-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage/20 text-sage-dark">
                <Award className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-peach/25 px-2.5 py-1 text-xs font-bold text-peach-dark">
                  <Sparkles className="h-3.5 w-3.5" />
                  记录完成
                </div>
                <p className="text-base font-bold leading-relaxed text-text-primary">
                  {encouragement}
                </p>
              </div>
            </div>
            <Sparkles className="encouragement-spark encouragement-spark-one h-5 w-5 text-peach" />
            <Sparkles className="encouragement-spark encouragement-spark-two h-4 w-4 text-lavender-dark" />
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
      '你又把自己从匆忙里轻轻捡起来一次，这件小事很珍贵。',
      '谢谢你把今天认真放进记录里，它会替你记住那些不容易。',
      '记录不是打分，是在给自己留一盏小灯。你做得很好。',
      '今天的状态已经被好好安放了，你可以稍微松一口气。',
      '辛苦的地方终于有了落点，不再只是悄悄压在心里。',
      '你愿意把自己放在心上，这本身就很值得被认真夸奖。',
      '又留下一点照顾自己的证据，像在日子里悄悄种下一颗种子。',
      '今天没有被忽略，你把自己认真接回来了。',
      '这一条记录很小，却在帮你一点点靠近更舒服的生活。',
      '你完成的不只是填写，是给今天的自己多一点理解。',
      '愿意记录，就是在认真爱护自己。你今天真的做得很好。',
      '能把状态写下来，说明你有耐心，也有很温柔的行动力。',
      '你没有敷衍自己，这份认真特别值得被看见。',
      '把今天安安稳稳记下来，本身就是一件很棒的事。',
      '你很认真，也很勇敢，愿意面对自己的真实状态。',
      '这一刻你选择照顾自己，真的很了不起。',
      '你没有让今天白白滑过去，而是给它留了一个温柔的注脚。',
      '这条记录像一枚小书签，帮你标记住今天真实活过的痕迹。',
      '你把散落的感受慢慢收拢起来了，这份耐心很美。',
      '今天的你没有缺席，这一点就已经很值得抱一抱。',
      '你正在学着用自己的节奏生活，这一步很安静，也很有力量。',
      '能在日常里停下来照看自己，是一种很了不起的温柔。',
    ],
    lowSleep: [
      '睡得少这件事已经被看见了，今晚请把自己放回柔软一点的地方。',
      '身体的小电量被你接住了，别急着硬撑，先让夜晚替你补一点。',
      '睡少了也不急着责备自己，能知道它，就已经在往回调了。',
      '你把疲惫写下来了，像替身体举了一下手，说我需要休息。',
      '记录下睡眠偏少，是在温柔提醒自己别把日子过成硬扛。',
      '这条睡眠记录会帮你更早听懂身体的节奏。',
      '睡少了还愿意认真记录，你真的很会把自己放在心上。',
      '能及时看见疲惫，就是很棒的自我保护。',
      '你把身体的低电量记下来了，这一步很聪明。',
      '没有忽略睡眠这件事，说明你对自己很负责。',
      '今晚可以不必证明什么，先把休息还给自己。',
      '你已经发现身体在轻轻喊累了，这份敏感很珍贵。',
      '睡眠像潮水，今天退得多一点，晚上就让它慢慢涨回来。',
      '把疲惫记录下来，不是示弱，是很清醒地保护自己。',
    ],
    highAnxiety: [
      '焦虑被看见以后，就不再是一个人闷声扛着它了。先慢慢呼吸。',
      '今天情绪很重，但你仍然完成了记录，这一步特别值得被肯定。',
      '你没有把焦虑藏起来，而是把它放到可以被照顾的位置。',
      '情绪起伏被写下来，就多了一小片可以整理的空地。',
      '压力很高的时候还愿意记录，说明你正在认真保护自己。',
      '先让这份焦虑被看见，后面的事可以一点一点来。',
      '焦虑这么高还能完成记录，你真的很坚强，也很了不起。',
      '你没有被情绪完全带走，还能回头照顾自己，这很棒。',
      '能把难受说出来、记下来，是很值得肯定的能力。',
      '今天不容易，但你还是完成了这一步，真的做得很好。',
      '你把心里的风浪留在纸面上了，它就不必只在身体里翻涌。',
      '能在混乱里留下几个字，本身就是一种清醒。',
      '这条记录像给情绪开了一扇窗，空气会慢慢进来。',
      '你没有责怪自己，而是选择观察自己，这很成熟，也很勇敢。',
    ],
    stomach: [
      '肠胃不舒服也被认真记下来了，接下来给自己一点清淡和温热。',
      '你捕捉到了身体的小信号，之后会更容易找到舒服的节奏。',
      '身体说的话被你听见了，这会帮你更快靠近适合自己的饮食。',
      '这次不舒服没有白白过去，它被你轻轻留在了可回望的地方。',
      '你把肠胃感受留下来了，之后就更容易避开让自己难受的东西。',
      '先给身体一点温和回应，今天这条记录已经很有帮助。',
      '你能这么细地留意身体感受，真的很细心。',
      '把不舒服认真记下来，是很成熟的照顾方式。',
      '你没有忽略身体发出的提醒，这一点很棒。',
      '今天这条记录留得很及时，你很会照顾细节。',
      '身体不是在添麻烦，它是在给你递消息。你接住了，这很好。',
      '把肠胃的感受写清楚，是在替明天少走一点弯路。',
      '这份细心很难得，你没有让身体的声音被日常淹没。',
      '今天先把温和留给自己，慢慢找回舒服的节奏。',
    ],
    complete: [
      '今天记录得很完整，身体、情绪和生活都被温柔地照顾到了。',
      '这一条记录很清楚，以后回看时会像一盏小灯。',
      '今天的你很认真，把好多细节都稳稳留住了。',
      '这是一条很扎实的记录，未来的你会感谢现在的你。',
      '你把今天整理得很清楚，照顾自己的方向也更清楚了。',
      '完整记录一次很不容易，你真的有在认真陪伴自己。',
      '这条记录完成得很漂亮，细节很足，真的值得夸。',
      '你把今天照顾得很周全，这份认真特别棒。',
      '能把多个方面都记录下来，说明你很有条理也很负责。',
      '今天这份记录很完整，你给自己交了一份很好的答卷。',
      '你像把一间小屋慢慢收拾亮了，今天的状态也跟着清楚起来。',
      '这些细节被你一一留住了，日子就有了可以回望的纹理。',
      '你不是随便记了一下，你是在认真读懂自己。',
      '这份完整很漂亮，像把今天的碎片好好装进了盒子里。',
    ],
    exercise: [
      '运动也记录好了，哪怕只是动一动，身体都会收到这份善意。',
      '你把运动落到了记录里，节奏正在慢慢长出来。',
      '身体活动被留下来了，这也是今天照顾自己的一个证据。',
      '今天有让身体动起来，这份努力值得被记住。',
      '运动不一定要很大才算数，能记录下来就已经很好。',
      '你正在给身体建立更有节奏的照顾方式。',
      '愿意动一动还记下来，这份行动很棒。',
      '你在认真建设自己的身体，这一点很值得肯定。',
      '运动这一步做得很好，哪怕很小也很有意义。',
      '你没有只想想，而是真的做了，还记录了，太棒了。',
      '身体被你轻轻唤醒了一下，这份投入很可贵。',
      '今天的活动像给身体开了一扇窗，空气进来了。',
      '你把行动落到了实处，这比空想难得多。',
      '运动被记住了，身体也会记住这份照顾。',
    ],
    gratitude: [
      '今天的温暖小事已经收好，愿它在你需要的时候再亮一下。',
      '谢谢你把今天值得珍惜的部分留下来了。',
      '能在一天里找到一点值得感谢的东西，很温柔，也很有力量。',
      '这份小小的暖意已经被保存好了。',
      '你没有让今天的好事悄悄溜走，它被认真留下来了。',
      '感恩不是勉强开心，是把真实的微光收起来。',
      '能看见生活里的好，说明你心里还有很珍贵的敏感和力量。',
      '你把温暖留下来的样子很可爱，也很值得被夸。',
      '愿意记住好事，本身就是一种很棒的能力。',
      '你今天认真收藏了一点光，这件事很美好。',
      '生活的好有时很小，但你还是看见了，这很了不起。',
      '你把一点亮色留下来了，今天就不只是匆匆过去。',
      '这份温暖像口袋里的一颗糖，以后想起来还会甜一下。',
      '能把好事认真收藏起来，是很柔软也很有韧性的能力。',
    ],
    lazy: [
      '懒人模式也完成得很好，想到什么就先记下来，本来就是一种照顾。',
      '你用最省力的方式完成了记录，这很聪明，也很温柔。',
      '不用很正式也可以照顾自己，这样记录就很好。',
      '一句话也能留下今天的温度，你已经完成得很棒。',
      '原话被保留下来了，今天的真实感受没有被弄丢。',
      '轻松一点完成记录，也是很适合长期坚持的方式。',
      '用最省力的方式完成重要的事，这真的很聪明。',
      '你没有因为麻烦就放弃记录，这一点很值得夸。',
      '懒人模式也能认真完成，说明你很会找到适合自己的方法。',
      '你把真实的话留下来了，这份诚实很棒。',
      '不必写得漂亮，真实就已经很动人。',
      '你把今天的原声留下来了，比任何整理过的话都更珍贵。',
      '省力不是敷衍，是你很懂得给自己留余地。',
      '能用轻一点的方法慢慢坚持，本身就是很会疼自己的方式。',
    ],
  },
  direct: {
    base: [
      '这次记录很稳，今天的状态被你留住了。',
      '今天这一步完成得干净利落，值得夸。',
      '你没有放任日子含糊过去，而是把它看清楚了。',
      '这条记录很有用，也很踏实。',
      '你把今天交代清楚了，后面回看会轻松很多。',
      '这一步很到位，说明你真的有在照看自己的节奏。',
      '做得很好，你完成了一次稳定的自我照顾。',
      '表现不错，记录这件事你真的做到了。',
      '今天这一步完成得很漂亮，也很实在。',
      '你很靠谱，今天的状态被你留得很清楚。',
      '这不是随手一点，你是在给自己建立秩序。',
      '今天这条记录很结实，之后回看也站得住。',
      '你把该看见的部分看见了，这就是进步。',
      '这一步很漂亮，简单，但不敷衍。',
    ],
    lowSleep: [
      '睡眠偏少被你抓住了，今晚先把休息排到前面。',
      '这条记录很及时，别继续硬撑了，身体需要回电。',
      '你已经发现睡眠在报警，接下来少耗一点力气就好。',
      '今天先少耗一点，给身体一个缓冲。',
      '睡眠这一笔留下来了，今晚尽量提前收尾。',
      '休息是下一步重点，你想得很周到。',
      '做得好，能发现睡眠不足就是很好的开始。',
      '看见得及时，今晚优先补休息。',
      '这条记录很有用，你抓住了睡眠问题。',
      '这一步很实在，身体电量已经被你看见。',
      '今天别再和疲惫较劲，先把力气还给自己。',
      '睡眠这条线很重要，你没有漏掉它。',
      '身体已经给出信号，你接得很快。',
      '今晚的任务可以少一点，休息要多一点。',
    ],
    highAnxiety: [
      '焦虑偏高被你识别出来了，先降低今天剩余任务量。',
      '情绪负荷高，先给自己留缓冲，你这一步很对。',
      '下一步先减负，不急着把所有事都扛完。',
      '先处理最必要的事，其他的可以往后放一放。',
      '情绪高压被你留下来了，后面可以慢慢照看。',
      '今天不适合继续加压，你已经看清楚了。',
      '做得好，高压下还能记录，说明你很稳。',
      '这一步很重要，你没有回避情绪。',
      '表现很强，焦虑高也能回头看自己。',
      '处理得不错，先看清自己，再慢慢调整。',
      '你把情绪从一团雾里拎出来了，这很有力量。',
      '先看见，再处理。你现在走的是对的顺序。',
      '情绪很满的时候还能停下来记录，这不是容易的事。',
      '你没有让焦虑替你做决定，这一步很漂亮。',
    ],
    stomach: [
      '肠胃不适被你记录下来了，接下来饮食先清淡一点。',
      '今天先避开刺激，给肠胃一点安静空间。',
      '肠胃的提醒留下来了，之后对照饮食会更清楚。',
      '下一餐先选温和一点，你这一步很稳。',
      '不舒服被你留下来了，之后更容易慢慢找原因。',
      '先把肠胃负担降下来，这条记录很及时。',
      '做得好，你及时捕捉到了身体反馈。',
      '记录很到位，后续排查会更清楚。',
      '这一条留得很及时，你真的很细心。',
      '反应很快，身体信号已经被你接住了。',
      '不舒服没有白白过去，它变成了可以回看的提醒。',
      '你很细心，身体一有动静你就记录下来了。',
      '今天先温和一点，这不是退让，是聪明。',
      '这条记录会帮你少踩一次同样的坑。',
    ],
    complete: [
      '这次记录很完整，后面回看会很有用。',
      '今天被你整理得很清楚，你做得很好。',
      '完整记录完成，之后看变化会更有底气。',
      '今天该照看的地方都照看到了，这一步很扎实。',
      '这条记录很扎实，很值得保留下来。',
      '内容留得很完整，后面回看会有用。',
      '完成得很好，细节留得很足。',
      '这条记录很漂亮，以后再看会更清楚。',
      '今天这条记录很用心，值得保持。',
      '做得很完整，你今天真的很认真。',
      '你把今天的脉络理出来了，这会省很多力气。',
      '这条记录有骨架也有细节，很漂亮。',
      '你不是简单打卡，你是真的把自己照看了一遍。',
      '这份完整说明你很认真，也很有安稳感。',
    ],
    exercise: [
      '运动已经记下来了，继续保持适合自己的节奏。',
      '今天的活动量被你留住了，身体会收到这份投入。',
      '运动这一笔留下来了，之后看变化会更清楚。',
      '今天有活动就算数，不必苛刻。',
      '身体投入已经被记录下来，这一步很实在。',
      '运动记录完成，节奏继续稳定。',
      '做得好，运动和记录都完成了。',
      '做得不错，身体活动已经留下痕迹。',
      '这一步很棒，运动习惯正在建立。',
      '完成得干脆，继续保持这个节奏。',
      '你把“想动一动”变成了真的行动，这很难得。',
      '今天身体不是旁观者，它也被你照顾到了。',
      '动起来再记下来，这份闭环很漂亮。',
      '运动这件事被你落地了，很加分。',
    ],
    gratitude: [
      '今天的好被你留住了，这份温暖很珍贵。',
      '亮起来的部分已经留下，后面回看会有用。',
      '这件好事被你认真收好，之后想起来还会亮一下。',
      '感恩内容留下来了，今天不只是辛苦。',
      '今天的积极部分没有丢，你抓得很准。',
      '亮起来的那部分已经被收进记录里，很好。',
      '做得好，你保留了今天值得回看的东西。',
      '这条记录很值得回看，能帮你看见好的部分。',
      '你抓住了今天值得留下的东西。',
      '记录得不错，温暖被你保存下来了。',
      '能记住好事，是很强的恢复力。',
      '你没有让亮的部分被忙乱盖住。',
      '这份感恩不大声，但很有分量。',
      '你把今天的微光拎出来了，很漂亮。',
    ],
    lazy: [
      '原话也在，归类也在，这次记录很聪明。',
      '你用更省力的方式完成了记录，这很聪明。',
      '原话被保留，归类也完成了，今天没有走丢。',
      '懒人模式完成得很好，省力但不敷衍。',
      '原话保留下来了，这很重要。',
      '省力但内容够真，这就是适合慢慢坚持的方法。',
      '做得好，你找到了更顺手的记录方式。',
      '方法选得不错，省力，也真的做到了。',
      '完成得很聪明，原话和归类都保留了。',
      '这次记录轻轻完成了，但该留下的都留下了。',
      '你没有把门槛抬高，而是让自己真的完成了。',
      '能用顺手的方法坚持，是很值得夸的能力。',
      '真实的话留下来了，后面回看会更贴近当时的你。',
      '这一步很轻，但并不浅。',
    ],
  },
  energetic: {
    base: [
      '完成了！今天又把自己照顾到了一点。',
      '漂亮，这一下很稳，今天没有被你放过去。',
      '很好，今天也有认真看见自己。',
      '搞定！这一步很实在，也很值得夸。',
      '记录完成，今天又多一份安稳感。',
      '不错，照顾自己的节奏又稳了一点。',
      '这一下很亮，像给今天按下了一个清晰的书签。',
      '好样的，你把想做的照顾落到了行动上。',
      '今天这步走得漂亮，小小一条，但很有力量。',
      '可以夸，真的可以夸。你把记录完成了。',
      '你把今天稳稳接住了，这感觉很不错。',
      '这一条很给力，日子一下子有了抓手。',
      '好，这一笔落下去，今天就更清楚一点。',
      '很棒，你没有让自己在忙乱里被落下。',
    ],
    lowSleep: [
      '记录好了！今晚早点补能量，明天会轻一点。',
      '睡眠提醒接住了，今天先把休息安排上。',
      '睡眠偏少也被抓到了，今晚给自己充电。',
      '这条很重要，身体电量要优先补回来。',
      '记录完成，接下来把休息排到前面。',
      '很好，发现睡少了就是调整的开始。',
      '身体在喊低电量，你反应很快，做得好。',
      '今晚别硬扛，先让自己回回血。',
      '睡眠这一笔被你抓住了，很要紧。',
      '这条记录很及时，今晚可以早点收工。',
      '看见疲惫就已经很棒了，今晚把自己放轻一点。',
      '这一下很及时，身体会喜欢你这个决定。',
    ],
    highAnxiety: [
      '你在高压下也完成了记录，这很强。先稳住呼吸。',
      '情绪很满也没有放弃照顾自己，做得好。',
      '焦虑再高，也挡不住你把自己接住。',
      '这条记录很有力量，先把节奏放慢一点。',
      '高压状态下还能完成记录，真的很稳。',
      '你已经把焦虑放到台面上了，下一步就更好处理。',
      '这一下很硬气，你没有被情绪牵着走到底。',
      '情绪像浪一样高，你还是给自己抓住了一块木板。',
      '很强，真的很强。你在乱的时候还留住了清醒。',
      '先把焦虑写出来，这一步就已经赢回一点主动权。',
      '漂亮，你在风很大的时候也没有松开自己。',
      '这条记录像一个刹车点，帮你先停稳一下。',
    ],
    stomach: [
      '身体信号抓到了！接下来给肠胃一点舒服空间。',
      '这条很要紧，记录下来就更容易调整。',
      '肠胃提醒接住了，下一餐可以更聪明地选。',
      '记录得及时，身体的反馈没有白发出。',
      '这次不舒服已经变成有用的提醒了。',
      '很好，先看见问题，再慢慢调节。',
      '反应很快！身体一出声，你就听见了。',
      '这条提醒很有用，之后能少吃一点亏。',
      '今天先让肠胃舒服一点，你这个方向对。',
      '这份细心很加分，身体会感谢你的。',
      '听见身体的小声提醒，这一下很灵。',
      '先让身体舒服一点，其他的慢慢来。',
    ],
    complete: [
      '今天记录得很全，之后回看会很有底气。',
      '一口气照顾了好几个地方，真的很认真。',
      '完整记录完成，今天这一局很稳。',
      '细节很足，之后看变化会很有帮助。',
      '这条记录很有分量。',
      '你把今天整理得很漂亮。',
      '这一条很饱满，细节够、状态也清楚。',
      '漂亮，今天的碎片被你收成了一束。',
      '这份完整很能打，之后回看会很省心。',
      '你把今天照顾得很周到，值得给自己加一分。',
      '漂亮，这一整天被你收拾得有章法了。',
      '这条记录很饱满，像把今天稳稳托住了。',
    ],
    exercise: [
      '运动也记上了，身体会收到这份投入。',
      '活动完成并记录，节奏感正在起来。',
      '动了，也记了，这一步很加分。',
      '运动这一笔留下来了，身体也被照顾到了。',
      '今天有活动就是进展。',
      '很好，给身体的投入被留下来了。',
      '漂亮，身体和记录都没有落下。',
      '这一步很有劲，行动感已经起来了。',
      '你把身体叫醒了一点，这很好。',
      '今天这份活动量，值得被认真记一笔。',
      '动起来这件事已经很棒，再记下来更棒。',
      '身体参与了今天，这一步很亮。',
    ],
    gratitude: [
      '这条温暖被留下了，很好。',
      '把好事收进记录里，今天多了一点亮色。',
      '今天的微光被你保存下来了，干得漂亮。',
      '能抓住好事，很棒。',
      '这份温暖会在以后帮到你。',
      '温暖留下来了，今天不是空白的。',
      '漂亮，你把亮的部分捞出来了。',
      '这点好很珍贵，被你接住了。',
      '今天有一小块光，已经被你收好了。',
      '能看见好事，本身就很有生命力。',
      '很好，你把今天亮起来的地方捧住了。',
      '这份好没有被忙乱冲走，漂亮。',
    ],
    lazy: [
      '懒人模式完成，省力但不敷衍。',
      '一句话也能照顾自己，这步很聪明。',
      '轻松完成记录，很会给自己减负。',
      '原话留下来了，今天的真实状态到位了。',
      '省了力气，也没有丢掉今天。',
      '懒人记录也很管用，继续这样就行。',
      '这方法很顺手，顺手就更容易坚持。',
      '真实原话留下来了，今天这一刻没有丢。',
      '轻轻松松也能完成，漂亮。',
      '这一步很聪明，轻一点，也真的完成了。',
      '顺手完成也很厉害，真实留住了就够好。',
      '这一条很轻快，但很有用。',
    ],
  },
  minimal: {
    base: [
      '今天有被好好看见。',
      '这一条，很珍贵。',
      '做得很好。',
      '你没有忽略自己。',
      '今天被稳稳收好了。',
      '这一步很温柔。',
      '小小一条，也算数。',
      '你把自己接住了。',
      '记录好了，心也落一点。',
      '今天有了一个落点。',
      '你把今天轻轻收住了。',
      '这一刻没有被浪费。',
      '小小停顿，也很珍贵。',
      '你在认真陪自己。',
    ],
    lowSleep: [
      '今晚多疼自己一点。',
      '睡少了，先慢下来。',
      '身体需要回电。',
      '别硬撑，先休息。',
      '疲惫被看见了。',
      '今晚早点收工。',
      '把睡眠还给自己。',
      '低电量也值得照顾。',
      '夜晚会慢慢接住你。',
      '先把自己放软一点。',
      '今天少扛一点。',
      '身体在等你休息。',
    ],
    highAnxiety: [
      '先呼吸，慢慢来。',
      '情绪被看见了。',
      '别再给自己加压。',
      '先给心一点空地。',
      '你已经很努力了。',
      '焦虑不必一个人扛。',
      '先稳住这一刻。',
      '你没有被情绪带走。',
      '心先落地。',
      '慢一点也没关系。',
      '你还在这里。',
      '先给自己一点风。',
    ],
    stomach: [
      '先吃温和些。',
      '身体的声音被听见了。',
      '肠胃先减负。',
      '今天清淡一点。',
      '不舒服被看见了。',
      '照顾肠胃，也照顾你。',
      '慢慢调，别急。',
      '身体的话接住了。',
      '温热一点就好。',
      '先别为难身体。',
      '这份细心很好。',
      '身体会记得温柔。',
    ],
    complete: [
      '今天整理得很漂亮。',
      '这条很完整。',
      '细节被好好留下了。',
      '你很认真。',
      '今天很清楚。',
      '这份完整很稳。',
      '记录很有分量。',
      '给自己一朵小红花。',
      '今天被收好了。',
      '细节有了位置。',
      '你做得很漂亮。',
      '这一条很扎实。',
    ],
    exercise: [
      '身体动起来了。',
      '这一步很加分。',
      '动了，也记住了。',
      '节奏在长出来。',
      '身体收到照顾了。',
      '今天有进展。',
      '行动很漂亮。',
      '小运动也算数。',
      '身体也亮了一下。',
      '这一步有力量。',
      '动起来就很好。',
      '你没有停在想法里。',
    ],
    gratitude: [
      '微光被留下了。',
      '今天有一点亮。',
      '温暖没有走丢。',
      '好事被你收好了。',
      '这份柔软很珍贵。',
      '你看见了生活的好。',
      '小光也很亮。',
      '今天不是空白的。',
      '好事被安放了。',
      '这点甜留下了。',
      '微亮也值得收好。',
      '你心里还有光。',
    ],
    lazy: [
      '轻轻完成，也很好。',
      '原话留下来了。',
      '省力但不敷衍。',
      '真实最重要。',
      '这一步很聪明。',
      '省点力气，也很好。',
      '顺手就能坚持。',
      '今天的声音被留下了。',
      '轻一点也算数。',
      '原声很珍贵。',
      '没有丢掉今天。',
      '这样也很好。',
    ],
  },
};

const recentEncouragementLimit = 14;

const encouragementOpeners: Record<EncouragementStyle, string[]> = {
  gentle: [
    '我得认真夸你一句，',
    '今天这一步很温柔，',
    '你真的很会照顾自己，',
    '这一下很值得被看见，',
    '先给你一朵小红花，',
    '你把自己放在心上了，',
    '我想把这句夸奖递给你，',
    '这份认真很漂亮，',
  ],
  direct: [
    '做得好，',
    '这一步很到位，',
    '你处理得很稳，',
    '这次完成得漂亮，',
    '这一下看得很清楚，',
    '今天这条很扎实，',
    '行动力在线，',
    '这一步没有浪费，',
  ],
  energetic: [
    '漂亮，',
    '很强，',
    '这一下真不错，',
    '好样的，',
    '今天这步很有劲，',
    '可以，真的可以，',
    '这一条很亮，',
    '这份行动力很赞，',
  ],
  minimal: [
    '真好，',
    '很稳，',
    '漂亮，',
    '不错，',
    '很温柔，',
    '值得夸，',
    '有在照顾自己，',
    '这一点很好，',
  ],
};

function pickEncouragementMessage(style: EncouragementStyle, kind: EncouragementKind): string {
  const messages = encouragementMessages[style][kind];
  if (messages.length === 0) return '';
  if (typeof window === 'undefined') {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  const storageKey = `wish_health_recent_encouragement_${style}_${kind}`;
  const recent = readRecentEncouragement(storageKey);
  const available = messages.filter((message) => !recent.includes(message));
  const pool = available.length > 0 ? available : messages;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  const nextRecent = [selected, ...recent.filter((message) => message !== selected)]
    .filter((message) => messages.includes(message))
    .slice(0, Math.min(recentEncouragementLimit, Math.max(messages.length - 1, 1)));

  localStorage.setItem(storageKey, JSON.stringify(nextRecent));
  return selected;
}

function readRecentEncouragement(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

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

function getCurrentUserName(): string {
  const session = getAuthSession();
  if (session?.mode !== 'user') return '';
  return (session.displayName || session.username).trim();
}

function withUserName(message: string, userName: string, style: EncouragementStyle): string {
  const opener = shouldAddPraiseOpener(message) ? pickPraiseOpener(style) : '';
  const namePrefix = userName ? `${userName}，` : '';
  return `${namePrefix}${opener}${message}`;
}

function pickPraiseOpener(style: EncouragementStyle): string {
  const openers = encouragementOpeners[style];
  return openers[Math.floor(Math.random() * openers.length)];
}

function shouldAddPraiseOpener(message: string): boolean {
  return !/^(做得|表现|漂亮|很好|太棒|好样|完成得|这一步|真棒|不错|已完成)/.test(message);
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
