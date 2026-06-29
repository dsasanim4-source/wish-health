'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { changePassword, type UserSession } from '@/lib/auth';

export default function ChangePasswordPanel({
  session,
  onChanged,
}: {
  session: UserSession;
  onChanged: (session: UserSession) => void;
}) {
  const [open, setOpen] = useState(session.mustChangePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      const nextSession = { ...session, mustChangePassword: false };
      onChanged(nextSession);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码已修改');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-4">
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lavender/15 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-lavender-dark" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">
                {session.mustChangePassword ? '请先修改初始密码' : '密码设置'}
              </h2>
              <p className="text-sm text-text-secondary">
                当前登录：{session.displayName || session.username}
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => setOpen((value) => !value)}>
            {open ? '收起' : '修改密码'}
          </button>
        </div>

        {open && (
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <input
              className="input-field"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="当前密码"
            />
            <input
              className="input-field"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="新密码"
            />
            <input
              className="input-field"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="确认新密码"
            />
            <div className="md:col-span-3 flex flex-col md:flex-row md:items-center gap-3">
              <button className="btn-primary" onClick={submit} disabled={loading}>
                {loading ? '保存中...' : '保存新密码'}
              </button>
              {(error || message) && (
                <span className={`text-sm ${error ? 'text-blush-dark' : 'text-sage-dark'}`}>
                  {error || message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
