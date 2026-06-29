import { supabase } from './supabase';

export const vapidPublicKey = 'BNvYRXIpWdVeHmGU3t5oVEWxv7n5ksSG7S7dEquuEQ9Mnt3hEIdsJU981moK5ixrqx-4Vr6cazWdjyNjf94CZ5o';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function getPushSubscriptionState(): Promise<'unsupported' | 'denied' | 'enabled' | 'available'> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'enabled' : 'available';
}

export async function subscribeToPushReminders(sessionToken: string): Promise<PushSubscription> {
  if (!supabase) {
    throw new Error('Supabase 尚未配置');
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error('需要使用 HTTPS 安全网址打开后才能开启可靠推送');
  }

  if (!isPushSupported()) {
    throw new Error(getUnsupportedPushMessage());
  }

  if (Notification.permission === 'denied') {
    throw new Error('浏览器通知权限已被拒绝，请在浏览器的网站设置里允许通知后再重试');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('需要允许浏览器通知后才能开启可靠推送');
  }

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await createPushSubscription(registration);

  const { error } = await supabase.rpc('app_save_push_subscription', {
    p_session_token: sessionToken,
    p_subscription: subscription.toJSON(),
    p_user_agent: navigator.userAgent,
  });

  if (error) {
    await subscription.unsubscribe().catch(() => undefined);
    if (error.message.includes('Could not find the function')) {
      throw new Error('数据库还没有更新推送订阅函数，请先执行最新 schema.sql');
    }
    throw new Error(`保存推送订阅失败：${error.message}`);
  }

  return subscription;
}

export async function unsubscribeFromPushReminders(sessionToken: string): Promise<void> {
  if (!supabase || !isPushSupported()) return;

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.rpc('app_delete_push_subscription', {
    p_session_token: sessionToken,
    p_endpoint: subscription.endpoint,
  });

  await subscription.unsubscribe();
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const basePath = getBasePath();
  const registration = await navigator.serviceWorker.register(`${basePath}/sw.js`, {
    scope: `${basePath}/`,
  });
  await withTimeout(
    navigator.serviceWorker.ready,
    10_000,
    'Service Worker 启动超时，请刷新页面后再试一次',
  );
  return registration;
}

async function createPushSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch (error) {
    throw new Error(getPushRegistrationFailureMessage(error));
  }
}

function getBasePath(): string {
  return window.location.pathname.startsWith('/wish-health') ? '/wish-health' : '';
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function getUnsupportedPushMessage(): string {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos) {
    return 'iPhone/iPad 需要用 Safari 把网站添加到主屏幕，再从主屏幕图标打开后开启提醒';
  }

  return '当前浏览器不支持可靠推送，请换用最新版 Chrome、Edge 或 Safari 后再试';
}

function getPushRegistrationFailureMessage(error: unknown): string {
  const details = getNativeErrorDetails(error);
  const normalizedDetails = details.toLowerCase();

  if (normalizedDetails.includes('no sender id')) {
    return `推送注册失败：浏览器没有识别到推送发送者信息，请刷新页面后再试。技术信息：${details}`;
  }

  if (
    normalizedDetails.includes('push service')
    || normalizedDetails.includes('registration failed')
    || normalizedDetails.includes('aborterror')
  ) {
    return `推送注册失败：浏览器没有连上自己的推送服务。Chrome/Edge 在中国大陆网络环境下比较容易出现这个问题，可以换 Safari 添加到主屏幕，或后续改接微信/短信提醒。技术信息：${details}`;
  }

  if (normalizedDetails.includes('notallowederror') || normalizedDetails.includes('permission')) {
    return '推送注册失败：浏览器通知权限没有放行，请在网站设置里允许通知后重试。';
  }

  if (normalizedDetails.includes('invalid') || normalizedDetails.includes('applicationserverkey')) {
    return `推送注册失败：浏览器没有接受推送公钥，请刷新页面后重试。技术信息：${details}`;
  }

  return `推送注册失败：${details}`;
}

function getNativeErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return [error.name, error.message].filter(Boolean).join(': ');
  }

  if (typeof error === 'string') return error;
  return '未知浏览器错误';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
