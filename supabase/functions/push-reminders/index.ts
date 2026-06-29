import { createClient } from 'npm:@supabase/supabase-js@2';

type ReminderTime = '08:00' | '12:00' | '18:00';
type PushSubscriptionRow = {
  id: string;
  endpoint: string;
};

const reminderTimes: ReminderTime[] = ['08:00', '12:00', '18:00'];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const time = normalizeReminderTime(body.time) || inferBeijingReminderTime();
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('active', true);

    if (error) throw error;

    const subscriptions = (data || []) as PushSubscriptionRow[];
    const results = await Promise.allSettled(
      subscriptions.map((subscription) => sendReminder(subscription, time, supabase)),
    );

    const sent = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - sent;

    return jsonResponse({
      ok: true,
      time,
      total: subscriptions.length,
      sent,
      failed,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

async function sendReminder(
  subscription: PushSubscriptionRow,
  time: ReminderTime,
  supabase: ReturnType<typeof createClient>,
) {
  const headers = await buildVapidHeaders(subscription.endpoint);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      TTL: '86400',
      Urgency: time === '12:00' ? 'high' : 'normal',
      'Content-Length': '0',
    },
  });

  if (response.ok) {
    await supabase
      .from('push_subscriptions')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
    return;
  }

  const lastError = `${response.status} ${await response.text().catch(() => '')}`.trim();
  const update = response.status === 404 || response.status === 410
    ? { active: false, last_error: lastError, updated_at: new Date().toISOString() }
    : { last_error: lastError, updated_at: new Date().toISOString() };

  await supabase
    .from('push_subscriptions')
    .update(update)
    .eq('id', subscription.id);

  throw new Error(lastError);
}

async function buildVapidHeaders(endpoint: string): Promise<Record<string, string>> {
  const publicKey = requiredEnv('VAPID_PUBLIC_KEY');
  const privateKey = requiredEnv('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt({
    audience,
    subject,
    publicKey,
    privateKey,
  });

  return {
    Authorization: `vapid t=${jwt}, k=${publicKey}`,
  };
}

async function createVapidJwt({
  audience,
  subject,
  publicKey,
  privateKey,
}: {
  audience: string;
  subject: string;
  publicKey: string;
  privateKey: string;
}): Promise<string> {
  const publicBytes = base64UrlToBytes(publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error('VAPID_PUBLIC_KEY must be an uncompressed P-256 public key');
  }

  const header = base64UrlEncodeJson({ typ: 'JWT', alg: 'ES256' });
  const payload = base64UrlEncodeJson({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  });
  const signingInput = `${header}.${payload}`;
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: privateKey,
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function normalizeReminderTime(value: unknown): ReminderTime | null {
  return reminderTimes.includes(value as ReminderTime) ? value as ReminderTime : null;
}

function inferBeijingReminderTime(): ReminderTime {
  const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const minutes = beijingDate.getUTCHours() * 60 + beijingDate.getUTCMinutes();
  return reminderTimes.reduce((best, time) => {
    return Math.abs(toMinutes(time) - minutes) < Math.abs(toMinutes(best) - minutes) ? time : best;
  }, '08:00' as ReminderTime);
}

function toMinutes(time: ReminderTime): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function base64UrlEncodeJson(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`;
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from([...binary].map((char) => char.charCodeAt(0)));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
