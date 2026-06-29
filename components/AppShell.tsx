'use client';

import { useEffect, useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import ChangePasswordPanel from '@/components/ChangePasswordPanel';
import LoginScreen from '@/components/LoginScreen';
import Navbar from '@/components/Navbar';
import { clearAuthSession, getAuthSession, type AuthSession, type UserSession } from '@/lib/auth';

const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);

  useEffect(() => {
    const syncSession = () => setSession(getAuthSession());
    syncSession();
    window.addEventListener('wish-health-auth-changed', syncSession);
    return () => window.removeEventListener('wish-health-auth-changed', syncSession);
  }, []);

  useEffect(() => {
    void unregisterLegacyReminderWorker();
  }, []);

  useEffect(() => {
    if (session?.mode !== 'admin') return;

    let timeoutId = window.setTimeout(() => {
      clearAuthSession();
      setSession(null);
    }, ADMIN_IDLE_TIMEOUT_MS);

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        clearAuthSession();
        setSession(null);
      }, ADMIN_IDLE_TIMEOUT_MS);
    };

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [session?.mode]);

  if (session === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center text-text-secondary">
        加载中...
      </main>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  if (session.mode === 'admin') {
    return <AdminDashboard onLogout={() => setSession(null)} />;
  }

  const updateUserSession = (nextSession: UserSession) => {
    setSession(nextSession);
  };

  return (
    <>
      <Navbar session={session} onLogout={() => setSession(null)} />
      {session.mustChangePassword && (
        <ChangePasswordPanel session={session} onChanged={updateUserSession} />
      )}
      {children}
    </>
  );
}

async function unregisterLegacyReminderWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const basePath = window.location.pathname.startsWith('/wish-health') ? '/wish-health' : '';
  const registration = await navigator.serviceWorker.getRegistration(`${basePath}/`);
  if (!registration) return;

  const subscription = registration.pushManager
    ? await registration.pushManager.getSubscription().catch(() => null)
    : null;
  await subscription?.unsubscribe().catch(() => undefined);
  await registration.unregister().catch(() => undefined);
}
