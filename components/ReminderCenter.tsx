'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Clock, Utensils, X } from 'lucide-react';
import { type UserSession } from '@/lib/auth';
import {
  getPushSubscriptionState,
  isPushSupported,
  subscribeToPushReminders,
  unsubscribeFromPushReminders,
} from '@/lib/push';

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
type PushState = 'checking' | 'unsupported' | 'denied' | 'enabled' | 'available';

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
  const [pushState, setPushState] = useState<PushState>('checking');
  const [toast, setToast] = useState<ReminderToast | null>(null);
  const [promptHidden, setPromptHidden] = useState(false);
  const [pushError, setPushError] = useState('');
  const [isOpeningPush, setIsOpeningPush] = useState(false);
  const userName = useMemo(() => (session.displayName || session.username).trim(), [session.displayName, session.username]);

  useEffect(() => {
    let mounted = true;

    void Promise.resolve().then(async () => {
      const nextState = await readPushStateSafely();
      if (!mounted) return;
      setPermission(getNotificationPermission());
      setPushState(nextState);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (pushState === 'enabled') return;

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
  }, [userName, pushState]);

  const requestReliablePush = async () => {
    setPushError('');
    setIsOpeningPush(true);
    try {
      if (!isPushSupported()) {
        setPushState('unsupported');
        setPushError(getPushStateMessage('unsupported'));
        return;
      }

      await subscribeToPushReminders(session.token);
      setPermission(getNotificationPermission());
      setPushState('enabled');
      setPromptHidden(true);
      setToast({
        ...reminderItems[0],
        id: `enabled-${Date.now()}`,
        message: `${userName}，可靠推送已经开启。之后在北京时间 08:00、12:00、18:00 我会提醒你好好吃饭和记录。`,
      });
    } catch (error) {
      setPermission(getNotificationPermission());
      const nextState = await readPushStateSafely();
      setPushState(nextState === 'enabled' ? 'available' : nextState);
      setPushError(getPushErrorMessage(error, nextState));
    } finally {
      setIsOpeningPush(false);
    }
  };

  const closeReliablePush = async () => {
    setPushError('');
    await unsubscribeFromPushReminders(session.token);
    setPushState(await readPushStateSafely());
    setToast(null);
  };

  const refreshReliablePush = async () => {
    setPushError('');
    setPushState('checking');
    const nextState = await readPushStateSafely();
    setPermission(getNotificationPermission());
    setPushState(nextState);
    if (nextState === 'unsupported' || nextState === 'denied') {
      setPushError(getPushStateMessage(nextState));
    }
  };

  const helperMessage = pushError || getPushStateMessage(pushState);
  const canTryPush = pushState !== 'checking' && !isOpeningPush;
  const primaryAction = pushState === 'unsupported' || permission === 'denied' ? refreshReliablePush : requestReliablePush;
  const primaryLabel = getPrimaryButtonLabel(pushState, isOpeningPush);

  return (
    <>
      {pushState !== 'enabled' && !promptHidden && (
        <div className="reminder-permission-card fixed bottom-24 right-4 z-[60] max-w-[calc(100vw-2rem)] rounded-2xl border border-peach/45 bg-white px-4 py-3 shadow-xl md:bottom-5 md:max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-peach/20 text-peach-dark">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary">开启每日提醒</p>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                北京时间 08:00、12:00、18:00 可靠推送提醒记录和吃饭。
              </p>
              {helperMessage && (
                <p className="mt-2 rounded-xl bg-blush/10 px-3 py-2 text-xs leading-relaxed text-blush-dark">
                  {helperMessage}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary px-3 py-2 text-xs" onClick={primaryAction} disabled={!canTryPush}>
                  {primaryLabel}
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

      {pushState === 'enabled' && !promptHidden && (
        <div className="fixed bottom-24 right-4 z-[55] hidden rounded-full bg-sage/15 px-3 py-2 text-xs font-semibold text-sage-dark shadow-sm md:block">
          每日可靠提醒已开启
          <button className="ml-2 text-text-secondary hover:text-blush-dark" onClick={closeReliablePush}>
            关闭
          </button>
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

async function readPushStateSafely(): Promise<PushState> {
  try {
    return await getPushSubscriptionState();
  } catch {
    return isPushSupported() ? 'available' : 'unsupported';
  }
}

function getPushStateMessage(state: PushState): string {
  if (state === 'checking') {
    return '正在检查浏览器提醒能力，请稍等一下。';
  }

  if (state === 'unsupported') {
    return getUnsupportedPushHint();
  }

  if (state === 'denied') {
    return '浏览器通知权限已被拒绝，请在浏览器的网站设置里允许通知，然后刷新或点重新检查。';
  }

  return '';
}

function getPushErrorMessage(error: unknown, fallbackState: PushState): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return getPushStateMessage(fallbackState) || '开启提醒失败，请刷新页面后再试一次。';
}

function getPrimaryButtonLabel(state: PushState, isOpening: boolean): string {
  if (isOpening) return '正在开启...';
  if (state === 'checking') return '检查中';
  if (state === 'unsupported' || state === 'denied') return '重新检查';
  return '开启';
}

function getUnsupportedPushHint(): string {
  if (typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return 'iPhone/iPad 需要用 Safari 把网站添加到主屏幕，再从主屏幕图标打开后开启提醒。';
  }

  return '当前浏览器不支持可靠推送。请换用最新版 Chrome、Edge 或 Safari，或确认正在使用 HTTPS 网站。';
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
