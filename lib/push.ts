import { supabase } from './supabase';

export const vapidPublicKey = 'BNvYRXIpWdVeHmGU3t5oVEWxv7n5ksSG7S7dEquuEQ9Mnt3hEIdsJU981moK5ixrqx-4Vr6cazWdjyNjf94CZ5o';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
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

  if (!isPushSupported()) {
    throw new Error('当前浏览器不支持可靠推送');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('需要允许浏览器通知后才能开启可靠推送');
  }

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const { error } = await supabase.rpc('app_save_push_subscription', {
    p_session_token: sessionToken,
    p_subscription: subscription.toJSON(),
    p_user_agent: navigator.userAgent,
  });

  if (error) {
    throw new Error(error.message);
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
  await navigator.serviceWorker.ready;
  return registration;
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
