const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const reminder = readPushReminder(event);
  event.waitUntil(
    self.registration.showNotification(reminder.title, {
      body: reminder.body,
      tag: `wish-health-${reminder.time}`,
      icon: `${getBasePath()}/favicon.ico`,
      badge: `${getBasePath()}/favicon.ico`,
      data: {
        url: `${getBasePath()}/record/`,
      },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || `${getBasePath()}/record/`, self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientList.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      existing.navigate(targetUrl);
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});

function readPushReminder(event) {
  if (event.data) {
    try {
      return normalizeReminder(event.data.json());
    } catch {
      // Empty or non-JSON payloads fall back to Beijing-time inference.
    }
  }

  return reminderByBeijingTime();
}

function normalizeReminder(data) {
  const fallback = reminderByBeijingTime();
  return {
    time: typeof data.time === 'string' ? data.time : fallback.time,
    title: typeof data.title === 'string' ? data.title : fallback.title,
    body: typeof data.body === 'string' ? data.body : fallback.body,
  };
}

function reminderByBeijingTime() {
  const beijingDate = new Date(Date.now() + BEIJING_OFFSET_MS);
  const minutes = beijingDate.getUTCHours() * 60 + beijingDate.getUTCMinutes();
  const slots = [
    {
      time: '08:00',
      minute: 8 * 60,
      title: '早安记录提醒',
      body: '早上好，记得好好吃早饭，也给今天留一条轻轻的记录。',
    },
    {
      time: '12:00',
      minute: 12 * 60,
      title: '午餐记录提醒',
      body: '中午到了，好好吃饭，顺手记一下上午的身体和心情。',
    },
    {
      time: '18:00',
      minute: 18 * 60,
      title: '晚间记录提醒',
      body: '晚上好，记得认真吃晚饭，也把今天的状态收进记录里。',
    },
  ];

  return slots.reduce((best, slot) => {
    return Math.abs(slot.minute - minutes) < Math.abs(best.minute - minutes) ? slot : best;
  }, slots[0]);
}

function getBasePath() {
  return self.location.pathname.startsWith('/wish-health') ? '/wish-health' : '';
}
