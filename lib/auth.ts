import { supabase } from './supabase';

const SESSION_KEY = 'wish_health_session';
const ADMIN_SESSION_KEY = 'wish_health_admin_session';

export type UserSession = {
  mode: 'user';
  token: string;
  userId: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

export type AdminSession = {
  mode: 'admin';
  token: string;
};

export type AuthSession = UserSession | AdminSession;

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 尚未配置');
  }
  return supabase;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const adminRaw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (adminRaw) {
      const adminSession = JSON.parse(adminRaw) as AuthSession;
      if (adminSession.mode === 'admin') {
        return adminSession;
      }
    }

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as AuthSession;
    if (session.mode === 'admin') {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  if (session.mode === 'admin') {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  window.dispatchEvent(new Event('wish-health-auth-changed'));
}

export function clearAuthSession(): void {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.dispatchEvent(new Event('wish-health-auth-changed'));
}

export async function login(username: string, password: string): Promise<UserSession> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_login', {
    p_username: username.trim(),
    p_password: password,
  });

  if (error) throw new Error(error.message);

  const session: UserSession = {
    mode: 'user',
    token: data.token,
    userId: data.user_id,
    username: data.username,
    displayName: data.display_name || data.username,
    mustChangePassword: Boolean(data.must_change_password),
  };

  setAuthSession(session);
  return session;
}

export async function adminLoginTotp(code: string): Promise<AdminSession> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_admin_login_totp', {
    p_code: code.trim(),
  });

  if (error) throw new Error(error.message);

  const session: AdminSession = {
    mode: 'admin',
    token: data.token,
  };

  setAuthSession(session);
  return session;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const session = getAuthSession();
  if (!session || session.mode !== 'user') {
    throw new Error('请先登录');
  }

  const client = requireSupabase();
  const { data, error } = await client.rpc('app_change_password', {
    p_session_token: session.token,
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });

  if (error) throw new Error(error.message);

  setAuthSession({
    ...session,
    mustChangePassword: Boolean(data.must_change_password),
  });
}

export type AdminUser = {
  id: string;
  username: string;
  display_name: string | null;
  must_change_password: boolean;
  created_at: string;
};

export type AdminRecord = {
  username: string;
  display_name: string | null;
  id: string;
  date: string;
  diet: unknown[];
  mood: unknown | null;
  sleep: unknown | null;
  period: unknown | null;
  exercise: unknown | null;
  gratitude: string;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
};

function getAdminToken(): string {
  const session = getAuthSession();
  if (!session || session.mode !== 'admin') {
    throw new Error('请先进入管理员模式');
  }
  return session.token;
}

export async function adminCreateUser(username: string, displayName: string): Promise<AdminUser> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_admin_create_user', {
    p_admin_token: getAdminToken(),
    p_username: username.trim(),
    p_display_name: displayName.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as AdminUser;
}

export async function adminResetPassword(userId: string): Promise<AdminUser> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_admin_reset_password', {
    p_admin_token: getAdminToken(),
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
  return data as AdminUser;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_admin_list_users', {
    p_admin_token: getAdminToken(),
  });

  if (error) throw new Error(error.message);
  return (data || []) as AdminUser[];
}

export async function adminListRecords(): Promise<AdminRecord[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('app_admin_list_records', {
    p_admin_token: getAdminToken(),
  });

  if (error) throw new Error(error.message);
  return (data || []) as AdminRecord[];
}
