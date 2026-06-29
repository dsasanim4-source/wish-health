'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Clock, Utensils, X } from 'lucide-react';
import { type UserSession } from '@/lib/auth';

type ReminderItem = {
  time: '08:00' | '12:00' | '18:00';
  title: string;
  body: string;
};

type ReminderToast = ReminderItem & {
  id: string;
  message: string;
};

type ReminderPermission = NotificationPermission | 'unsupported';

const beijingOffsetMs = 8 * 60 * 60 * 1000;
const reminderItems: ReminderItem[] = [
  {
    time: '08:00',
    title: '早安记录提醒',
    body: '早上好，记得好好吃早饭，也给今天留一条轻轻的记录。',
  },
  {
    time: '12:00',
    title: '午餐记录提醒',
    body: '中午到了，好好吃饭，顺手记一下上午的身体和心情。',
  },
  {
    time: '18:00',
    title: '晚间记录提醒',
    body: '晚上好，记得认真吃晚饭，也把今天的状态收进记录里。',
  },
];

export default function ReminderCenter({ session }: { session: UserSession }) {
  const [permission, setPermission] = useState<ReminderPermission>('unsupported');
  const [toast, setToast] = useState<ReminderToast | null>(null);
  const [promptHidden, setPromptHidden] = useState(false);
  const userName = useMemo(() => (session.displayName || session.username).trim(), [session.displayName, session.username]);

  useEffect(() => {
    void Promise.resolve().then(() => setPermission(getNotificationPermission()));
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const next = getNextReminder(new Date());
      timeoutId = window.setTimeout(() => {
        showReminder(next.item, userName, setToast);
        scheduleNext();
      }, Math.min(next.delayMs, 2_147_483_647));
    };

    scheduleNext();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [userName]);

  const requestBrowserReminder = async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      setPromptHidden(true);
      setToast({
        ...reminderItems[0],
        id: `enabled-${Date.now()}`,
        message: `${userName}，提醒已经开启。之后在北京时间 08:00、12:00、18:00 我会提醒你好好吃饭和记录。`,
      });
    }
  };

  return (
    <>
      {permission === 'default' && !promptHidden && (
        <div className="reminder-permission-card fixed bottom-24 right-4 z-[60] max-w-[calc(100vw-2rem)] rounded-2xl border border-peach/45 bg-white px-4 py-3 shadow-xl md:bottom-5 md:max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-peach/20 text-peach-dark">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary">开启每日提醒</p>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                北京时间 08:00、12:00、18:00 提醒记录和吃饭。
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary px-3 py-2 text-xs" onClick={requestBrowserReminder}>
                  开启
                </button>
                <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setPromptHidden(true)}>
                  稍后
                </button>
              </div>
            </div>
            <button className="p-1 text-text-secondary hover:text-blush-dark" onClick={() => setPromptHidden(true)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="reminder-toast fixed bottom-24 left-4 right-4 z-[70] rounded-3xl border border-blush/35 bg-white p-4 shadow-2xl md:bottom-5 md:left-auto md:right-5 md:max-w-md">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blush/18 text-blush-dark">
              <Utensils className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-peach/25 px-2.5 py-1 text-xs font-bold text-peach-dark">
                  {toast.time} 北京时间
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <Clock className="h-3.5 w-3.5" />
                  每日提醒
                </span>
              </div>
              <h2 className="text-base font-bold text-text-primary">{toast.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{toast.message}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/record" className="btn-primary px-3 py-2 text-xs">
                  去记录
                </Link>
                <button className="btn-secondary px-3 py-2 text-xs" onClick={() => setToast(null)}>
                  知道了
                </button>
              </div>
            </div>
            <button className="p-1 text-text-secondary hover:text-blush-dark" onClick={() => setToast(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function showReminder(
  item: ReminderItem,
  userName: string,
  setToast: React.Dispatch<React.SetStateAction<ReminderToast | null>>,
) {
  const stamp = getReminderStamp(new Date(), item.time);
  const storageKey = 'wish_health_reminder_last_sent';
  if (localStorage.getItem(storageKey) === stamp) return;

  localStorage.setItem(storageKey, stamp);
  const message = `${userName}，${item.body}`;
  setToast({ ...item, id: stamp, message });

  if (getNotificationPermission() === 'granted') {
    const notification = new Notification(item.title, {
      body: message,
      tag: `wish-health-${item.time}`,
      icon: getNotificationIconUrl(),
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = getRecordUrl();
      notification.close();
    };
  }
}

function getNotificationPermission(): ReminderPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function getNextReminder(now: Date): { item: ReminderItem; delayMs: number } {
  const nowMs = now.getTime();
  const targets = reminderItems.map((item) => ({
    item,
    targetMs: getReminderUtcMs(now, item.time),
  }));

  const nextToday = targets.find((target) => target.targetMs > nowMs + 1000);
  if (nextToday) {
    return { item: nextToday.item, delayMs: nextToday.targetMs - nowMs };
  }

  const tomorrow = new Date(nowMs + 24 * 60 * 60 * 1000);
  const firstTomorrow = reminderItems[0];
  return {
    item: firstTomorrow,
    delayMs: getReminderUtcMs(tomorrow, firstTomorrow.time) - nowMs,
  };
}

function getReminderUtcMs(date: Date, time: ReminderItem['time']): number {
  const beijingDate = new Date(date.getTime() + beijingOffsetMs);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(
    beijingDate.getUTCFullYear(),
    beijingDate.getUTCMonth(),
    beijingDate.getUTCDate(),
    hour - 8,
    minute,
    0,
    0,
  );
}

function getReminderStamp(date: Date, time: ReminderItem['time']): string {
  const beijingDate = new Date(date.getTime() + beijingOffsetMs);
  const year = beijingDate.getUTCFullYear();
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}-${time}`;
}

function getRecordUrl(): string {
  const basePath = window.location.pathname.startsWith('/wish-health') ? '/wish-health' : '';
  return `${window.location.origin}${basePath}/record/`;
}

function getNotificationIconUrl(): string {
  const basePath = window.location.pathname.startsWith('/wish-health') ? '/wish-health' : '';
  return `${window.location.origin}${basePath}/favicon.ico`;
}
