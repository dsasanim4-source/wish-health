'use client';

import { useEffect, useState } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import ChangePasswordPanel from '@/components/ChangePasswordPanel';
import LoginScreen from '@/components/LoginScreen';
import Navbar from '@/components/Navbar';
import { getAuthSession, type AuthSession, type UserSession } from '@/lib/auth';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined);

  useEffect(() => {
    const syncSession = () => setSession(getAuthSession());
    syncSession();
    window.addEventListener('wish-health-auth-changed', syncSession);
    return () => window.removeEventListener('wish-health-auth-changed', syncSession);
  }, []);

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
